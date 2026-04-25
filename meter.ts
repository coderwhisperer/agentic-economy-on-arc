// meter.ts — Usage-Based Compute Billing demo.
//
// Proves Circle's Usage-Based Compute Billing track.
//
// Hits /infer/metered with four tasks of different sizes. The server quotes a
// per-call price derived from the routed model + estimated tokens, then
// settles for that exact amount on Arc via Circle's batched x402 facilitator.
// Judges see four rows: same endpoint, four different prices proportional to
// the work each prompt demands.

import "dotenv/config";
import { buyMetered, account } from "./client.js";

const TASKS = [
  { label: "TINY  ", task: "What is 2+2?" },
  { label: "SMALL ", task: "Define 'photosynthesis' in one sentence." },
  { label: "MEDIUM", task: "Write a short Python function that returns all prime numbers up to n using the Sieve of Eratosthenes. Include a docstring." },
  { label: "LARGE ", task: "Explain the difference between TCP and UDP, then give a real-world example of when you'd use each. Be thorough but clear." },
];

(async () => {
  console.log("\n┌─ METERED BILLING DEMO ─────────────────────────────────────────");
  console.log("│ Same endpoint, per-call dynamic price ∝ routed model + tokens.");
  console.log(`│ Buyer: ${account.address}`);
  console.log("└────────────────────────────────────────────────────────────────\n");

  console.log("task    charged       actual($)     delta        tokens in/out    model");
  console.log("──────  ────────────  ────────────  ──────────   ───────────────  ────────────────────");

  for (const { label, task } of TASKS) {
    try {
      const { status, data } = await buyMetered(task);
      if (status < 200 || status >= 300) {
        console.log(`${label}  failed: HTTP ${status} ${data?.error ?? ""}`);
        continue;
      }
      const m = data.metering;
      const line =
        `${label}  $${m.chargedUsd.toFixed(6)}    ` +
        `$${m.actualBasedOnRealTokensUsd.toFixed(6)}    ` +
        `${m.diffUsd >= 0 ? "+" : "-"}$${Math.abs(m.diffUsd).toFixed(6)}   ` +
        `${String(m.inputTokens).padStart(4)}/${String(m.outputTokens).padEnd(4)}       ` +
        `${data.routing.display}`;
      console.log(line);
    } catch (err: any) {
      console.log(`${label}  error: ${err?.message ?? err}`);
    }
  }

  console.log("\n  ↑ Each call's price was QUOTED dynamically from the routed model + estimated tokens.");
  console.log("  ↑ Bigger prompts → bigger charges. That's Usage-Based Compute Billing.");
  console.log("  ↑ 'actual' is what it WOULD have cost if we re-priced post-call from real tokens —");
  console.log("    the delta shows how close our estimator was. Negative = caller saved vs. actual.\n");
})();
