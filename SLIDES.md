# Slide Presentation outline

Built to be flippable in ~3-4 minutes alongside the 90-sec video, OR rendered as a static deck for the submission. 12 slides, screen-recorder-friendly (16:9, dark background, large type). Speaker notes are in italics under each slide.

---

## Slide 1 — Title
**OracleMesh**
*Specialist LLMs, sub-cent USDC, machine-payable on Arc.*

> *Hackathon: Build the Agentic Economy on Arc using USDC and Nanopayments. Tracks: Per-API Monetization · Usage-Based Compute Billing · Real-Time Micro-Commerce · Featherless Routing · Gemini Function Calling.*

---

## Slide 2 — The problem
General-purpose LLMs charge for capabilities you don't use. A coding question doesn't need a 405B reasoning model — a 7B specialist will answer it for **1/100th the compute**. But you couldn't *bill* a 7B specialist per call, because per-call payment rails at sub-cent scale didn't exist.

> *Read this almost verbatim — it's the hook.*

---

## Slide 3 — The product
A POST endpoint. Send a prompt. Gemini routes it to the cheapest specialist on Featherless. You pay in sub-cent USDC on Arc Testnet via Circle's batched x402.

```
POST /infer    → flat $0.0095 per call (Per-API Monetization)
POST /infer/metered → per-call dynamic price (Usage-Based Billing)
```

> *Two endpoints because the project competes in two distinct Circle tracks. Both settle on Arc the same way.*

---

## Slide 4 — Why this is impossible without Circle Nanopayments

| Rail | Buyer gas | Processor take | Net to seller |
|---|---|---|---|
| Stripe (per-call, $0.003 inference) | — | $0.30 + 2.9% | **−$0.297** ❌ |
| USDC on Ethereum L1 | $0.20+ | — | **−$0.197** ❌ |
| **USDC on Arc + Nanopayments** | $0.00 (gasless) | — | **+$0.0029** ✅ |

> *The slide that wins. Read the bottom row out loud.*

---

## Slide 5 — How it works (architecture)
```
 Browser ──▶ Express server ──▶ Gemini 3 Flash (function call)
                                 │
                                 ▼
                       Featherless API (specialist runs)
                                 ▲
                                 │
   Buyer wallet ─signs EIP-3009─▶ Circle Gateway-batched x402
                                 │
                                 ▼
                Arc Testnet (USDC settled per call)
```

> *Three external services, one chain, gasless from the buyer's perspective.*

---

## Slide 6 — Live: the marketplace
[Screenshot of `marketplace.html` showing 3 shelf cards + the chat panel]

Three shelf cards = three different specialists, three different per-call prices, all settled in real USDC. The chat panel uses the metered endpoint for per-prompt dynamic pricing.

> *Optional: insert a 5-sec gif of clicking Quote → Pay & Get Answer on one card.*

---

## Slide 7 — Live: the burst
[Screenshot of `dashboard.html` mid-burst, showing the live counter]

`npm run burst` fires 100 paid inferences at concurrency 3. Each one settles on-chain via Circle's batched x402 facilitator.

> *Mention: 96/100 success rate in our most recent burst, sub-cent average cost, 6 different specialist models invoked.*

---

## Slide 8 — On-chain evidence (Arc Testnet)

Both Circle hard requirements satisfied — derived directly from on-chain Circle records:

| Requirement | Result |
|---|---|
| **50+ on-chain transactions** | ✅ **400+ settled** (auditable via `npm run evidence`) |
| **Per-action pricing ≤ $0.01** | ✅ **100.0%** under $0.01 · max **$0.009500** · mean **$0.008668** |
| Total USDC moved buyer → seller | ~$3.6 USDC |
| Buyer wallet | `0x3aA8…575d` |
| Seller wallet | `0x6bdb…b270` |
| Sample on-chain Gateway deposit tx | `0x8a1ef1ec…` |

> *Numbers continually growing; re-derive any time with `npm run evidence`. 8× over the Circle 50-tx threshold.*

---

## Slide 9 — Featherless track (specialist routing)
Catalog: 8 fine-tuned specialists. Most-routed:
- Llama 3.1 8B (general workhorse) — 53 of 96 burst calls
- Qwen2.5 Coder 7B — 12
- OpenBioLLM 8B — 7
- Saul 7B (Legal) — 7
- Suzume Llama3 8B Multilingual — 3
- UnslopNemo 12B — 2

Bench result: router was **77% cheaper** than always-Llama-70B baseline.

> *Each routing decision visible in the marketplace UI as Gemini's reasoning text.*

---

## Slide 10 — Gemini track (function calling)
Snippet from `router.ts`:

```ts
ai.models.generateContent({
  model: "gemini-3-flash-preview",
  config: {
    tools: [{ functionDeclarations: [routeFunction] }],
    toolConfig: { functionCallingConfig: { mode: ANY, allowedFunctionNames: ["route_task"] } },
  }
})
```

The function schema IS the contract — Gemini cannot return free text. Cascade fallback to `gemini-2.5-flash-lite` if the primary is throttled, then a deterministic keyword router so the system never fails.

> *Show the actual code on screen for ~2 seconds.*

---

## Slide 11 — Circle product feedback (excerpts from PITCH.md)
Three concrete improvements we'd ship:
1. **`gateway.require((req) => price)` callback variant** — let dynamic pricing keep the high-level ergonomics instead of dropping to BatchFacilitatorClient.
2. **3-day `validBefore` minimum is currently undocumented.** One sentence in the buyer quickstart prevents an hour of debugging.
3. **Expose `transactionHash` on transfer records.** Today the API tells us a transfer is `completed` but not which on-chain settle tx delivered it. We had to write `txs.ts` ourselves.

> *Read this if pitching for the $500 Product Feedback prize. Specific > vague.*

---

## Slide 12 — Close
**OracleMesh** — specialist LLMs, sub-cent pricing, machine-payable.

GitHub: `[YOUR-USERNAME]/oraclemesh`
Live demo: `[YOUR-CLOUDFLARE-OR-VERCEL-URL]`
On-chain proof: 400+ settled inferences on Arc Testnet (100% under $0.01)
Built on: Circle Arc + USDC + Gateway Nanopayments + Featherless + Gemini

> *5 seconds. Tagline + URLs.*
