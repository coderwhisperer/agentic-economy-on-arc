// client.ts — Buyer wrapper using Circle's Gateway batching SDK.
//
// `GatewayClient.pay()` handles the full x402 dance:
//   1. POST to the resource → 402 with batched-payment requirements
//   2. Sign EIP-3009 against the GatewayWallet contract (NOT USDC)
//   3. POST again with the signature → server verifies + settles via Circle
//   4. Returns the resource response + settlement tx hash
//
// CLI usage:
//   tsx --env-file=.env client.ts "your task here"

import "dotenv/config";
import { GatewayClient } from "@circle-fin/x402-batching/client";

if (!process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY missing — the buyer's EVM key (needs testnet USDC)");
}

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const CHAIN_NAME = (process.env.GATEWAY_CHAIN_NAME ?? "arcTestnet") as any;

// Primary + fallback RPC URLs. drpc is primary (more reliable);
// rpc.testnet.arc.network is the official fallback. Comma-separated.
const RPC_URLS: string[] = [
  process.env.ARC_RPC_URL,
  ...(process.env.ARC_RPC_URL_FALLBACKS ?? "").split(",").map(s => s.trim()),
].filter((u): u is string => !!u);

const makeGateway = (rpcUrl?: string) =>
  new GatewayClient({
    chain: CHAIN_NAME,
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    rpcUrl,
  });

// Default client uses primary RPC. The export is what most callers need —
// for chain-touching ops we wrap with `withRpcFallback` below.
export const gateway = makeGateway(RPC_URLS[0]);
export const account = gateway.account;

// Helper: run a chain-RPC-using op against primary, on RPC errors retry
// against each fallback URL with a fresh GatewayClient. Pure HTTP ops to
// Circle's facilitator (`pay`, `verify`, `settle`) don't touch the chain
// directly, so most calls don't need this — use it for `deposit`,
// `withdraw`, `getBalances`.
export async function withRpcFallback<T>(
  op: (gw: GatewayClient) => Promise<T>,
): Promise<T> {
  let lastErr: any;
  for (const url of RPC_URLS) {
    try {
      const gw = url === RPC_URLS[0] ? gateway : makeGateway(url);
      return await op(gw);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.shortMessage ?? err?.message ?? err);
      const retryable =
        /txpool is full|timeout|ECONNRESET|fetch failed|ENOTFOUND|503|502|504|rate limit/i.test(msg);
      if (!retryable) throw err;
      // else fall through to next URL
    }
  }
  throw lastErr;
}

export async function buy(task: string): Promise<{ status: number; data: any; transaction?: string; amountUsdc?: string }> {
  const result = await gateway.pay<any>(`${SERVER_URL}/infer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { task },
  });
  return {
    status: result.status,
    data: result.data,
    transaction: result.transaction,
    amountUsdc: result.formattedAmount,
  };
}

export async function buyMetered(task: string): Promise<{ status: number; data: any; transaction?: string; amountUsdc?: string }> {
  const result = await gateway.pay<any>(`${SERVER_URL}/infer/metered`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { task },
  });
  return {
    status: result.status,
    data: result.data,
    transaction: result.transaction,
    amountUsdc: result.formattedAmount,
  };
}

// CLI: single-shot paid inference
if (import.meta.url === `file://${process.argv[1]}`) {
  const task = process.argv.slice(2).join(" ") ||
    "In two sentences, what's the difference between TCP and UDP?";
  console.log(`[client] buying: ${task}`);
  console.log(`[client] buyer: ${account.address}`);
  const t0 = Date.now();
  buy(task).then(
    ({ status, data, transaction, amountUsdc }) => {
      const ms = Date.now() - t0;
      console.log(`\n[${status}] ${ms}ms`);
      if (amountUsdc) console.log(`  paid: ${amountUsdc} USDC`);
      if (transaction) console.log(`  tx:    ${transaction}`);
      if (data?.routing) {
        console.log(`  model: ${data.routing.display} (${data.routing.category}/${data.routing.complexity})`);
        console.log(`  price: $${data.routing.priceUsd?.toFixed(6)}`);
        console.log(`  routing: ${data.routing.reasoning}`);
      }
      if (data?.answer) {
        console.log("\n  answer:");
        console.log(String(data.answer).split("\n").map((l: string) => "    " + l).join("\n"));
      }
      if (data?.error) console.log(`  error: ${data.error}`);
    },
    err => {
      console.error("Buy failed:", err?.message ?? err);
      if (err?.cause) console.error("  cause:", err.cause?.message ?? err.cause, err.cause?.code ?? "");
      if (err?.stack) console.error(err.stack);
      process.exit(1);
    }
  );
}
