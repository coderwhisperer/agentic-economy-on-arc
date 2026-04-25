# Submission Form — copy-paste reference

Everything you need to fill out the lablab.ai / Circle hackathon submission form lives here. Open this file alongside the form, copy each block.

---

## Project Title

```
OracleMesh
```

## Short Description (≤ 250 characters)

```
Pay-per-inference router on Circle Arc Testnet. Gemini classifies each prompt; the cheapest specialist model on Featherless answers it; the buyer pays sub-cent USDC via Circle's batched x402. 362 settlements on-chain. Specialist LLMs, machine-payable.
```

(247 chars including spaces.)

## Long Description (3 paragraphs)

```
OracleMesh is a pay-per-answer API for LLM inference. Send a prompt; Gemini 3 Flash classifies it via function-calling and routes it to the cheapest open-source specialist on Featherless that can answer well — OpenBioLLM for clinical questions, Saul for legal, Suzume for translation, Qwen Coder for code, and so on. The result returns to the caller; payment is settled in sub-cent USDC on Arc Testnet via Circle's batched x402 facilitator. No subscription, no credits, no minimums — every call is an atomic financial transaction.

Per-call pricing under one cent breaks every traditional rail. Stripe takes $0.30 per transaction; an ERC-20 transfer on Ethereum L1 costs $0.20+ in gas. The same $0.003 inference would lose the seller money on either rail. On Arc + Circle Nanopayments, buyer-side gas is effectively zero (USDC is the native asset, authorizations are batched off-chain and settled in bulk on-chain), so the seller nets the full revenue. We've completed 362 paid inferences on Arc Testnet during the build, all auditable via Circle's transfer-search API and reproducible with `npm run evidence`. That's 7× over the hackathon's 50-tx threshold.

Two endpoints, two pricing models, three Circle tracks. `/infer` is flat-priced ($0.0095 ceiling) for the Per-API Monetization track. `/infer/metered` quotes a per-call dynamic price from the routed model + estimated tokens for the Usage-Based Compute Billing track. A small marketplace UI (browser → server-held wallet → x402 settle → answer renders) covers the Real-Time Micro-Commerce track. Routing diversity (6+ specialists invoked across a 100-call burst) covers the Featherless Specialized Routing track. Strict-schema function calling in `router.ts` covers the Gemini Function Calling track. The submission also pushes substantive product feedback for the Circle Product Feedback Incentive ($500), including a working prototype (`txs.ts`) for the missing batched-settlement explorer view we wanted Circle to ship.
```

## Technology & Category Tags

**Categories** (pick whichever the form lets you — these are the relevant ones):

```
Payments · AI/ML · Web3/Blockchain · Developer Tools · Agentic Economy · Stablecoins
```

**Technologies**:

```
Circle Arc · USDC · Circle Nanopayments · Circle Gateway · x402 · EIP-3009 · Gemini 3 Flash · Function Calling · Featherless · OpenAI SDK · Llama 3.1 · Qwen 2.5 Coder · OpenBioLLM · Saul · Suzume · viem · TypeScript · Express · Node.js
```

## Tracks (which boxes to check on the form)

- ✅ Circle — **Per-API Monetization Engine** (primary)
- ✅ Circle — **Usage-Based Compute Billing**
- ✅ Circle — **Real-Time Micro-Commerce Flow**
- ✅ Featherless — **Specialized Model Routing Engine**
- ✅ Gemini — **Function Calling + multimodal**
- ✅ Circle — **Product Feedback Incentive** (paste content from `PITCH.md` § "Circle Product Feedback")

## Cover Image

Use the prompt below to generate a logo / cover. Final asset target: **1280×720**, dark background, amber accent.

### Prompt for an image-gen model (GPT/Midjourney/DALL-E)

Paste this verbatim into the image generator:

