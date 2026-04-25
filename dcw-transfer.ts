// dcw-transfer.ts — fire a Console-visible USDC transfer from the seller's
// Dev-Controlled Wallet to the other DC wallet. Only purpose: for the demo
// video, so the Circle Console's Transactions tab shows a fresh row landing
// while the camera is rolling.
//
// This is NOT part of the OracleMesh payment flow — that uses Circle's
// Gateway-batched x402 (see server.ts). This script uses the DC Wallets
// API instead, which is a different Circle product. The seller address
// (0x6bdb…b270) just happens to be wrapped by both registrations.
//
// Usage:
//   npm run dcw-transfer            # default: 0.01 USDC seller → other DC
//   npm run dcw-transfer 0.05       # custom amount
//
// Effect: ONE on-chain Arc Testnet transaction. Visible in:
//   - Circle Console > Wallets > 6ae9c0ee… > Transactions tab
//   - arcscan via the returned TX hash
import "dotenv/config";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const required = ["CIRCLE_API_KEY", "CIRCLE_ENTITY_SECRET", "CIRCLE_SELLER_WALLET_ID", "CIRCLE_OTHER_DC_WALLET_ADDRESS"];
for (const k of required) if (!process.env[k]) throw new Error(`${k} missing in .env`);

const AMOUNT = process.argv[2] ?? "0.01";

(async () => {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  // Find the USDC token ID for Arc Testnet by reading the seller wallet's
  // current balances. The native USDC asset on Arc has a stable token ID
  // we can re-use across calls; this lookup runs once per script execution.
  const balances = await client.getWalletTokenBalance({
    id: process.env.CIRCLE_SELLER_WALLET_ID!,
  });
  const usdcRow = (balances.data?.tokenBalances ?? []).find(
    (b: any) =>
      (b.token?.symbol === "USDC" || b.token?.name === "USDC") &&
      (b.token?.blockchain === "ARC-TESTNET" || /5042002/.test(b.token?.chainId ?? "")),
  );
  if (!usdcRow?.token?.id) {
    console.error("Could not find USDC tokenId on the seller wallet. tokenBalances:");
    console.error(JSON.stringify(balances.data?.tokenBalances ?? [], null, 2));
    process.exit(1);
  }
  const tokenId = usdcRow.token.id;
  console.log(`USDC tokenId on Arc Testnet: ${tokenId}`);
  console.log(`Seller current USDC: ${usdcRow.amount}`);

  console.log(`\nInitiating ${AMOUNT} USDC transfer:`);
  console.log(`  from: seller DC Wallet (id=${process.env.CIRCLE_SELLER_WALLET_ID})`);
  console.log(`  to:   ${process.env.CIRCLE_OTHER_DC_WALLET_ADDRESS}`);

  const tx = await client.createTransaction({
    walletId: process.env.CIRCLE_SELLER_WALLET_ID!,
    tokenId,
    destinationAddress: process.env.CIRCLE_OTHER_DC_WALLET_ADDRESS!,
    amount: [AMOUNT],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const id = tx.data?.id;
  const state = tx.data?.state;
  console.log(`\nTransaction submitted:`);
  console.log(`  id:    ${id}`);
  console.log(`  state: ${state}`);

  // Poll until the on-chain hash appears.
  if (id) {
    console.log(`\nWaiting for on-chain confirmation (polling every 4s, max 60s)…`);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const t = await client.getTransaction({ id });
      const s = (t.data as any)?.transaction?.state ?? (t.data as any)?.state;
      const h = (t.data as any)?.transaction?.txHash ?? (t.data as any)?.txHash;
      process.stdout.write(`  attempt ${i + 1}: state=${s}${h ? " hash=" + h : ""}\r`);
      if (h) {
        console.log("\n");
        console.log(`✅ on-chain hash: ${h}`);
        console.log(`   arcscan:        https://testnet.arcscan.app/tx/${h}`);
        console.log(`\nThis tx is now visible in Circle Console > Wallets > ${(process.env.CIRCLE_SELLER_WALLET_ID || "").slice(0, 8)}… > Transactions tab.`);
        return;
      }
      if (s === "FAILED" || s === "CANCELLED") {
        console.log(`\n✗ tx ${s}`);
        return;
      }
    }
    console.log(`\nTx submitted but no hash yet after 60s. Check Console > Transactions for id=${id}.`);
  }
})().catch(e => { console.error("dcw-transfer failed:", e?.response?.data ?? e?.message ?? e); process.exit(1); });
