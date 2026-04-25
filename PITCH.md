# Pitch + Feedback

## 90-second demo video — shot list, voiceover, timing

Total runtime: 90 seconds. ~245 words at ~165 words/min — tight but practiced-deliverable.
Three required views per Circle support guidance: **Circle Developer Console → OracleMesh app → Arc Block Explorer.**

| Time | Shot | What's on screen (action) | Voiceover (word-for-word) |
|---|---|---|---|
| **0:00 – 0:08** | **Hook** | Title card: "OracleMesh — specialist LLMs, sub-cent USDC, machine-payable on Arc". Or just the marketplace.html header zoomed in. | *"You shouldn't pay 405-billion-parameter prices for 7-billion-parameter answers. OracleMesh routes each prompt to the cheapest specialist that can handle it — billed in sub-cent USDC on Arc."* |
| **0:08 – 0:22** | **Shot 1 · Circle Console** (14s) | (a) Open `console.circle.com` → Wallets list. Mouse-hover the row `6ae9c0ee…79172` / `0x6bdb…fb270` / Arc Testnet / Live. (b) Click that row → wallet detail page opens, showing 20 USDC native balance. (c) Click **Transactions** tab → 2 inbound funding rows with on-chain TX hashes. | *"Circle Developer Console — our seller wallet on Arc Testnet, status Live, twenty USDC funded. Every paid inference in OracleMesh settles to this address through Circle's Gateway-batched x402."* |
| **0:22 – 0:50** | **Shot 2 · OracleMesh app, end-to-end** (28s) | (a) Switch to `marketplace.html` tab. Wallet strip at top shows `0x3aA8…575d` and current balances. (b) Click **Quote** on the medical card → Gemini reasoning text appears + per-call price `$0.001600`. (c) Click **Pay & Get Answer** → brief spinner → receipt prints `$0.0095 USDC paid · OpenBioLLM 8B`, answer renders. (d) Scroll to the **chat panel** below. Type `What is 2+2?` → Quote → Pay. Receipt shows ~`$0.000216 USDC`. (e) Switch to `dashboard.html` tab — live counter ticking, model-distribution bar. | *"Here's the marketplace. I click Quote on the medical card — Gemini routes to OpenBioLLM, prices it in real time. Pay and get the answer — settled on Arc in under a second.*<br><br>*Below it the chat panel: same router, per-call dynamic pricing. Tiny prompt, tiny charge. That's Usage-Based Compute Billing.*<br><br>*The dashboard shows it live — over four hundred settlements on chain, six different specialists invoked, every single call under one cent."* |
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

The full consolidated response — structured to Circle's exact 5 sub-prompts (Products Used / Use Case / Successes / Challenges / Recommendations) — lives in the dedicated [`FEEDBACK.md`](FEEDBACK.md) file in this repo. That's the artifact to copy-paste into the lablab submission form's "Circle Product Feedback" field.

Brief preview of what's in there:

- **Products Used:** Arc Testnet, USDC, Circle Gateway (`@circle-fin/x402-batching`), Circle Nanopayments, Developer Console, Dev-Controlled Wallets (`@circle-fin/developer-controlled-wallets`)
- **Use Case:** sub-cent per-call settlement is the only economic path for pay-per-inference at this scale; Circle's batched x402 is the only production rail that makes it viable
- **6 specific successes**, including the one-line `gateway.require("$0.01")` ergonomics, USDC-as-gas, and `searchTransfers()` paying off for our submission evidence
- **8 numbered challenges** with debugging-time costs (contract addresses, conceptual map missing, dynamic pricing forces SDK downgrade, undocumented `validBefore` minimum, no batched-settlement explorer view, DC Wallets read-only, signature-domain mismatch error message, the "Gateway Wallet" name collision)
- **8 ranked recommendations** — each one tied directly to a friction point. Top ask: a callback variant `gateway.require((req) => price)` for dynamic pricing. Second: expose `transactionHash` on transfer records.
