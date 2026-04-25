# Pitch + Feedback

## 90-second demo video — shot list, voiceover, timing

Total runtime: 90 seconds. ~245 words at ~165 words/min — tight but practiced-deliverable.
Three required views per Circle support guidance: **Circle Developer Console → OracleMesh app → Arc Block Explorer.**

| Time | Shot | What's on screen (action) | Voiceover (word-for-word) |
|---|---|---|---|
| **0:00 – 0:08** | **Hook** | Title card: "OracleMesh — specialist LLMs, sub-cent USDC, machine-payable on Arc". Or just the marketplace.html header zoomed in. | *"You shouldn't pay 405-billion-parameter prices for 7-billion-parameter answers. OracleMesh routes each prompt to the cheapest specialist that can handle it — billed in sub-cent USDC on Arc."* |
| **0:08 – 0:22** | **Shot 1 · Circle Console** (14s) | (a) Open `console.circle.com` → Wallets list. Mouse-hover the row `6ae9c0ee…79172` / `0x6bdb…fb270` / Arc Testnet / Live. (b) Click that row → wallet detail page opens, showing 20 USDC native balance. (c) Click **Transactions** tab → 2 inbound funding rows with on-chain TX hashes. | *"Circle Developer Console — our seller wallet on Arc Testnet, status Live, twenty USDC funded. Every paid inference in OracleMesh settles to this address through Circle's Gateway-batched x402."* |
| **0:22 – 0:50** | **Shot 2 · OracleMesh app, end-to-end** (28s) | (a) Switch to `marketplace.html` tab. Wallet strip at top shows `0x3aA8…575d` and current balances. (b) Click **Quote** on the medical card → Gemini reasoning text appears + per-call price `$0.001600`. (c) Click **Pay & Get Answer** → brief spinner → receipt prints `$0.0095 USDC paid · OpenBioLLM 8B`, answer renders. (d) Scroll to the **chat panel** below. Type `What is 2+2?` → Quote → Pay. Receipt shows ~`$0.000216 USDC`. (e) Switch to `dashboard.html` tab — live counter ticking, model-distribution bar. | *"Here's the marketplace. I click Quote on the medical card — Gemini routes to OpenBioLLM, prices it in real time. Pay and get the answer — settled on Arc in under a second.*<br><br>*Below it the chat panel: same router, per-call dynamic pricing. Tiny prompt, tiny charge. That's Usage-Based Compute Billing.*<br><br>*The dashboard shows it live — three hundred and sixty-two settlements so far, six different specialists invoked."* |
| **0:50 – 1:08** | **Shot 3 · Arc Block Explorer** (18s) | (a) New tab → `https://testnet.arcscan.app/address/0x3aA8aAD4A9EB432a681B026f59D6BbD10641575d`. Buyer wallet — show the 4 user transactions (2 USDC approves + 2 Gateway deposits). Hover or click `0x8a1ef1ec…`. (b) Switch tab → `https://testnet.arcscan.app/address/0x0077777d7eba4688bdef3e311b846f25870a19b9`. Gateway contract — show the most-recent batched `settle` call rows. | *"Arc Block Explorer. Buyer wallet — the Gateway approvals and deposits ARE the on-chain payment evidence.*<br><br>*The Gateway contract — Circle's facilitator submits batched settle calls. Three hundred sixty-two paid inferences aggregate into a handful of on-chain settles. That's why we can charge sub-cent."* |
| **1:08 – 1:25** | **The margin slide** (17s) | Display the README margin table fullscreen, or a slide with three rows: **Stripe / Ethereum L1 / Arc+Nanopayments** with the per-call net-to-seller numbers. | *"Same three-millicent inference loses you twenty-nine cents on Stripe. Loses you twenty cents per call on Ethereum L1. On Arc with Circle Nanopayments — gas is effectively zero, you net the full amount. This product is mathematically impossible without Circle's stack."* |
| **1:25 – 1:30** | **Close** (5s) | OracleMesh logo + GitHub URL + live demo URL on screen. | *"OracleMesh. Specialist models, sub-cent pricing, machine-payable. Built for the agentic economy that's actually here."* |

### Tab-prep checklist (open these BEFORE you press record)

| # | Tab | URL |
|---|---|---|
| 1 | Circle Console | `https://console.circle.com` (logged in, on the Wallets list) |
| 2 | OracleMesh marketplace | `https://your-cloudflare-tunnel.../marketplace.html` |
| 3 | OracleMesh dashboard | `https://your-cloudflare-tunnel.../dashboard.html` |
| 4 | arcscan — buyer wallet | https://testnet.arcscan.app/address/0x3aA8aAD4A9EB432a681B026f59D6BbD10641575d |
| 5 | arcscan — Gateway contract | https://testnet.arcscan.app/address/0x0077777d7eba4688bdef3e311b846f25870a19b9 |
| 6 | (optional) Margin slide | from `SLIDES.md` slide #4, or a screenshot of the README economic-proof table |

### Delivery tips

- **Record at 1080p or 1440p**. Loom / OBS / QuickTime are all fine.
- **Mic check first.** Echo or hum will reduce judge impression more than anything else. Use a headset mic if possible; AirPods are acceptable.
- **Pre-fire the burst before pressing record** so the dashboard counter starts non-zero. `npm run burst` runs ~18 min — fire it once an hour before recording.
- **Pre-quote the medical card** (so Pay & Get Answer is one click away — saves 3s of router latency in the recording).
- **One-take it if you can.** Re-records are allowed but the natural-tempo single take usually scores higher than the over-edited one.
- **Pause for half a beat** between Shot 2 and Shot 3. The "by design, batched into a handful of on-chain settles" line lands harder if there's a tiny gap.
- **Don't apologize for testnet.** It's a hackathon. Sub-cent payments on testnet ARE the proof.

