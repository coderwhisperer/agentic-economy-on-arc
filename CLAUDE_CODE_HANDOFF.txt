# Claude Code Handoff — OracleMesh

You're picking this project up in Claude Code. Previous Claude (web chat) wrote the skeleton using up-to-date knowledge of Circle's x402, Featherless, and Gemini 3 Flash APIs as of April 2026, but **the TypeScript has not been executed**. Your job is to install, test, and fix any small integration gaps — then produce the demo video and submit.

## Rule #1 — use the real SDKs

The project uses these packages (all exist on npm today — April 2026):

| Purpose | Package |
|---|---|
| x402 server middleware (Express) | `@x402/express` |
| x402 buyer (wraps fetch) | `@x402/fetch` |
| x402 core types | `@x402/core` |
| x402 EVM scheme | `@x402/evm` |
| Gemini 3 Flash + function calling | `@google/genai` |
| Featherless (OpenAI-compatible) | `openai` (pointed at `https://api.featherless.ai/v1`) |
| EVM wallet client | `viem` |

If you find older references in conversation history to `@circle-fin/x402-batching`, `BatchFacilitatorClient`, or `GatewayClient` — **ignore them, those were wrong**. The current `server.ts` and `client.ts` use the packages above.

## Rule #2 — verify in dependency order

Each step unlocks the next. Don't skip ahead.

```
Step A: npm install && npm run route "fix this regex: /\d+/g"
  → tests: Gemini 3 Flash + function calling
  → unlocks: Gemini partner track 🧠

Step B: npm run bench
  → tests: Gemini + Featherless end-to-end (no payment needed)
  → unlocks: Featherless partner track 🎯

Step C (one-time): npm run setup
  → verifies env vars, prints buyer wallet address
  → ACTION: send testnet USDC to that address via faucet.circle.com

Step D: npm run server   (in another terminal: npm run try)
  → tests: the full x402 payment loop
  → unlocks: Circle Per-API Monetization Engine 🪙

Step E: npm run burst
  → tests: the loop at volume, fires 100 paid inferences
  → satisfies: Circle's "50+ on-chain transactions" requirement

Step F: npm run meter
  → tests: metered/usage-based billing flow
  → unlocks: Circle Usage-Based Compute Billing 🧮

Step G: open http://localhost:3000/marketplace.html
  → tests: consumer UI flow
  → unlocks: Circle Real-Time Micro-Commerce 🛒
```

Each green checkmark = one more prize pool eligible.

## File status

| File | What it does | Risk |
|---|---|---|
| `package.json` | Deps + scripts | Low |
| `tsconfig.json` | TS config | Low |
| `.env.example` | Required env vars documented | Low |
| `catalog.ts` | 8 Featherless models + flat + metered pricing | Low — pure logic, no SDKs |
| `router.ts` | Gemini Function Calling agent + keyword fallback | **Medium** — verify `@google/genai` v1 signature. If imports fail, look at the current `GoogleGenAI` class shape. |
| `client.ts` | Buyer wrapper around `@x402/fetch` + viem | **Medium** — verify `wrapFetchWithPayment` signature |
| `setup.ts` | Pre-flight env check | Low |
| `server.ts` | Express app, x402 middleware, metered endpoint, marketplace bridge | **HIGH** — 260 lines of integration code. Most likely place for fixes. |
| `burst.ts` | 100 paid inferences + margin story | Low — uses `client.ts` |
| `meter.ts` | 4-row usage-based demo | Low — uses `client.ts` |
| `bench.ts` | Router-vs-baseline quality+cost | Low — no payment stack |
| `marketplace.html` | Consumer shop UI | Low — static HTML |
| `dashboard.html` | Live burst counter | Low — static HTML |

## Known gaps that need your attention

### 1. Confirm the x402 package API surfaces
The code imports:
```ts
import { paymentMiddleware, x402ResourceServer, type Route } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { wrapFetchWithPayment } from "@x402/fetch";
```

