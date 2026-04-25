// txs.ts — dump every Circle Gateway transfer for the buyer wallet, with the
// on-chain settlement tx hash for each. This is the evidence trail for the
// "255+ paid inferences" claim on the Per-API Monetization track.
//
// Usage:
//   npx tsx --env-file=.env txs.ts
//   npx tsx --env-file=.env txs.ts --json   # raw JSON output
import "dotenv/config";
import { gateway } from "./client.js";

const RAW = process.argv.includes("--json");

(async () => {
  const buyerAddr = gateway.address;
  if (!RAW) console.log(`\nQuerying Circle Gateway transfers for buyer ${buyerAddr}…`);

  let pageAfter: string | undefined;
  const all: any[] = [];
  do {
    const page: any = await (gateway as any).searchTransfers({
      from: buyerAddr,
      pageSize: 200,
      pageAfter,
    });
    all.push(...page.transfers);
    pageAfter = page.pagination?.pageAfter;
  } while (pageAfter);

  if (RAW) {
    console.log(JSON.stringify(all, null, 2));
    return;
  }

  console.log(`\nFound ${all.length} transfers from ${buyerAddr}.\n`);

  const byStatus: Record<string, number> = {};
  let totalAmount = 0n;
  const onChainTxs = new Set<string>();
  for (const t of all) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    totalAmount += BigInt(t.amount ?? "0");
    // Possible field names for the on-chain hash; the API may use any of these.
    const hash =
      t.transactionHash ?? t.txHash ?? t.onChainTxHash ?? t.settlementTxHash;
    if (hash) onChainTxs.add(hash);
  }

  console.log("Status breakdown:");
  for (const [s, n] of Object.entries(byStatus)) {
    console.log(`  ${String(n).padStart(4)}  ${s}`);
  }
  console.log(`\nTotal USDC moved (atomic): ${totalAmount}`);
  console.log(`Total USDC moved (formatted): ${(Number(totalAmount) / 1e6).toFixed(6)} USDC`);

  console.log(`\nDistinct on-chain settlement txs (${onChainTxs.size}):`);
  for (const h of onChainTxs) {
    console.log(`  https://testnet.arcscan.app/tx/${h}`);
  }

  console.log(`\nView all USDC events for this wallet:`);
  console.log(`  https://testnet.arcscan.app/address/${buyerAddr}#tokentxns`);
  console.log(`  https://testnet.arcscan.app/address/${process.env.SELLER_ADDRESS}#tokentxns`);
  console.log();

  // First few transfers as sample
  console.log("Sample transfers (first 5):");
  for (const t of all.slice(0, 5)) {
    console.log(`  ${t.createdAt}  ${(Number(t.amount) / 1e6).toFixed(6)} USDC  status=${t.status}  to=${(t.toAddress || "").slice(0, 12)}…  id=${t.id.slice(0, 8)}`);
  }
})().catch(e => { console.error("txs.ts failed:", e?.message ?? e); process.exit(1); });
