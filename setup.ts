// setup.ts — pre-flight check for OracleMesh.
//
// Verifies environment variables, prints the buyer's wallet address, reminds
// the user to fund via the faucet. Does NOT do any onchain work (Circle
// Gateway's batched x402 doesn't require a pre-deposit the way the custom
// Gateway Batched Wallet integration does — authorization is EIP-3009 over
// the buyer's regular wallet balance).

import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const required = ["GEMINI_API_KEY", "FEATHERLESS_API_KEY", "PRIVATE_KEY", "SELLER_ADDRESS"];
const missing = required.filter(k => !process.env[k]);

console.log("\n╭─ OracleMesh setup check ──────────────────────────────");

for (const k of required) {
  const v = process.env[k];
  if (!v) {
    console.log(`│ ✗ ${k}: MISSING`);
  } else if (k === "PRIVATE_KEY") {
    const acct = privateKeyToAccount(v as `0x${string}`);
    console.log(`│ ✓ ${k}: ${v.slice(0, 6)}…${v.slice(-4)}  → address ${acct.address}`);
  } else if (k === "SELLER_ADDRESS") {
    console.log(`│ ✓ ${k}: ${v}`);
  } else {
    console.log(`│ ✓ ${k}: ${v.slice(0, 6)}…${v.slice(-4)}`);
  }
}

console.log(`│ — NETWORK: ${process.env.X402_NETWORK ?? "eip155:421614 (default)"}`);
console.log(`│ — FACILITATOR: ${process.env.CIRCLE_FACILITATOR_URL ?? "https://x402.org/facilitator (default)"}`);

if (missing.length) {
  console.log("│");
  console.log(`│ ⚠ ${missing.length} environment variable(s) missing. Fill .env before running.`);
  console.log("╰──────────────────────────────────────────────────────\n");
  process.exit(1);
}

console.log("│");
console.log("│ Next steps:");
console.log("│  1. Fund the buyer address above with testnet USDC");
console.log("│     → https://faucet.circle.com  (select Arc Testnet)");
console.log("│  2. Start the server:  npm run server");
console.log("│  3. In another terminal:  npm run try");
console.log("╰──────────────────────────────────────────────────────\n");
