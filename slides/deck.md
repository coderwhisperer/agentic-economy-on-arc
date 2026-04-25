---
marp: true
theme: default
class: invert
size: 16:9
paginate: true
backgroundColor: '#0c0e10'
color: '#e8e8e3'
style: |
  section {
    font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
    padding: 48px 64px;
  }
  h1, h2, h3 {
    font-family: 'Fraunces', ui-serif, Georgia, serif;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: #e8e8e3;
  }
  h1 { font-size: 56px; line-height: 1.1; }
  h2 { font-size: 40px; line-height: 1.15; }
  h3 { font-size: 28px; }
  em { color: #d6a256; font-style: italic; }
  strong { color: #d6a256; }
  code { background: #14181c; padding: 2px 6px; border-radius: 3px; color: #d6a256; }
  table { border-collapse: collapse; font-size: 22px; }
  th, td { padding: 10px 16px; border-bottom: 1px solid #2a2f36; text-align: left; }
  thead th { color: #8a8f96; font-size: 14px; text-transform: uppercase; letter-spacing: 0.18em; }
  blockquote { color: #8a8f96; font-style: italic; border-left: 3px solid #d6a256; padding-left: 18px; }
  pre { background: #14181c; border: 1px solid #2a2f36; padding: 16px; font-size: 18px; }
  ul li, ol li { margin-bottom: 8px; }
  .lead { font-size: 28px; color: #8a8f96; margin-top: -8px; }
  .small { font-size: 16px; color: #8a8f96; }
  section.lead h1 { font-size: 88px; }
  footer { color: #8a8f96; font-size: 14px; }
footer: 'OracleMesh · pay-per-inference on Arc · Circle Nanopayments'
---

<!-- _class: lead invert -->
<!-- _paginate: false -->

# Oracle*Mesh*

<div class="lead">Specialist LLMs · sub-cent USDC · machine-payable on Arc.</div>

<br>

<span class="small">Hackathon: Build the Agentic Economy on Arc using USDC and Nanopayments</span>

---

## The problem

General-purpose LLMs charge for capabilities you don't use.

A coding question doesn't need a 405B reasoning model — a 7B specialist will answer it for **1/100th the compute**.

But you couldn't *bill* a 7B specialist per call, because per-call payment rails at sub-cent scale didn't exist.

---

## The product

A POST endpoint. Send a prompt. Gemini routes it to the cheapest specialist on Featherless. You pay sub-cent USDC on Arc via Circle's batched x402.

```
POST /infer            → flat $0.0095 per call    (Per-API Monetization)
POST /infer/metered    → per-call dynamic price   (Usage-Based Compute Billing)
```

Two endpoints, two pricing models, three Circle prize tracks.

---

## Why this is impossible without Circle Nanopayments

The same $0.003 inference, three ways to settle:

| Rail | Buyer gas | Processor take | Net to seller |
|---|---|---|---|
| Card processor (Stripe) | — | $0.30 + 2.9% | **−$0.297** ❌ |
| USDC on Ethereum L1 | $0.20+ | — | **−$0.197** ❌ |
| **USDC on Arc + Nanopayments** | **$0.00** | — | **+$0.0029** ✅ |

> Without Circle's batched Nanopayments, this product is mathematically impossible.

---

## How it works

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

Three external services, one chain, gasless from the buyer's perspective.

---

## Live: the marketplace

![bg right:55% w:90%](../slides/marketplace-shot.png)

Three shelf cards = three specialists, three per-call prices, all settled in real USDC.

A chat panel below uses the metered endpoint for per-prompt dynamic pricing.

<span class="small">(Screenshot in repo if you want the visual; marketplace.html for the live demo.)</span>

---

## Live: the burst

`npm run burst` fires 100 paid inferences at concurrency 3. Each settles on-chain via Circle's batched x402 facilitator.

| Most recent burst | Value |
|---|---|
| Calls | 100 |
| Successful | 96 |
| Total paid | $0.16 USDC |
| Specialists invoked | 6 |
| Avg per call | $0.001662 |

---

## On-chain evidence (Arc Testnet)

| Metric | Value |
|---|---|
| Paid inferences settled (Circle `status=completed`) | **362** |
| Total USDC moved buyer → seller | **$3.108978** |
| Buyer wallet | `0x3aA8…575d` |
| Seller wallet | `0x6bdb…b270` |
| Sample on-chain Gateway deposit tx | `0x8a1ef1ec…` |
| Re-derive yourself | `npm run evidence` |

7× over the Circle 50-tx requirement. JSON + arcscan links shipped in the repo.

---

## Featherless track · specialized routing

Catalog: 8 fine-tuned specialists. Most-routed in our last 100-call burst:

- **Llama 3.1 8B** (general workhorse) — 53
- **Qwen2.5 Coder 7B** — 12
- **OpenBioLLM 8B** — 7
- **Saul 7B (Legal)** — 7
- **Suzume Llama3 8B Multilingual** — 3
- **UnslopNemo 12B** — 2

Bench result: router was **77% cheaper** than always-Llama-70B baseline.

---

## Gemini track · function calling

```ts
ai.models.generateContent({
  model: "gemini-3-flash-preview",
  config: {
    tools: [{ functionDeclarations: [routeFunction] }],
    toolConfig: { functionCallingConfig: { mode: ANY,
      allowedFunctionNames: ["route_task"] } },
  }
})
```

The function schema **is** the contract — Gemini cannot return free text. Cascade fallback to `gemini-2.5-flash-lite` if primary is throttled, then a deterministic keyword router so the system never fails.

---

## Circle product feedback (excerpts)

Three concrete improvements we'd ship:

1. **`gateway.require((req) => price)` callback variant** — let dynamic pricing keep the high-level ergonomics instead of dropping to `BatchFacilitatorClient`.
2. **3-day `validBefore` minimum is undocumented.** One sentence in the buyer quickstart prevents an hour of debugging.
3. **Expose `transactionHash` on transfer records.** Today the API tells us a transfer is `completed` but not which on-chain settle tx delivered it. We had to write `txs.ts` ourselves.

Full feedback in `PITCH.md`.

---

<!-- _class: lead invert -->
<!-- _paginate: false -->

# Oracle*Mesh*

<div class="lead">Specialist models. Sub-cent pricing. Machine-payable.</div>

<br>

<span class="small">Built for the agentic economy that's actually here.</span>

<br>

<span class="small">GitHub: github.com/[your-username]/oraclemesh · Demo: [your-tunnel-url]</span>
