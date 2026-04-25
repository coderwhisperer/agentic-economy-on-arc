// bench.ts — proves the Featherless track claim:
//   "improved cost efficiency and output quality compared to general-purpose models"
//
// We send the same N prompts through two pipelines:
//   A) OracleMesh router (Gemini picks specialist Featherless model + sub-cent price)
//   B) Baseline (always Llama 3.1 70B at a flat ~$0.005 quote)
//
// Then Gemini 2.5 Flash acts as judge and decides which answer is better for each prompt.
// (Gemini 3 Pro is paid-only; 2.5 Flash is free-tier eligible and performs well as a pairwise judge.)
// We print: (i) cost delta, (ii) win-rate, (iii) per-prompt detail.
//
// IMPORTANT: This bench uses Featherless DIRECTLY for both A and B (no payment loop)
// so judges can run it without funding wallets. Pricing numbers are quoted, not settled.
// Run `burst.ts` separately for the actual on-chain payment proof.

import OpenAI from "openai";
import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { route } from "./router.js";
import { quotePrice } from "./catalog.js";

if (!process.env.FEATHERLESS_API_KEY) throw new Error("FEATHERLESS_API_KEY missing");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

const featherless = new OpenAI({
  apiKey: process.env.FEATHERLESS_API_KEY,
  baseURL: "https://api.featherless.ai/v1",
});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const BASELINE_MODEL = "meta-llama/Meta-Llama-3.1-70B-Instruct";
const BASELINE_PRICE_USD = quotePrice("large", 200);

const PROMPTS: string[] = [
  "Write a Python function that returns the nth Fibonacci number iteratively.",
  "What is metformin's primary mechanism of action?",
  "Translate to French: 'I'll meet you at the coffee shop at 4pm.'",
  "Define 'res ipsa loquitur' in plain English.",
  "Write a haiku about a server room.",
  "If 3x + 7 = 22, what is x? Show one line of work.",
  "Summarize Romeo and Juliet in 2 sentences.",
  "Regex to validate a US ZIP code (5 or 5+4).",
  "What's the difference between a clinical trial Phase II and Phase III?",
  "How do you say 'thank you very much' in Korean?",
];

type Run = { prompt: string; model: string; priceUsd: number; answer: string; ms: number };

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const backoffs = [1500, 3500, 7000];
  let lastErr: any;
  for (let i = 0; i <= backoffs.length; i++) {
    try { return await fn(); }
    catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      const retryable = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg);
      if (!retryable || i === backoffs.length) throw err;
      await new Promise(r => setTimeout(r, backoffs[i]));
    }
  }
  throw lastErr;
}

async function callFeatherless(model: string, prompt: string): Promise<{ answer: string; ms: number }> {
  const t0 = Date.now();
  const resp = await featherless.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.3,
  });
  return { answer: resp.choices[0]?.message?.content ?? "", ms: Date.now() - t0 };
}

async function runRouter(prompt: string): Promise<Run> {
  const decision = await route(prompt);
  const { answer, ms } = await callFeatherless(decision.modelId, prompt);
  return { prompt, model: decision.display, priceUsd: decision.priceUsd, answer, ms };
}

async function runBaseline(prompt: string): Promise<Run> {
  const { answer, ms } = await callFeatherless(BASELINE_MODEL, prompt);
  return { prompt, model: "Llama 3.1 70B (baseline)", priceUsd: BASELINE_PRICE_USD, answer, ms };
}

const judgeFn = {
  name: "score",
  description: "Score which answer is better, A or B, or call it a tie.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      winner: { type: Type.STRING, enum: ["A", "B", "TIE"] },
      reason: { type: Type.STRING, description: "One sentence." },
    },
    required: ["winner", "reason"],
  },
};

async function judge(prompt: string, a: string, b: string) {
  const result = await callWithRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: [{
      role: "user",
      parts: [{
        text: `PROMPT: ${prompt}\n\nANSWER A:\n${a}\n\nANSWER B:\n${b}\n\nWhich answer better serves the prompt? Consider correctness first, then conciseness. Call score().`
      }],
    }],
    config: {
      tools: [{ functionDeclarations: [judgeFn] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["score"] } },
      temperature: 0,
    },
  }));
  const call = result.functionCalls?.[0];
  const args = call?.args as { winner: "A" | "B" | "TIE"; reason: string };
  return args ?? { winner: "TIE" as const, reason: "judge failed" };
}

(async () => {
  console.log(`\nBenchmarking router vs baseline on ${PROMPTS.length} prompts…\n`);

  let routerCost = 0, baselineCost = 0;
  let routerWins = 0, baselineWins = 0, ties = 0;

  for (let i = 0; i < PROMPTS.length; i++) {
    const p = PROMPTS[i];
    process.stdout.write(`[${i + 1}/${PROMPTS.length}] `);
    // Serialized: Featherless plan caps concurrency at 4; Promise.all bursts past it.
    const a = await runRouter(p);
    const b = await runBaseline(p);
    routerCost += a.priceUsd;
    baselineCost += b.priceUsd;

    // Randomize A/B assignment to avoid position bias
    const flip = Math.random() < 0.5;
    const verdict = await judge(p, flip ? a.answer : b.answer, flip ? b.answer : a.answer);
    const realWinner =
      verdict.winner === "TIE" ? "TIE" :
      (verdict.winner === "A") === flip ? "ROUTER" : "BASELINE";

    if (realWinner === "ROUTER") routerWins++;
    else if (realWinner === "BASELINE") baselineWins++;
    else ties++;

    console.log(`router=${a.model} ($${a.priceUsd.toFixed(4)}, ${a.ms}ms) | baseline ($${b.priceUsd.toFixed(4)}, ${b.ms}ms) | judge=${realWinner}`);
  }

  console.log(`\n──────────── BENCH RESULTS ───────────`);
  console.log(`Total cost — router:    $${routerCost.toFixed(4)}`);
  console.log(`Total cost — baseline:  $${baselineCost.toFixed(4)}`);
  console.log(`Cost saving:            ${((1 - routerCost / baselineCost) * 100).toFixed(1)}%`);
  console.log(`\nQuality (Gemini 2.5 Flash Lite as judge):`);
  console.log(`  Router wins:    ${routerWins}`);
  console.log(`  Baseline wins:  ${baselineWins}`);
  console.log(`  Ties:           ${ties}`);
  console.log(`\nHeadline: ${((1 - routerCost / baselineCost) * 100).toFixed(0)}% cheaper, ${routerWins >= baselineWins ? "matches or beats" : "trails"} baseline quality.`);
})();