```
A minimalist editorial logo and cover image for "OracleMesh" — a pay-per-answer LLM marketplace settled in stablecoins.

Design language:
- Dark background, near-black with subtle warm undertone (#0c0e10).
- Single amber/old-gold accent color (#d6a256), used sparingly for one focal element.
- Typography duo: a tall italic serif (think Fraunces or Cormorant Garamond) for "OracleMesh", paired with a small monospaced subtitle (think JetBrains Mono).
- The wordmark "Oracle*Mesh*" with the "Mesh" portion italicized and tinted amber.
- Subtitle in monospace beneath: "specialist LLMs · sub-cent USDC · machine-payable on Arc"

Visual motif (one of these — pick whichever feels strongest):
- A delicate isometric mesh of nodes, each node a tiny coin glyph, with one node glowing amber to signify a "routed" call. Sparse, technical, not busy.
- OR an oracle bone / divinatory crack pattern subtly forming a circuit-board layout, in monochrome charcoal, with one amber spark at a junction.
- OR a single amber drop of liquid (representing a sub-cent payment) about to fall onto a grid of muted gold filaments.

Vibe: confident, restrained, fintech-meets-publication. Think Stripe Press meets a 1960s technical journal cover. NOT crypto-bro neon, NOT cluttered, NOT corporate.

Layout: 16:9 (1280×720). Wordmark + subtitle stacked left or center; the visual motif occupies the negative space. Generous whitespace. The amber is the only color other than ink/paper tones — judges should immediately notice it.

No text other than "Oracle Mesh" wordmark and the subtitle. No emojis. No characters from non-Latin scripts.
```

If you want a *square* version too (Twitter/Discord avatar use): same prompt, 1024×1024, the wordmark stacked, the visual motif behind/around it.

## Video Presentation

90-second screen recording. Script + timing + voiceover all in [`PITCH.md`](PITCH.md) under "90-second demo video — shot list, voiceover, timing". Loom / OBS / QuickTime all work.

Voiceover-only — no face on camera required.

## Slide Presentation

Three artifacts, pick what the form lets you upload:

| Format | File | How to use |
|---|---|---|
| **HTML deck (Marp-rendered)** | [`slides/deck.html`](slides/deck.html) | Open in any browser → submit the file or screenshot pages → can also Print → Save as PDF for a PDF version |
| **Standalone "money slide" HTML** | [`slides/margin.html`](slides/margin.html) | Used for the 1:08–1:25 segment of the video. Press F11 in browser for fullscreen. |
| **Slide outline + speaker notes (markdown)** | [`SLIDES.md`](SLIDES.md) | Authoritative source if you want to re-render in a different tool. |

If the form requires a single PDF: open `slides/deck.html` in Chrome → File → Print → Save as PDF (landscape, 16:9 or A4 landscape).

## Public GitHub Repository

Push the local repo first:

```bash
cd /home/aa/llai/arc/oraclemesh/oraclemesh
gh repo create oraclemesh --public --source=. --remote=origin --push
# OR manually:
# create repo at https://github.com/new (name: oraclemesh, public, no README)
git remote add origin https://github.com/<your-username>/oraclemesh.git
git branch -M main
git push -u origin main
```

Confirmed clean: no `.env` staged, MIT licensed, evidence JSON included.

## Demo Application Platform / Application URL

For the hackathon window, your live URL is the **Cloudflare temporary tunnel** running locally. Expect to keep it alive for 24-48h around the submission window.

Stable alternative if tunnels expire: deploy `server.ts` to Vercel / Render / Railway. The codebase is a single Node + Express service with no DB — should fit any free tier in <10 minutes.

## Circle Product Feedback (required field)

**Paste from [`FEEDBACK.md`](FEEDBACK.md)** — the consolidated response is structured to Circle's exact 5 sub-prompts:

1. **Products Used** — Arc, USDC, Circle Gateway, Circle Nanopayments, Developer Console, Dev-Controlled Wallets
2. **Use Case** — why Circle's stack is the only viable rail for sub-cent per-call settlement
3. **Successes** — 6 specific things that worked exceptionally well
4. **Challenges** — **14 numbered, specific friction points** with debugging-time costs (each one a real iteration pain point we hit while building)
5. **Recommendations** — **13 ranked, concrete asks** (each tied to a specific friction point)

Plus a "what we'd build next" coda. Roughly 2200 words; submission-form-ready. The most detailed sections are tied to the $500 Product Feedback Incentive criterion ("most detailed and helpful responses").

## Required: Transaction Flow Demonstration (in Video)

Per the hackathon page: the video must show
- A transaction executed via the Circle Developer Console
- Verification of that transaction on the Arc Block Explorer

Both are covered in the [`PITCH.md`](PITCH.md) script:
- **Shot 1 (0:08-0:22)**: Circle Console → seller wallet → Transactions tab (with the fresh Console-initiated tx from `npm run dcw-transfer`)
- **Shot 3 (0:50-1:08)**: arcscan → buyer wallet showing Gateway approvals + deposits → Gateway contract showing batched settles