If TypeScript complains after `npm install`, the fastest fix is:
> "Look at the actual `.d.ts` files in `node_modules/@x402/*` and adjust the imports/usage in `server.ts` and `client.ts` to match."

The pattern is stable (it's the canonical Coinbase sellers quickstart shape) but minor version drift can happen.

### 2. Network ID for Arc testnet
`server.ts` defaults `X402_NETWORK=eip155:421614` (Arbitrum Sepolia) because that's guaranteed-supported. For the Circle prize tracks, flip this to **Arc testnet's CAIP-2 identifier** in `.env`. Ask Claude Code:

> "Fetch https://docs.arc.network/arc/references/contract-addresses.md and tell me the chain ID for Arc testnet. Update `.env` with `X402_NETWORK=eip155:<id>`."

### 3. Circle's Gateway facilitator URL
`FACILITATOR_URL` defaults to the public `x402.org/facilitator` (Base Sepolia only). For the Circle tracks you need Circle's Gateway facilitator, which is in active development.

> "Search Circle docs for the Nanopayments facilitator URL. Once found, set `CIRCLE_FACILITATOR_URL` in .env."

If Circle's facilitator isn't publicly available yet at submission time, falling back to `x402.org/facilitator` on Base Sepolia still satisfies the x402 payment-on-chain requirement — you'd explain in the submission that the architecture is Circle-ready and show arc-sepolia configured as the production target.

### 4. Gemini SDK version pin
`@google/genai` is pinned to `^1.0.0` in package.json. The real API uses `GoogleGenAI` class with `ai.models.generateContent({...})`. If you get "function is not a function" errors, check which version actually installed and skim its README.

### 5. Featherless model availability
The 8 catalog entries in `catalog.ts` were picked from the Featherless site. Some may be deprecated. After you have FEATHERLESS_API_KEY:

> "Run `curl -H 'Authorization: Bearer $FEATHERLESS_API_KEY' https://api.featherless.ai/v1/models | jq '.data[].id'` and tell me which of the models in catalog.ts are NOT in the response. Replace any missing ones with similar specialists."

## If something breaks during the demo

**Priority order of what to demo vs. skip:**

- Must work: `marketplace.html` showing one successful purchase (this is your video's hero shot)
- Must work: `npm run burst` hitting 50+ transactions (Circle hard requirement)
- Must work: `npm run bench` output (Featherless track proof)
- Nice to have: `npm run meter` (Usage-Based track)
- Nice to have: dashboard live counter
- Skip if broken: Gemini multimodal (we don't claim it)

If the payment rail is flaky right before recording, record the demo with `$FACILITATOR_URL=https://x402.org/facilitator` on Base Sepolia — still real on-chain payments, still x402, still counts. Configure Arc for production and mention it in the voiceover.

## Submission form — tracks to check

- [x] **Circle: Per-API Monetization Engine** (primary)
- [x] **Circle: Usage-Based Compute Billing**
- [x] **Circle: Real-Time Micro-Commerce Flow**
- [x] **Circle: Product Feedback Incentive** ($500 pool — paste from PITCH.md)
- [x] **Featherless: Specialized Model Routing Engine**
- [x] **Gemini: Function Calling + multimodal**

Do NOT check:
- [ ] Agent-to-Agent Payment Loop — excludes batching, which we use. Don't claim it.

## Final deliverables checklist

- [ ] `.env` filled (4 required keys) and Arc testnet USDC in buyer wallet
- [ ] `npm install` completes cleanly
- [ ] Each of Steps A-G above passes
- [ ] Burst produces 50+ successful transactions visible on arcscan
- [ ] 90-second demo video recorded (script in `PITCH.md`)
- [ ] GitHub repo public
- [ ] Lablab submission form filled, all 6 track boxes ticked
- [ ] Lablab feedback field filled (copy-paste from `PITCH.md` → "Feedback" section)
