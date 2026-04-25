// router.ts — OracleMesh routing agent.
//
// Gemini 3 Flash Preview classifies each inbound task and emits a STRUCTURED
// routing decision via a forced function call. Free text is never allowed —
// the function schema IS the contract.
//
// Why Gemini 3 Flash: the hackathon Featherless track explicitly recommends
// Gemini 3 Flash for "transactional and payment agents" — it's optimized for
// the low-latency, agentic, sub-second decisions this endpoint needs. We use
// Gemini 3.1 Pro (via bench.ts) as the judge.
//
// Thought signatures: Gemini 3 enforces strict signature validation during
// function calling. We round-trip the signature on any follow-up; single-turn
// callers are unaffected. See https://ai.google.dev/gemini-api/docs/thought-signatures

import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { CATALOG, quotePrice, type ModelEntry, type TaskCategory } from "./catalog.js";

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY missing — get a free key at https://aistudio.google.com/app/apikey"
  );
}

// Primary model (Gemini 3 Flash Preview, as recommended by the Featherless track
// for transactional/payment agents). If it's capacity-throttled, cascade to
// gemini-2.5-flash — same function-calling API, higher availability on free tier.
const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash-lite";
const MODEL_CASCADE = [PRIMARY_MODEL, FALLBACK_MODEL];
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type RoutingDecision = {
  category: TaskCategory;
  complexity: "simple" | "medium" | "complex";
  modelId: string;                 // Featherless model ID to use
  display: string;                 // human-readable label
  priceUsd: number;                // quoted price (flat pricing mode)
  estimatedOutputTokens: number;   // used by metered pricing too
  reasoning: string;               // one-sentence justification
};

// Function schema — forced. The router CANNOT return free text.
const routeFunction = {
  name: "route_task",
  description:
    "Classify the user's task and select the cheapest Featherless model that can handle it well. Quote a per-call USD price ≤ $0.01.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        enum: [
          "code", "medical", "legal", "multilingual",
          "creative_writing", "math_reasoning", "general_chat", "summarization",
        ],
        description: "Domain of the task.",
      },
      complexity: {
        type: Type.STRING,
        enum: ["simple", "medium", "complex"],
        description: "Estimated reasoning depth required.",
      },
      model_id: {
        type: Type.STRING,
        description:
          "Exact Featherless model ID from the catalog. Prefer SMALLEST tier that can plausibly answer well. Do not over-provision.",
      },
      estimated_output_tokens: {
        type: Type.NUMBER,
        description: "Best guess of OUTPUT token count, used for pricing uplift. Expect 20-400 for typical tasks.",
      },
      reasoning: {
        type: Type.STRING,
        description: "One sentence justifying the routing choice.",
      },
    },
    required: ["category", "complexity", "model_id", "estimated_output_tokens", "reasoning"],
  },
};

const SYSTEM_PROMPT = `You are OracleMesh's routing agent. For each user task, pick the cheapest Featherless model that will produce a quality answer.

RULES:
1. ALWAYS call the route_task function. NEVER answer the task yourself, even partially.
2. Prefer SMALL tier models. Only escalate to mid/large when the task genuinely needs it (multi-step reasoning, long structured output, or specialist domain depth).
3. Match domain to the right specialist when one exists:
   - medical questions → OpenBioLLM
   - legal questions → Saul
   - non-English / translation → Suzume Llama3 Multilingual
   - code / regex / snippets → Qwen Coder (7B for simple, 32B for complex)
   - creative writing → UnslopNemo
4. Use Llama 3.1 8B as the default general workhorse. Escalate to 70B only for genuinely hard reasoning.

CATALOG (pick model_id EXACTLY from this list):

${CATALOG.map(m =>
  `- ${m.id}\n    display: ${m.display}\n    tier: ${m.paramTier}\n    categories: ${m.categories.join(", ")}\n    notes: ${m.notes}`
).join("\n")}`;

/**
 * Route a task. Returns a RoutingDecision or throws.
 * Single-turn: we do not persist thought signatures across calls.
 */