---

## Circle Product Feedback (for the $500 incentive)

> Below is feedback structured as Circle asked: detailed, builder-perspective, specific to what we hit while building.

### Which Circle products we used

- **Arc Testnet** — settlement L1
- **USDC** — both as the asset *and* as Arc's native gas token (this design choice is quietly transformative)
- **Circle Gateway** (`@circle-fin/x402-batching`) — the entire payment rail, both `createGatewayMiddleware` on the server side and `GatewayClient` on the buyer side
- **Circle Developer Console** — DC Wallet management (the seller wallet for OracleMesh is a DC Wallet from our prior `nanopay-api` build)
- **Circle Nanopayments** — the gasless, sub-cent variant of Gateway, which is what makes this product economically viable

### What worked exceptionally well

The `@circle-fin/x402-batching` SDK is the single best piece of payments tooling we've ever integrated. Going from "I have an Express endpoint" to "this endpoint is gated behind a per-request USDC payment" is genuinely one line: `gateway.require("$0.01")`. That's the right level of abstraction. It hides the EIP-3009 signature dance, the facilitator round-trip, the network ID juggling — but doesn't hide the *concept*, so when we needed dynamic per-request pricing (our router decides the price after seeing the task), dropping down to `BatchFacilitatorClient.settle()` directly was a 15-minute change. Two-tier API design done right.

The Arc testnet faucet → Gateway deposit → first paid call loop took us about 40 minutes from a cold start. By blockchain standards that's miraculous.

USDC-as-gas is a quietly transformative design choice for developer experience. Not having to think about a separate volatile token to top up is one less concept to teach our teammates.

### Friction we hit

1. **Contract addresses are hard to find.** The seller quickstart hardcodes `verifyingContract: "0x..."` with literal ellipses. We had to dig through `docs.arc.network/arc/references/contract-addresses` and the Wallets contract page to assemble the right pair of addresses (USDC + Gateway batched). Putting a worked example with the actual Arc testnet addresses inline in the seller quickstart would have saved us 30 minutes. **Suggestion:** auto-generate the quickstarts per testnet so the addresses are pre-filled.

2. **The relationship between Nanopayments, Gateway, x402, and CCTP isn't crisp from the docs.** A single landing page that says "here's the agent payments stack: x402 is the protocol, Gateway is the unified-balance layer, Nanopayments is what you call the gasless variant, CCTP is for one-shot crosschain moves" — explicitly ranking which one to reach for in which situation — would help every newcomer. We worked it out from blog posts, not docs.

3. **Dynamic pricing forces SDK downgrade.** `gateway.require("$X")` only takes a static string. For our case (price depends on the routed model + token estimate) we had to drop to `BatchFacilitatorClient`, manually construct payment requirements, and base64-decode signatures ourselves. A `gateway.require((req) => quotePrice(req))` callback variant would let us keep the high-level ergonomics. This is the single highest-leverage SDK addition we'd ask for.

4. **The 3-day minimum `validBefore` on EIP-3009 authorizations is correct but undocumented as a footgun.** We discovered it by getting a rejection. A single sentence in the buyer quickstart ("Gateway requires authorizations valid for at least 3 days; the SDK handles this for you, but if you craft signatures manually, set `validBefore >= now + 3 days`") would prevent that hour of debugging.

5. **No batched-settlement explorer view.** When you fire 100 calls, you want one screen that says "those 100 nanopayments aggregated into these 4 on-chain settlement transactions, here are the hashes." Today we have to infer it from the seller wallet's incoming transfers on arcscan. We worked around this by writing `txs.ts` (in this repo) which queries `GatewayClient.searchTransfers()` and dumps every paid call as JSON — see [`submission-evidence/all-paid-calls.json`](submission-evidence/all-paid-calls.json) (362 entries) for the artifact. But doing this client-side is wrong; the right place is the Circle developer console, ideally one click away from the buyer/seller wallet pages. Bonus ask: expose the on-chain `transactionHash` of the parent batch on each transfer record — today the API tells us a transfer is `completed` but not which on-chain settle tx delivered it. A "Nanopayments dashboard" — even read-only — would be a killer demo aid for everyone building on this.

6. **DC Wallets in Console are read-only for transfers.** The Console shows DC wallets, balances, and transactions tab beautifully — but there's no "Send" button to initiate a transfer from the UI. For demos that need a fresh Console-initiated transaction, you have to drop to the `@circle-fin/developer-controlled-wallets` SDK. Adding even a very simple "Send USDC" button on the wallet detail page (with the existing API call wired behind it) would close a real gap for demoware and small-team workflows.

7. **Featherless model availability isn't queryable from the SDK.** We curated 8 models in our catalog by reading the Featherless website, but a programmatic "is this model currently warm and serving?" check would let our router fall back gracefully instead of erroring after payment. (This is more a Featherless ask than Circle, but flagging since our project sits across both.)

### What we'd build next if we win

A two-sided "Featherless model marketplace": specialist providers list their fine-tuned model with a per-call price, the router picks based on quality history + price, and revenue routes via Nanopayments to the model owner's wallet on Arc — all pull-based, settled per inference. The infrastructure to do this exists today; it's just glue code on top of what we built this weekend.
