# Circle Product Feedback (consolidated response)

> This is the consolidated response for the lablab.ai / Circle hackathon's required "Circle Product Feedback" field. Copy-paste from below into the form. Structured to Circle's five sub-prompts (Products Used / Use Case / Successes / Challenges / Recommendations).

---

## Products Used

We used the following Circle products in OracleMesh:

- **Arc Testnet** — settlement L1 for every paid inference (chain ID `5042002` / `eip155:5042002`).
- **USDC on Arc** — both as the unit of account *and* as Arc's native gas token. The contract at `0x3600000000000000000000000000000000000000`.
- **Circle Gateway** — the unified-balance / batched-settlement layer. We used the deployed Gateway contract `0x0077777d7eba4688bdef3e311b846f25870a19b9` directly via:
  - `@circle-fin/x402-batching/server` → `createGatewayMiddleware` for the Express seller path
  - `@circle-fin/x402-batching/client` → `GatewayClient` for the buyer wallet (signing + deposits + balance reads + `searchTransfers`)
- **Circle Nanopayments** — the gasless x402 variant of Gateway. This *is* the rail OracleMesh runs on; it's what makes sub-cent per-call billing economically viable.
- **Circle Developer Console** — for managing Dev-Controlled Wallets on Arc Testnet. Our seller address is wrapped by a DC Wallet (`6ae9c0ee-9baf-5919-ae30-2bfcec179172`) carried over from a prior project; the OracleMesh flow uses that address as a Gateway-registered recipient, but the underlying DC wrapper let us programmatically fire a Console-visible USDC transfer for the demo via `@circle-fin/developer-controlled-wallets`.

We did **not** use CCTP / Bridge Kit (single-chain demo, no cross-chain need).

## Use Case

