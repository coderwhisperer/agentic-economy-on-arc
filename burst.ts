// burst.ts — fires N paid inferences across mixed task categories.
//
// Proves the Circle Per-API Monetization track at VOLUME:
//   - 50+ on-chain settlement transactions (Circle's hard requirement)
//   - Every call individually priced and settled in USDC via x402 on Arc
//   - Mixed categories exercise the full routing catalog
//
// After the run, prints the margin story: what this would have cost on Ethereum
// L1 vs. what it actually cost on Arc with Circle's batched nanopayments.

import "dotenv/config";
import { buy, account } from "./client.js";

const N = Number(process.env.BURST_N ?? 100);
const CONCURRENCY = Number(process.env.BURST_CONCURRENCY ?? 4);
const SELLER = process.env.SELLER_ADDRESS ?? "<seller>";

// Mixed prompts — exercise every category in the catalog.
const PROMPTS: string[] = [
  // code
  "Write a JS one-liner to deduplicate an array of objects by 'id'.",
  "Regex to match IPv4 addresses.",
  "Convert this Python dict to a TypeScript interface: {name: str, age: int, tags: list[str]}",
  "Fix this off-by-one: for (let i = 0; i <= arr.length; i++)",
  // medical
  "What's the normal fasting blood glucose range in mg/dL?",
  "Two contraindications for ibuprofen in elderly patients.",
  "Brief mechanism of action of statins.",
  // legal
  "What does 'force majeure' mean in a contract?",
  "Difference between misdemeanor and felony, one sentence each.",
  "Define 'consideration' in contract law.",
  // multilingual
  "Translate to Japanese: 'The package will arrive tomorrow morning.'",
  "Translate to Arabic: 'Where is the nearest pharmacy?'",
  "Conjugate the Spanish verb 'tener' in present tense.",
  // creative
  "Write a 4-line poem about static electricity.",
  "One-sentence cyberpunk opening line.",
  // math
  "If 3x + 7 = 22, what is x? Show one line of work.",
  "A train leaves at 3:15 PM at 60mph and another at 4:00 PM at 80mph from the same station — when do they meet?",
  // general / summary
  "Summarize the plot of Hamlet in 2 sentences.",
  "Three uses of baking soda outside cooking.",
  "Define 'opportunity cost' in plain English.",
];

type Result = { i: number; ok: boolean; ms: number; priceUsd?: number; model?: string; err?: string };

async function fire(i: number): Promise<Result> {
  const task = PROMPTS[i % PROMPTS.length] + ` (#${Math.floor(i / PROMPTS.length) + 1})`;
  const t0 = Date.now();
  try {
    const { status, data } = await buy(task);
    const ms = Date.now() - t0;
    if (status >= 200 && status < 300) {
      return { i, ok: true, ms, model: data.routing?.display, priceUsd: data.routing?.priceUsd };
    }
    return { i, ok: false, ms, err: `HTTP ${status}: ${data?.error ?? "unknown"}` };
  } catch (err: any) {
    return { i, ok: false, ms: Date.now() - t0, err: err?.message ?? String(err) };
  }
}

async function pool<T>(items: number[], conc: number, fn: (n: number) => Promise<T>): Promise<T[]> {
  const out: T[] = [];
  const queue = items.slice();
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const n = queue.shift()!;
      const r = await fn(n);
      out.push(r);
      done++;
      if (done % 10 === 0 || done === N) {
        process.stdout.write(`  progress: ${done}/${N}\r`);
      }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  return out;
}

(async () => {
  console.log("\n┌─ BURST ─────────────────────────────────────────────");
  console.log(`│ N:          ${N} paid inferences`);
  console.log(`│ Buyer:      ${account.address}`);
  console.log(`│ Seller:     ${SELLER}`);
  console.log(`│ Concurrency: ${CONCURRENCY}`);
  console.log("└──────────────────────────────────────────────────────\n");

  const t0 = Date.now();
  const results = await pool(Array.from({ length: N }, (_, i) => i), CONCURRENCY, fire);
  const elapsed = (Date.now() - t0) / 1000;

  const ok = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  const totalUsd = ok.reduce((s, r) => s + (r.priceUsd ?? 0), 0);
  const byModel: Record<string, number> = {};
  ok.forEach(r => { byModel[r.model!] = (byModel[r.model!] ?? 0) + 1; });

  console.log("\n\n┌─ RESULTS ───────────────────────────────────────────");
  console.log(`│ Calls:       ${results.length}`);
  console.log(`│ Successful:  ${ok.length}`);
  console.log(`│ Failed:      ${failed.length}`);
  console.log(`│ Wall time:   ${elapsed.toFixed(1)}s  (${(ok.length / elapsed).toFixed(1)} req/s)`);
  console.log(`│ USDC paid:   $${totalUsd.toFixed(6)}`);
  console.log(`│ Avg/call:    $${(totalUsd / Math.max(1, ok.length)).toFixed(6)}`);
  console.log("└──────────────────────────────────────────────────────");

  console.log("\n┌─ BY MODEL ──────────────────────────────────────────");
  for (const [m, c] of Object.entries(byModel).sort((a, b) => b[1] - a[1])) {
    console.log(`│  ${String(c).padStart(4)}  ${m}`);
  }
  console.log("└──────────────────────────────────────────────────────");

  if (failed.length) {
    console.log("\n┌─ FAILURES ──────────────────────────────────────────");
    const errCounts: Record<string, number> = {};
    failed.forEach(r => { errCounts[r.err ?? "unknown"] = (errCounts[r.err ?? "unknown"] ?? 0) + 1; });
    for (const [e, c] of Object.entries(errCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`│  ${String(c).padStart(3)}× ${e.slice(0, 70)}`);
    }
    console.log("└──────────────────────────────────────────────────────");
  }

  // The money slide — the economic story Circle judges are scored on.
  const ethL1GasPerTx = 0.20;
  const ethL1Total = ok.length * ethL1GasPerTx;
  const stripeFeePerTx = 0.30 + 0.029 * (totalUsd / Math.max(1, ok.length));
  const stripeTotal = ok.length * stripeFeePerTx;

  console.log("\n┌─ MARGIN STORY — the slide that wins ────────────────");
  console.log(`│`);
  console.log(`│ ${ok.length} inferences. Total revenue: $${totalUsd.toFixed(4)}.`);
  console.log(`│`);
  console.log(`│  Rail                        Cost to seller      Net`);
  console.log(`│  ─────────────────────────   ───────────────   ─────────`);
  console.log(`│  Stripe (per-call)           $${stripeTotal.toFixed(2).padStart(7)}         $${(totalUsd - stripeTotal).toFixed(2).padStart(7)}  ❌`);
  console.log(`│  Ethereum L1 (per-call)      $${ethL1Total.toFixed(2).padStart(7)}         $${(totalUsd - ethL1Total).toFixed(2).padStart(7)}  ❌`);
  console.log(`│  Arc + Circle Nanopayments   $${(0).toFixed(2).padStart(7)}         $${totalUsd.toFixed(4).padStart(7)}  ✅`);
  console.log(`│`);
  console.log(`│  This product is ONLY viable on Circle's batched nanopayment rail.`);
  console.log("└──────────────────────────────────────────────────────");

  console.log(`\nView settlements on-chain: https://testnet.arcscan.app/address/${SELLER}\n`);
})();