export async function route(task: string): Promise<RoutingDecision> {
  if (!task || task.trim().length === 0) {
    throw new Error("Empty task");
  }

  // Gemini 3 Flash Preview is capacity-throttled; retry with backoff, then
  // cascade to gemini-2.5-flash on persistent 503/429.
  let result: any;
  let lastErr: any;
  const backoffs = [1000, 2500];
  cascade: for (const model of MODEL_CASCADE) {
    for (let attempt = 0; attempt < backoffs.length + 1; attempt++) {
      try {
        result = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: task }] }],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [routeFunction] }],
            toolConfig: {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.ANY,
                allowedFunctionNames: ["route_task"],
              },
            },
            temperature: 0.1,
          },
        });
        lastErr = null;
        break cascade;
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message ?? err);
        const retryable = /503|429|UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED/i.test(msg);
        if (!retryable) break cascade;
        if (attempt === backoffs.length) break; // exhaust retries, try next model
        await new Promise(r => setTimeout(r, backoffs[attempt]));
      }
    }
  }
  if (lastErr) {
    throw new Error(`Gemini routing call failed (all models in cascade): ${lastErr?.message ?? lastErr}`);
  }

  const call = result.functionCalls?.[0];
  if (!call || call.name !== "route_task") {
    // Fall back to a deterministic safe default rather than crash
    return fallbackRoute(task, "Gemini did not emit route_task function call");
  }

  const args = call.args as {
    category?: TaskCategory;
    complexity?: "simple" | "medium" | "complex";
    model_id?: string;
    estimated_output_tokens?: number;
    reasoning?: string;
  };

  const entry = CATALOG.find(m => m.id === args.model_id);
  if (!entry) {
    // Router hallucinated a model not in our catalog — deterministic fallback
    return fallbackRoute(task, `Router chose unknown model '${args.model_id}'`);
  }

  const est = Math.max(8, Math.min(2048, Number(args.estimated_output_tokens ?? 200)));
  const priceUsd = quotePrice(entry.paramTier, est);

  return {
    category: args.category ?? "general_chat",
    complexity: args.complexity ?? "medium",
    modelId: entry.id,
    display: entry.display,
    priceUsd,
    estimatedOutputTokens: est,
    reasoning: args.reasoning ?? "auto-routed",
  };
}

/**
 * Fallback router — keyword-heuristic. Never fails. Used when Gemini is
 * unavailable or returns an unusable decision. Always picks a cheap, sensible
 * default so the demo never dies on a routing glitch.
 */
export function fallbackRoute(task: string, reason: string): RoutingDecision {
  const t = task.toLowerCase();
  const match = (words: string[]) => words.some(w => t.includes(w));

  let entry: ModelEntry;
  let category: TaskCategory;
  if (match(["code", "function", "regex", "python", "javascript", "typescript", "java ", "rust", "golang", "snippet", "bug", "stack trace", "compile", "syntax", "error message", "css", "html"])) {
    entry = CATALOG.find(m => m.id.includes("Qwen2.5-Coder-7B"))!;
    category = "code";
  } else if (match([
    "diagnos", "medic", "medical", "drug", "drugs", "symptom", "symptoms", "dose", "dosage",
    "patient", "disease", "clinical", "therapy", "treatment", "prescription", "side effect",
    "contraindic", "metformin", "ibuprofen", "aspirin", "paracetamol", "tylenol",
    "antibiotic", "vaccine", "blood pressure", "diabetes", "cholesterol", "mg/dl",
  ])) {
    entry = CATALOG.find(m => m.id.includes("OpenBio"))!;
    category = "medical";
  } else if (match(["translate", "in french", "in spanish", "in japanese", "in arabic", "in korean", "in german", "in chinese", "in italian", "in portuguese", "in hindi", "in russian", "translation", "say in"])) {
    entry = CATALOG.find(m => m.id.includes("suzume"))!;
    category = "multilingual";
  } else if (match(["legal", "contract", "law", "statute", "lawsuit", "litig", "clause", "force majeure", "indemnif", "felony", "misdemeanor", "tort", "plaintiff", "defendant"])) {
    entry = CATALOG.find(m => m.id.includes("Saul"))!;
    category = "legal";
  } else if (match(["poem", "story", "haiku", "novel", "scene", "screenplay", "lyric", "verse", "narrative", "creative writing"])) {
    entry = CATALOG.find(m => m.id.includes("UnslopNemo"))!;
    category = "creative_writing";
  } else {
    entry = CATALOG.find(m => m.id.includes("Llama-3.1-8B"))!;
    category = "general_chat";
  }

  return {
    category,
    complexity: "simple",
    modelId: entry.id,
    display: entry.display,
    priceUsd: quotePrice(entry.paramTier, 200),
    estimatedOutputTokens: 200,
    reasoning: `fallback: ${reason}`,
  };
}

// CLI smoke test — doesn't require Featherless or any payment stack.
// Usage: tsx --env-file=.env router.ts "write a python function to reverse a linked list"
if (import.meta.url === `file://${process.argv[1]}`) {
  const task = process.argv.slice(2).join(" ") || "explain the mechanism of action of metformin";
  route(task).then(
    d => console.log(JSON.stringify(d, null, 2)),
    e => { console.error("Route failed:", e.message); process.exit(1); }
  );
}