OracleMesh is a pay-per-answer LLM router. Each inbound prompt is classified by Gemini 3 Flash via function-calling and routed to the cheapest specialist on Featherless that can answer it well. The buyer is charged sub-cent USDC per call. The product only makes economic sense if per-call settlement costs are effectively zero — a $0.003 inference loses money on every traditional rail (Stripe takes ~$0.30 + 2.9%; an ERC-20 transfer on Ethereum L1 costs $0.20+ in gas). On Arc + Circle Nanopayments the buyer pays no gas (USDC *is* the native asset, authorizations are batched off-chain by Circle's facilitator and settled in bulk), so the seller nets the full quoted amount. We chose Circle's stack specifically because the batched x402 model is, as far as we know, the only production rail today that can settle a one-millicent payment without losing money to overhead.

We chose the Developer Console + DC Wallets for the demo evidence trail (so judges can audit the seller wallet on Arc directly from Circle's UI, separate from arcscan).

## Successes — what worked exceptionally well

- **`gateway.require("$0.01")` is the right level of abstraction.** Going from "I have an Express endpoint" to "this endpoint is gated behind a per-request USDC payment" is genuinely one line. The SDK hides the EIP-3009 signature dance, the facilitator round-trip, and the network ID juggling — but doesn't hide the *concept*, so when we needed dynamic per-request pricing (our router decides the price after seeing the task) we could drop down to `BatchFacilitatorClient.settle()` directly in 15 minutes. Two-tier API design done right.
- **Faucet → Gateway deposit → first paid call took ~40 minutes from a cold start.** By blockchain standards that's miraculous.
- **USDC-as-gas is a quietly transformative DX choice.** Not having to think about a separate volatile token to top up is one less concept to teach our teammates.
- **`@circle-fin/x402-batching`'s peer-dep design** (it builds on top of canonical `@x402/core` and `@x402/evm`) made it possible to use the standard `x402Client` / `x402ResourceServer` patterns from the Coinbase SDK while substituting Circle's batched scheme — a clean composition.
- **`GatewayClient.searchTransfers()` saved the submission.** When we needed to enumerate every paid call for our submission evidence, this API returned all 400+ entries with status, amount, and timestamp in one paginated call. We dumped it as `submission-evidence/all-paid-calls.json` in the repo, and audit it on every regenerate to confirm 100% of charges stayed under the $0.01 hackathon ceiling.
- **`@circle-fin/developer-controlled-wallets` SDK created a real on-chain transfer in <5 seconds end-to-end.** Entity-secret encryption is handled internally; we just called `client.createTransaction({...})` and got a tx hash back after a single 4s poll. Excellent ergonomics.

## Challenges — what we hit while building

1. **Contract addresses are hard to find.** The seller quickstart hardcodes `verifyingContract: "0x..."` with literal ellipses. We had to dig through `docs.arc.network/arc/references/contract-addresses` and the Wallets contract page to assemble the right pair (USDC + Gateway batched). Cost ~30 minutes of debugging.
2. **The relationship between Nanopayments / Gateway / x402 / CCTP isn't crisp from the docs.** A single landing page that says "x402 is the protocol, Gateway is the unified-balance layer, Nanopayments is the gasless variant, CCTP is for one-shot crosschain moves" — explicitly ranking which one to reach for in which situation — would help every newcomer. We worked it out from blog posts, not docs.
3. **`gateway.require()` only takes a static string.** Our case (price depends on the routed model + token estimate) required dropping to `BatchFacilitatorClient`, manually constructing payment requirements, and base64-decoding signatures ourselves. That's a non-trivial stair-step.
4. **The 3-day minimum `validBefore` on EIP-3009 authorizations is correct but undocumented as a footgun.** We discovered it by getting a `authorization_validity_too_short` rejection. We spent ~1 hour on this before figuring out the minimum.
5. **No batched-settlement explorer view.** When you fire 100 calls, you want one screen that says "those 100 nanopayments aggregated into these 4 on-chain settlement transactions, here are the hashes." Today we have to infer it from the seller wallet's incoming transfers on arcscan — and crucially, **`GatewayClient.searchTransfers()` doesn't expose the on-chain `transactionHash` of the parent batch**, even though the data exists server-side. We worked around this by writing `txs.ts` (in this repo) which dumps every paid call as JSON, but it's a workaround for a missing feature.
6. **DC Wallets in Console are read-only for transfers.** The Console shows DC wallets, balances, and the Transactions tab beautifully — but there's no "Send" button to initiate a transfer from the UI. For demos that need a fresh Console-initiated transaction, you have to drop to the SDK. Adding even a very simple "Send USDC" button on the wallet detail page (with the existing API call wired behind it) would close a real gap for demoware and small-team workflows.
7. **`@x402/evm`'s `ExactEvmScheme` doesn't know about Circle's `GatewayWalletBatched` extra.name.** When we initially (incorrectly) tried to pair `@x402/express`'s `paymentMiddleware` with Circle's facilitator URL, the client signed an EIP-3009 against the USDC contract — but Circle's batched scheme expects the signature against the GatewayWallet contract's domain. We got `invalid_signature` from the facilitator with no explanation of why. The pivot to `@circle-fin/x402-batching/client`'s `BatchEvmScheme` (which signs against the GatewayWallet contract from `extra.verifyingContract`) is the *correct* path, but the failure mode wasn't self-explanatory. A clearer error message (or a worked example showing the dual-SDK distinction) would prevent this confusion.
8. **Concept name collision: "Gateway Wallet".** The phrase is used both for (a) the singleton Gateway *contract* (`0x0077…19b9`) and (b) any EVM address registered with Gateway as a recipient. We confused these on day 1 and spent time looking for a per-address "Gateway Wallet" deployment that doesn't exist. Rename one of them in the docs (e.g. consistently call (b) "Gateway-registered address" or "Gateway recipient").

9. **Arc Testnet is not in `@x402/evm`'s default asset registry.** When using the canonical `paymentMiddleware` from `@x402/express`, calling `gateway.require("$0.0095")` on Arc fails at request time with `No default asset configured for network eip155:5042002` thrown deep in `getDefaultAsset()`. We tried to register a custom `MoneyParser` on the `ExactEvmScheme` instance, but the parser didn't fire on the request path (the default lookup ran first). We worked around it by setting `price` as an `AssetAmount` literal `{ asset: "0x3600…", amount: "9500" }` directly in the route config — but the obvious developer path (`"$0.0095"` string) blows up unhelpfully. Cost: ~30 min.

10. **Facilitator verify-failure errors are encoded in the `PAYMENT-REQUIRED` header (base64), not the response body.** The body is just `{}`. When the facilitator rejected our signed payload with `authorization_validity_too_short` or `invalid_signature`, we initially had no idea what was wrong — the response body was empty and we had to write a server-side interceptor that decoded the base64 PAYMENT-REQUIRED header on every ≥400 response just to surface the actual `error` field. Cost: ~30 min of confusion.

11. **Circle's facilitator reserves a buffer above the strict authorization amount.** Buyer's on-chain Gateway balance was 0.1275 USDC. Authorization for $0.0095 should have been fine (13× headroom). Circle returned `insufficient_balance`. After observing the behavior across multiple attempts and retrying with progressively higher balances, the implicit rule appears to be *"available balance must exceed roughly the next authorization × some buffer"* — perhaps to defend against pending-settlement double-spend. The exact rule is undocumented. **We had to add a `gateway.deposit` top-up step to our burst pre-flight as a result.**

12. **The facilitator URL path `/v1/x402` is undocumented.** Circle docs mention `gateway-api-testnet.circle.com` as the facilitator host but don't say the x402-spec endpoints (`/supported`, `/verify`, `/settle`) live under the `/v1/x402/…` prefix. We discovered the path by probing common patterns until one returned 200. The first thing a developer does when wiring a custom facilitator URL is hit `/supported` to validate it — and that is exactly the hop that's missing from the docs.

13. **`PaymentRequirements` field-name drift between v1 and v2.** v1 used `maxAmountRequired`; v2 uses `amount`. The drift bit us in two places: (a) a `PaymentPolicy` filter we wrote against `r.maxAmountRequired` (caught at compile time by TypeScript, but a JS user wouldn't have noticed), and (b) the metered endpoint's hand-rolled `/settle` POST body (NOT type-checked, would have shipped with the wrong field name if we hadn't refactored to use `BatchFacilitatorClient` directly). A "Migrating from v1" page that lists every renamed field would help.

14. **Downstream-service rate limits compound with x402 retry latency.** Featherless's free tier has TWO distinct 429s — concurrency cap (4 in flight) AND model-switch cap (4 different models per minute) — that share the same HTTP status code. With per-call retries inside the x402 handler, a model-switch 429 could block a Gateway authorization for up to 60 seconds, during which Circle's Gateway accounting may consider the funds reserved. We had to add an `isModelSwitch` heuristic to our retry backoff (12s base for that case vs 800ms for plain concurrency). This isn't strictly Circle's issue, but a doc note saying *"if your endpoint's downstream services can have multi-second retries, ensure your `validBefore` margin and your facilitator reservation buffer accommodate it"* would help future builders.

## Recommendations — concrete asks, ranked

In rough order of leverage for builders:

1. **Add a callback variant of `gateway.require`**: `gateway.require((req) => price)` — let dynamic pricing keep the high-level ergonomics instead of dropping to `BatchFacilitatorClient`. This is the single highest-leverage SDK addition we'd ask for.
2. **Expose `transactionHash` on transfer records.** `GatewayClient.searchTransfers()` returns `id`, `status`, `amount`, `timestamps` — but not the on-chain hash of the batch settle that delivered the payment. Adding `onChainSettlementTxHash` (and `settledAtBlock`) closes the audit-trail gap and removes the need for any client-side scanning workaround.
3. **A batched-settlement dashboard view in Console.** Even read-only. *"These 100 Nanopayments aggregated into these 4 on-chain settles, here are the hashes."* Killer demo aid for everyone building on Nanopayments — and would have saved us writing `txs.ts` ourselves.
4. **Document the 3-day `validBefore` minimum prominently in the buyer quickstart.** One sentence: *"Gateway requires authorizations valid for at least 3 days; the SDK handles this for you, but if you craft signatures manually, set `validBefore >= now + 3 days`"* — would prevent that hour of debugging.
5. **A "stack map" page in Circle docs** that explicitly contrasts x402 / Gateway / Nanopayments / CCTP and tells you which to reach for in which situation.
6. **Auto-generate the seller/buyer quickstarts per-testnet** with the actual addresses inline (USDC + Gateway batched contract addresses, the right facilitator URL for that testnet, RPC endpoints). Today the quickstart shows `0x...` ellipses and you have to assemble the real values from three other pages.
7. **Add a "Send USDC" button to DC Wallet detail pages in the Console.** Wires up the existing API call. Closes the demo / small-team-workflow gap.
8. **Improve facilitator error messages on signature mismatch.** When a buyer signs an EIP-3009 against the wrong domain (e.g. uses canonical `@x402/evm`'s `ExactEvmScheme` against Circle's batched facilitator), the response is `invalid_signature` with no hint that the *signing domain* is wrong vs the signature itself. A line like `invalid_signature: signed against asset domain, expected GatewayWallet domain (verifyingContract = 0x0077…)` would have saved us debugging time.

9. **Add Arc Testnet (`eip155:5042002`) to `@x402/evm`'s default asset map.** This is upstream from Circle (the package is Coinbase-owned) but the pull-through impact is direct: every developer trying to use `@x402/express`'s `paymentMiddleware` on Arc hits the same `No default asset configured` error. Either upstream a PR adding Arc, or document the AssetAmount-literal workaround in the Circle seller quickstart.

10. **Surface facilitator error reasons in the response body for `application/json` requests, not just the `PAYMENT-REQUIRED` header.** A `{ "error": "authorization_validity_too_short" }` body would let any developer see what's wrong without writing a header decoder. The current empty-body behavior is correct per x402 spec but punishing in practice; a content-negotiated alternative for JSON clients would be a strict improvement.

11. **Document the Gateway facilitator's balance-reservation rule.** A short page explaining how `availableBalance` interacts with pending settlements would prevent the "I have N USDC but the facilitator says insufficient_balance for an N/2 spend" surprise. Even a worst-case rule like *"keep at least 4× the largest pending authorization unencumbered"* would let developers right-size their top-ups.

12. **Document `/v1/x402` as the facilitator URL prefix.** In the seller quickstart, change the example facilitator URL from `https://gateway-api-testnet.circle.com` to `https://gateway-api-testnet.circle.com/v1/x402` (or document that the SDK appends `/v1/x402/...` internally — and confirm it does in the `BatchFacilitatorClient` constructor's docstring).

13. **Publish a "PaymentRequirements v1 → v2 migration" reference page.** A two-column table of every renamed/restructured field (`maxAmountRequired` → `amount`, etc.) would close the field-name-drift gap. Especially valuable for projects that hand-roll fetch calls to `/settle` instead of going through the SDK.

## What we'd build next if we win

A two-sided "Featherless model marketplace": specialist providers list their fine-tuned model with a per-call price, the router picks based on quality history + price, and revenue routes via Nanopayments to the model owner's wallet on Arc — all pull-based, settled per inference. The infrastructure to do this exists today; it's just glue code on top of what we built this weekend.
