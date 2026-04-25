# OracleMesh

> A pay-per-inference router that sends each task to the cheapest specialized
> open-source model on Featherless, priced and settled in sub-cent USDC on
> Circle's Arc L1 via Nanopayments.

## On-chain evidence (Arc Testnet)

Both Circle hackathon hard requirements satisfied — derived directly from on-chain settlement records via `GatewayClient.searchTransfers()`:

| Requirement | Status | Evidence |
|---|---|---|
| **50+ on-chain transactions** | ✅ **400+ settled** (continually growing) | [`submission-evidence/all-paid-calls.json`](submission-evidence/all-paid-calls.json) — every transfer with status, amount, timestamp |
| **Per-action pricing ≤ $0.01** | ✅ **100.0% of transfers under $0.01** · max **$0.009500** · mean **$0.008668** · min **$0.000213** | Same JSON; audited automatically by `npm run evidence` |
| **Margin explanation** | ✅ in the [economic proof](#the-economic-proof-the-slide-that-wins) section below + `slides/margin.html` for the demo | — |

| Wallet | Address |
|---|---|
| Buyer | [`0x3aA8…575d`](https://testnet.arcscan.app/address/0x3aA8aAD4A9EB432a681B026f59D6BbD10641575d) |
| Seller | [`0x6bdb…b270`](https://testnet.arcscan.app/address/0x6bdb75a49ece3e810ad2fb194da461154c2fb270) |
| Sample on-chain Gateway deposit | [`0x8a1ef1ec…`](https://testnet.arcscan.app/tx/0x8a1ef1ecc6ef63ec6e1b7d40dc7ec982f9e7ea50b6236139c19bc639839fe63e) |

**Refresh the JSON + audit anytime**: `npm run evidence`. Every claim above is re-derivable from Circle's transfer-search API in <2 seconds. 8× over the Circle 50-tx threshold and growing.

**Prize pools this project competes in**
- 🪙 Circle — **Per-API Monetization Engine** (primary)
- 🧮 Circle — **Usage-Based Compute Billing**
- 🛒 Circle — **Real-Time Micro-Commerce Flow**
- 🎯 Featherless — **Specialized Model Routing Engine**
- 🧠 Gemini — **Function Calling + multimodal agent**
- 💡 Circle — **Product Feedback Incentive** ($500 pool, separate)

---

## The 30-second pitch

General-purpose LLMs charge for capabilities you don't use. A coding question doesn't need a 405B reasoning model — a 7B specialist will answer it for 1/100th the compute. But you couldn't *bill* a 7B specialist for one answer because per-call payment rails at sub-cent scale didn't exist.

**OracleMesh fixes the billing layer.** Gemini 3 Flash classifies each incoming task, picks the cheapest Featherless model that meets quality requirements, quotes a per-call price in USDC, and the buyer pays via gasless x402 on Arc. Per-call margin is a fraction of a cent — viable only because Circle Nanopayments batches settlement so buyer-side gas is effectively zero.

## The economic proof (the slide that wins)

Same $0.003 inference, three ways to settle:

| Rail | Buyer gas | Processor take | Net to seller |
|---|---|---|---|
| Card processor (Stripe) | — | $0.30 + 2.9% | **−$0.297** ❌ |
| USDC on Ethereum L1, per-call | $0.20+ | — | **−$0.197** ❌ |
| **USDC on Arc + Nanopayments** | $0.00 (gasless) | — | **+$0.0029** ✅ |

Without Circle's batched Nanopayments, this product is mathematically impossible. With it, it's a real business.

---

## How this submission covers each track

Each Circle track has a specific file + endpoint that *is* the proof. When reviewers ask "where does this satisfy my track?" — point them here.

### 🪙 Per-API Monetization Engine (primary track)
**Proof:** `server.ts` → endpoint `POST /infer`
- Every request is quoted and settled individually in USDC on Arc testnet
- Gemini 3 Flash routes → Featherless runs → Circle Gateway settles via x402
- Run `npm run burst` to fire 100 paid calls in rapid succession — generates the required 50+ on-chain transactions
- View settlement batches on https://testnet.arcscan.app

### 🧮 Usage-Based Compute Billing
**Proof:** `server.ts` → endpoint `POST /infer/metered` + `meter.ts` CLI demo
- Caller authorizes a *cap* via EIP-3009 signature (not a fixed amount)
- Server runs inference, meters actual input + output tokens via Featherless's `usage` field
- Settles for *actual* price = `inputTokens × rateIn + outputTokens × rateOut + routingFee`
- Unused authorization expires — caller is only charged for tokens consumed
- Run `npm run meter` for a 4-row demo: tiny/small/medium/large tasks all authorize the same $0.0095 cap, each settles for a different actual amount
- Token-level price granularity is the defining feature of this track; we deliver it natively

### 🛒 Real-Time Micro-Commerce Flow
**Proof:** `marketplace.html` — a consumer-facing one-page shop
- Three product tiles (Ask a Specialist, Translate Anything, Fix My Code) — each is an interaction, not a subscription
- Live wallet strip shows real USDC balance and Gateway available balance on Arc
- Click "Quote" → Gemini routes, price displays → click "Pay & get answer" → settlement happens → paper-receipt pops up with model used, amount paid, on-chain receipt
- Economic activity is "triggered and settled per interaction" — literally the track brief
- Served by the same server at http://localhost:3000/marketplace.html when you `npm run server`

### 🎯 Featherless — Specialized Model Routing Engine
**Proof:** `catalog.ts` + `router.ts` + `bench.ts`
- 8-model curated catalog covering code, medical, legal, multilingual, creative, math, chat, summarization
- Each task routes to the *smallest* tier that can handle it (router is told: "prefer small, only escalate when needed")
- `npm run bench` runs 10 prompts through (A) the router and (B) a flat Llama 3.1 70B baseline
  - Reports cost delta (expect router to be 60–80% cheaper)
  - Reports Gemini-3-Pro-judged quality win rate
  - This *is* the "improved cost efficiency and output quality" the track brief asks for

### 🧠 Gemini — Function Calling + multimodal
**Proof:** `router.ts`
- `route_task` is a forced function call — the model never emits free text, only structured decisions
- Uses Gemini 3 Flash for routing (transactional, low-latency) per the track's model recommendation
- Uses Gemini 3 Pro as judge in `bench.ts` (advanced reasoning per the track brief)
- Schema-constrained outputs: category, complexity, model ID, token estimate, reasoning

### 💡 Feedback Incentive
**Proof:** The "Feedback" section of `PITCH.md` — 600+ words of specific, builder-perspective feedback on what Circle got right, what friction we hit, and what we'd build next. Paste verbatim into the lablab submission form.

---

## File layout

```
oraclemesh/
├── README.md            # this file
├── PITCH.md             # 90-sec video script + feedback prize submission
├── CLAUDE_CODE_HANDOFF.md  # verification checklist for Claude Code
├── catalog.ts           # 8-model catalog + flat AND metered pricing functions
├── router.ts            # Gemini Function Calling routing agent
├── server.ts            # Express — /infer, /infer/metered, /buy, /wallet-info, /stats
├── client.ts            # Node buyer client around Circle's GatewayClient
├── meter.ts             # Usage-based billing CLI demo (for track 🧮)
├── burst.ts             # Fires 100 paid inferences (for Circle's 50+ tx requirement)
├── bench.ts             # Router-vs-baseline cost+quality comparison (for 🎯)
├── marketplace.html     # Consumer-facing shop (for track 🛒)
├── dashboard.html       # Live stats dashboard for the demo video
├── package.json
├── tsconfig.json
└── .env.example
```

## Quickstart

```bash
# 1. Install
npm install

# 2. Fill in keys (4 values — Gemini, Featherless, PRIVATE_KEY, SELLER_ADDRESS)
cp .env.example .env
# edit .env

# 3. One-time: fund Gateway balance on Arc testnet
npm run setup

# 4. Run the server (also serves marketplace.html + dashboard.html)
npm run server

# In another terminal…

# 5. Prove each track:
npm run try                              # Track 🪙 — one paid inference
npm run burst                            # Track 🪙 at volume — 100 paid txs
npm run meter                            # Track 🧮 — metered billing demo
open http://localhost:3000/marketplace.html    # Track 🛒 — consumer UI
npm run bench                            # Track 🎯 — cost+quality benchmark
npm run route "your task"                # Track 🧠 — routing alone, no payment
```

## Submission checklist

- [ ] `.env` filled in, Arc testnet USDC funded, Gateway balance deposited
- [ ] `npm run server` running without errors
- [ ] `npm run burst` completed — 50+ on-chain txs visible on arcscan
- [ ] `npm run meter` completed — screenshot of the 4-row table
- [ ] `marketplace.html` demoed end-to-end (wallet → quote → pay → receipt)
- [ ] `npm run bench` completed — screenshot of cost+quality summary
- [ ] Demo video (90s, PITCH.md has script)
- [ ] Lablab form: tick boxes for all 5 tracks claimed
- [ ] Lablab feedback field: paste the feedback from PITCH.md (don't skip — $500)
- [ ] GitHub repo public, README as the landing page
