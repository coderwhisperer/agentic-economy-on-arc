// onchain.ts — find every batched settle tx Circle's facilitator has submitted
// to the Gateway contract that involves our buyer or seller. The Gateway
// contract emits custom events on settle (USDC stays inside the contract;
// only its internal accounting changes), so we look at the Gateway's logs.
//
// Usage: npx tsx --env-file=.env onchain.ts [blocksBack]
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";

const RPC = (process.env.ARC_RPC_URL ?? "https://arc-testnet.drpc.org").split(",")[0];
const GATEWAY = "0x0077777d7eba4688bdef3e311b846f25870a19b9".toLowerCase();
const BUYER = (process.env.PRIVATE_KEY
  ? privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`).address
  : ""
).toLowerCase();
const SELLER = (process.env.SELLER_ADDRESS ?? "").toLowerCase();

async function rpc(method: string, params: any[]): Promise<any> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

(async () => {
  const blocksBack = Number(process.argv[2] ?? 200_000);
  const tip = parseInt(await rpc("eth_blockNumber", []), 16);
  const fromBlock = Math.max(0, tip - blocksBack);
  console.log(`\nScanning blocks ${fromBlock}..${tip} on the Gateway contract for events…`);

  const buyerTopic = "0x" + "0".repeat(24) + BUYER.slice(2);
  const sellerTopic = "0x" + "0".repeat(24) + SELLER.slice(2);

  // We don't filter on event-signature topic[0] — we want EVERY event from the
  // Gateway contract that mentions our buyer or seller in any indexed slot.
  // Two passes: events with buyer in topic1..topic3, then seller in topic1..topic3.
  const seen = new Map<string, { block: number; eventSig: string; topics: string[] }>();
  const CHUNK = 10_000;
  for (const who of [{ tag: "buyer", topic: buyerTopic }, { tag: "seller", topic: sellerTopic }]) {
    if (!who.topic || who.topic === "0x" + "0".repeat(64)) continue;
    for (let start = fromBlock; start <= tip; start += CHUNK) {
      const end = Math.min(tip, start + CHUNK - 1);
      // Need to OR across topic positions; cheapest is 3 separate calls per chunk.
      for (const pos of [1, 2, 3]) {
        const topics: any[] = [null, null, null, null];
        topics[pos] = who.topic;
        const logs = await rpc("eth_getLogs", [{
          fromBlock: "0x" + start.toString(16),
          toBlock: "0x" + end.toString(16),
          address: GATEWAY,
          topics: topics.slice(0, pos + 1),
        }]).catch(() => []);
        for (const l of logs) {
          if (!seen.has(l.transactionHash)) {
            seen.set(l.transactionHash, {
              block: parseInt(l.blockNumber, 16),
              eventSig: l.topics[0],
              topics: l.topics,
            });
          }
        }
      }
      process.stdout.write(`  ${who.tag} ${start}..${end} — ${seen.size} unique txs so far\r`);
    }
  }
  console.log();

  console.log(`\nDistinct on-chain Gateway-contract txs touching our buyer or seller: ${seen.size}\n`);
  const ordered = [...seen.entries()].sort((a, b) => b[1].block - a[1].block);

  // Group by event signature for a sanity tally.
  const sigCounts: Record<string, number> = {};
  for (const [, v] of seen) sigCounts[v.eventSig] = (sigCounts[v.eventSig] ?? 0) + 1;
  console.log("By event signature:");
  for (const [sig, n] of Object.entries(sigCounts)) console.log(`  ${String(n).padStart(4)}× ${sig}`);

  console.log(`\nMost recent 20 txs (each is a batched settle bundling many of our paid calls):`);
  for (const [tx, info] of ordered.slice(0, 20)) {
    console.log(`  block ${String(info.block).padStart(8)}  https://testnet.arcscan.app/tx/${tx}`);
  }
  if (ordered.length > 20) console.log(`  …and ${ordered.length - 20} earlier batches`);
  console.log();
})().catch(e => { console.error("onchain.ts failed:", e?.message ?? e); process.exit(1); });
