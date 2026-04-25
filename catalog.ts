// catalog.ts — curated subset of Featherless models with routing metadata.
// Keep this small and well-tagged; the router agent picks from it by category.
//
// Pricing rationale: we charge a small fixed quote per call based on model
// "tier" (parameter count proxy), then add a token-estimate uplift. All
// quotes are well under $0.01 to satisfy Circle's per-action ceiling.

export type TaskCategory =
  | "code"
  | "medical"
  | "legal"
  | "multilingual"
  | "creative_writing"
  | "math_reasoning"
  | "general_chat"
  | "summarization";

export type ModelEntry = {
  id: string;                  // Featherless model ID, OpenAI-compatible
  display: string;             // human-readable name
  categories: TaskCategory[];  // what it's good at
  paramTier: "small" | "mid" | "large"; // pricing tier
  notes: string;
};

// Note: model IDs follow Hugging Face conventions on Featherless.
// Verify availability with `GET https://api.featherless.ai/v1/models` before demo.
export const CATALOG: ModelEntry[] = [
  {
    id: "Qwen/Qwen2.5-Coder-7B-Instruct",
    display: "Qwen2.5 Coder 7B",
    categories: ["code"],
    paramTier: "small",
    notes: "Specialist coder, very fast, great for snippet/function tasks.",
  },
  {
    id: "Qwen/Qwen2.5-Coder-32B-Instruct",
    display: "Qwen2.5 Coder 32B",
    categories: ["code", "math_reasoning"],
    paramTier: "mid",
    notes: "Larger coder for harder algorithmic / multi-file reasoning.",
  },
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    display: "Llama 3.1 8B",
    categories: ["general_chat", "summarization"],
    paramTier: "small",
    notes: "Cheapest general workhorse for chat, Q&A, summaries.",
  },
  {
    id: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    display: "Llama 3.1 70B",
    categories: ["general_chat", "math_reasoning", "summarization"],
    paramTier: "large",
    notes: "Reasoning fallback when smaller models are insufficient.",
  },
  {
    id: "aaditya/Llama3-OpenBioLLM-8B",
    display: "OpenBioLLM 8B",
    categories: ["medical"],
    paramTier: "small",
    notes: "Biomedical-tuned; for clinical Q&A, drug interactions, terminology.",
  },
  {
    id: "Equall/Saul-7B-Instruct-v1",
    display: "Saul 7B (Legal)",
    categories: ["legal"],
    paramTier: "small",
    notes: "Legal-domain finetune; contract review, statute lookup.",
  },
  {
    id: "lightblue/suzume-llama-3-8B-multilingual",
    display: "Suzume Llama3 8B Multilingual",
    categories: ["multilingual"],
    paramTier: "small",
    notes: "Llama-3 8B finetuned for multilingual Q&A and translation (Japanese/Korean/European/Arabic).",
  },
  {
    id: "TheDrummer/UnslopNemo-12B-v4.1",
    display: "UnslopNemo 12B",
    categories: ["creative_writing"],
    paramTier: "mid",
    notes: "Creative writing & narrative generation without slop phrases.",
  },
];

// Pricing has TWO modes so we can serve Circle's Per-API Monetization track
// (flat per-call) AND the Usage-Based Compute Billing track (metered by actual
// tokens consumed).

// Per-token rates in USD — the metered price equals (inputTokens * rateIn +
// outputTokens * rateOut) + a small routing fee. Tuned so that typical calls
// still land well under $0.01.
export type PerTokenRate = { rateIn: number; rateOut: number };
export const PER_TOKEN_RATES: Record<ModelEntry["paramTier"], PerTokenRate> = {
  small: { rateIn: 0.00000008, rateOut: 0.00000030 },   // ~$0.0008 at 100/500 tokens
  mid:   { rateIn: 0.00000020, rateOut: 0.00000080 },
  large: { rateIn: 0.00000050, rateOut: 0.00000200 },
};

const ROUTING_FEE_USD = 0.0002;              // covers Gemini call, kept small
export const PRICE_CEILING_USD = 0.0095;     // hard max — Circle requires ≤ $0.01

// Flat per-call quote (used BEFORE the call — Per-API Monetization mode).
// Price = base by tier + token-estimate uplift.
export function quotePrice(tier: ModelEntry["paramTier"], estTokens: number): number {
  const base =
    tier === "small" ? 0.0008 :
    tier === "mid"   ? 0.0020 :
                       0.0050;
  const uplift = Math.min(0.003, estTokens * 0.000004);
  return Math.min(PRICE_CEILING_USD, +(base + uplift).toFixed(6));
}

// Post-call metered settlement (Usage-Based Compute Billing mode).
// Caller pre-authorizes a CAP, we run inference, then settle for actual usage.
export function meteredPrice(
  tier: ModelEntry["paramTier"],
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = PER_TOKEN_RATES[tier];
  const raw = inputTokens * rate.rateIn + outputTokens * rate.rateOut + ROUTING_FEE_USD;
  return Math.min(PRICE_CEILING_USD, +raw.toFixed(6));
}

// Upper bound the caller authorizes — used as the "cap" in metered flow.
// Always ≤ the ceiling. Generous enough that typical inferences settle well
// under the authorized amount, with the unused portion returned.
export function meteredCap(tier: ModelEntry["paramTier"]): number {
  return PRICE_CEILING_USD;
}

// Convert dollar price to USDC base units (6 decimals).
export function dollarsToUsdcBaseUnits(dollars: number): bigint {
  return BigInt(Math.round(dollars * 1_000_000));
}
