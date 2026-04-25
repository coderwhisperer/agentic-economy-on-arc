// Helper: deposit USDC from buyer EOA into the Circle Gateway wallet so it
// can be spent on x402 calls. One-time setup. Usage:
//   npx tsx --env-file=.env deposit.ts 1.5
import "dotenv/config";
import { withRpcFallback, gateway } from "./client.js";

(async () => {
  const amount = process.argv[2] ?? "1.5";
  console.log(`Depositing ${amount} USDC into Gateway for ${gateway.address} on ${gateway.chainName}...`);
  const before = await withRpcFallback(gw => gw.getBalances());
  console.log(`  before: wallet=${before.wallet.formatted} gateway=${before.gateway.formattedAvailable}`);
  const r = await withRpcFallback(gw => gw.deposit(amount));
  if (r.approvalTxHash) console.log(`  approval tx: ${r.approvalTxHash}`);
  console.log(`  deposit  tx: ${r.depositTxHash}`);
  const after = await withRpcFallback(gw => gw.getBalances());
  console.log(`  after:  wallet=${after.wallet.formatted} gateway=${after.gateway.formattedAvailable}`);
})().catch(e => { console.error("Deposit failed:", e?.message ?? e); process.exit(1); });
