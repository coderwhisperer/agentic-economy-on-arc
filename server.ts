// server.ts — OracleMesh API.
//
// Architecture: a single Express server that exposes
//   GET  /              → marketplace.html
//   GET  /dashboard.html → live burst stats
//   POST /quote         → free routing preview (Gemini only, no payment)
//   POST /infer         → Per-API Monetization Engine — paid, flat quote per call
//   POST /infer/metered → Usage-Based Compute Billing — paid, price ∝ actual tokens
//   POST /buy           → Browser bridge: server performs /infer on buyer's behalf
//   GET  /wallet-info   → Browser strip: shows buyer's balances
//   GET  /stats         → Dashboard polling endpoint
//
// Payment rails: uses the x402 protocol (@x402/express) to 402-gate inference.
// Facilitator defaults to Circle's Gateway facilitator (nanopayment batching on
// Arc testnet). If CIRCLE_FACILITATOR_URL is not set, falls back to the public
// x402.org facilitator (Base Sepolia only). See .env.example for the Arc values.

import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import OpenAI from "openai";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { Address } from "viem";
import { route, fallbackRoute } from "./router.js";
import {
  dollarsToUsdcBaseUnits,
  meteredPrice,
  meteredCap,
  CATALOG,
  PRICE_CEILING_USD,
} from "./catalog.js";

// ─── Config ────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
const SELLER_ADDRESS = process.env.SELLER_ADDRESS as Address | undefined;
if (!SELLER_ADDRESS) {
  throw new Error("SELLER_ADDRESS missing — this is where USDC will be paid to");
}
if (!process.env.FEATHERLESS_API_KEY) {
  throw new Error("FEATHERLESS_API_KEY missing — activate via the lablab promo link");
}

// Arc Testnet (eip155:5042002) settlement network — Circle Gateway-batched
// scheme. CHAIN_NAME is the Circle SDK's name for the chain (used by GatewayClient).
const NETWORK = process.env.X402_NETWORK ?? "eip155:5042002";
const CHAIN_NAME = process.env.GATEWAY_CHAIN_NAME ?? "arcTestnet";
// Circle's Gateway facilitator base URL. SDK adds `/v1/x402/...` paths internally.
const FACILITATOR_URL =
  process.env.CIRCLE_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com";

// ─── Featherless ──────────────────────────────────────────────────────────
const featherless = new OpenAI({
  apiKey: process.env.FEATHERLESS_API_KEY,
  baseURL: "https://api.featherless.ai/v1",
});

// Retry wrapper for Featherless. Feather Premium caps concurrency at 4 — under
// burst load we hit 429 ("Concurrency limit exceeded"). Retry with exponential
// backoff so a contended call waits for a slot rather than failing the buyer
// after they've already paid.
async function featherlessChatWithRetry(
  args: Parameters<typeof featherless.chat.completions.create>[0],
  maxAttempts = 6,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastErr: any;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return (await featherless.chat.completions.create(args)) as OpenAI.Chat.Completions.ChatCompletion;
    } catch (err: any) {
      lastErr = err;
      const status = err?.status;
      const msg = String(err?.message ?? err);
      const retryable =
        status === 429 ||
        (typeof status === "number" && status >= 500 && status < 600) ||
        /concurrency|fetch failed|ECONNRESET|timeout|temporarily unavailable/i.test(msg);
      if (!retryable || i === maxAttempts - 1) throw err;
      // Two distinct 429 limits on Feather Premium:
      //   - Concurrency cap (4 in flight)        → seconds clear it
      //   - Model-switch cap (4 / minute)        → up to 60s to clear
      // So we cap backoff at 30s and add jitter so retries don't all unblock together.
      const isModelSwitch = /switch models/i.test(msg);
      const base = isModelSwitch ? 12000 : 800;
      const delay = Math.min(30000, base * Math.pow(2, i)) + Math.floor(Math.random() * 1000);
      console.log(`[featherless retry ${i + 1}/${maxAttempts - 1}] ${status ?? "?"} ${msg.slice(0, 80)} — waiting ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─── Circle Gateway middleware ─────────────────────────────────────────────
// `createGatewayMiddleware` wires up the GatewayWalletBatched scheme: it
// quotes payments, verifies signed authorizations against the Gateway contract,
// and settles via Circle's batch facilitator.
const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  networks: [NETWORK],
  facilitatorUrl: FACILITATOR_URL,
  description: "OracleMesh inference — Gemini routes, Featherless answers, you pay in sub-cent USDC on Arc.",
});

// ─── Optional in-server buyer (powers the marketplace /buy endpoint) ──────
// The server holds a buyer key for the demo marketplace flow — in production
// a wallet SDK lives in the browser; this is a demo shortcut.
let marketGateway: GatewayClient | null = null;
let marketAccountAddress: Address | null = null;
if (process.env.PRIVATE_KEY) {
  marketGateway = new GatewayClient({
    chain: CHAIN_NAME as any,
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    rpcUrl: process.env.ARC_RPC_URL,
  });
  marketAccountAddress = marketGateway.address;
}

// ─── In-memory stats (dashboard + burst summary) ──────────────────────────
type CallRecord = {
  ts: number;
  task: string;
  model: string;
  priceUsd: number;
  ok: boolean;
  mode: "flat" | "metered";
};
// Stats persist to disk so the dashboard counter survives server restarts.
// File is gitignored (./.stats.json). Writes are debounced to once per 750ms
// so a hot burst of paid calls doesn't generate an FS write per call.
import { readFileSync, writeFile } from "fs";
const STATS_FILE = "./.stats.json";

const stats = (() => {
  const empty = {
    totalCalls: 0,
    successfulCalls: 0,
    totalUsdc: 0,
    byModel: {} as Record<string, { calls: number; usdc: number }>,
    recent: [] as CallRecord[],
  };
  try {
    const loaded = JSON.parse(readFileSync(STATS_FILE, "utf-8"));
    console.log(`[stats] loaded ${loaded.totalCalls ?? 0} prior calls from ${STATS_FILE}`);
    return { ...empty, ...loaded };
  } catch {
    return empty;
  }
})();

let persistTimer: NodeJS.Timeout | null = null;
function persistStats() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeFile(STATS_FILE, JSON.stringify(stats), () => {});
  }, 750);
}

function recordCall(r: CallRecord) {
  stats.totalCalls++;
  if (r.ok) { stats.successfulCalls++; stats.totalUsdc += r.priceUsd; }
  stats.byModel[r.model] ??= { calls: 0, usdc: 0 };
  stats.byModel[r.model].calls++;
  if (r.ok) stats.byModel[r.model].usdc += r.priceUsd;
  stats.recent.unshift(r);
  stats.recent = stats.recent.slice(0, 30);
  persistStats();
}

// ─── App ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "256kb" }));

// DEBUG: request/response trace — prints x-payment header + any 402 body.
// Remove after Step D is green.
app.use((req, res, next) => {
  const xp = req.headers["x-payment"];
  const sig = req.headers["payment-signature"];
  if (req.path.startsWith("/infer") || req.path === "/buy") {
    console.log(`[req] ${req.method} ${req.path} x-payment=${xp ? "present("+String(xp).length+"B)" : "none"} payment-sig=${sig?"present":"none"}`);
  }
  const origSend = res.send.bind(res);
  const origEnd = res.end.bind(res);
  const logResp = (body: any) => {
    if ((req.path.startsWith("/infer") || req.path === "/buy") && res.statusCode >= 400) {
      let preview = "";
      if (Buffer.isBuffer(body)) preview = body.toString("utf8");
      else if (typeof body === "string") preview = body;
      else if (body) try { preview = JSON.stringify(body); } catch { preview = String(body); }
      const pr = res.getHeader("PAYMENT-REQUIRED");
      let decoded = "";
      if (pr && typeof pr === "string") {
        try { decoded = Buffer.from(pr, "base64").toString("utf-8"); } catch {}
      }
      console.log(`[res] ${req.method} ${req.path} -> ${res.statusCode} body=${preview.slice(0, 400)}`);
      if (decoded) console.log(`       PAYMENT-REQUIRED decoded: ${decoded.slice(0, 800)}`);
    }
  };
  (res as any).send = function (body: any) { logResp(body); return origSend(body); };
  (res as any).end = function (chunk?: any, ...rest: any[]) { logResp(chunk); return origEnd(chunk, ...rest); };
  next();
});

// CORS permissive — the marketplace HTML calls us from the same origin in
// production, but if it's opened via file:// we want it to still work.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, PAYMENT-SIGNATURE, X-PAYMENT"
  );
  res.header("Access-Control-Expose-Headers", "PAYMENT-RESPONSE, X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────

// Health + stats (no payment needed)
app.get("/health", (_req, res) => res.json({ ok: true, network: NETWORK, seller: SELLER_ADDRESS }));
app.get("/stats", (_req, res) => res.json(stats));

// Free routing preview — Gemini only, no payment
app.post("/quote", async (req, res) => {
  try {
    const task = String(req.body?.task ?? "").trim();
    if (!task) return res.status(400).json({ error: "Missing 'task' in body" });
    const decision = await route(task).catch(() => fallbackRoute(task, "quote fallback"));
    // Compute the metered-mode price too — same formula the /infer/metered
    // endpoint uses, so the chat panel's quote matches its receipt.
    const entry = CATALOG.find(m => m.id === decision.modelId);
    const estInputTokens = Math.max(8, Math.ceil(task.length / 4));
    const meteredPriceUsd = entry
      ? meteredPrice(entry.paramTier, estInputTokens, decision.estimatedOutputTokens)
      : decision.priceUsd;
    res.json({
      quote: {
        ...decision,
        // priceUsd: the flat per-tier price (used by the shelf cards / /infer)
        // meteredPriceUsd: the per-token estimate (used by the chat / /infer/metered)
        meteredPriceUsd,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ─── /infer ── Per-API Monetization Engine ────────────────────────────────
// Pricing is router-dynamic but bounded by the ceiling. We charge the ceiling
// flat — the router may pick a cheaper model; we include the actual decision
// in the response. Per-route gating via Circle Gateway middleware:
const inferPrice = `$${PRICE_CEILING_USD.toFixed(4)}`;
app.post("/infer", gateway.require(inferPrice) as any, async (req, res) => {
  const task = String(req.body?.task ?? "").trim();
  if (!task) return res.status(400).json({ error: "Missing 'task' in body" });

  const decision = await route(task).catch(() => fallbackRoute(task, "infer fallback"));

  try {
    const completion = await featherlessChatWithRetry({
      model: decision.modelId,
      messages: [{ role: "user", content: task }],
      max_tokens: Math.max(128, Math.min(1024, decision.estimatedOutputTokens * 2)),
      temperature: 0.3,
    });
    const answer = completion.choices[0]?.message?.content ?? "";

    // /infer is FLAT-priced: gateway.require($0.0095) is what Circle actually settles.
    // The router's `decision.priceUsd` is an INTERNAL accounting/routing hint, not what
    // the buyer was charged. Record the actually-settled amount.
    recordCall({
      ts: Date.now(), task: task.slice(0, 80),
      model: decision.display, priceUsd: PRICE_CEILING_USD,
      ok: true, mode: "flat",
    });

    res.json({
      answer,
      routing: decision,
      payment: {
        amountUsd: PRICE_CEILING_USD,
        network: NETWORK,
        seller: SELLER_ADDRESS,
        // Settlement receipt is in the X-PAYMENT-RESPONSE header written by middleware.
      },
    });
  } catch (err: any) {
    recordCall({
      ts: Date.now(), task: task.slice(0, 80),
      model: decision.display, priceUsd: PRICE_CEILING_USD,
      ok: false, mode: "flat",
    });
    res.status(502).json({
      error: "Featherless inference failed after payment (would refund in production)",
      detail: err?.message ?? String(err),
      routing: decision,
    });
  }
});

// ─── /infer/metered ── Usage-Based Compute Billing ────────────────────────
//
// Per-call dynamic pricing keyed to the routed model + estimated output tokens.
// Same endpoint, different prompts → different prices. Smaller prompts get
// smaller charges; bigger prompts get bigger charges — that's "usage-based".
//
// Implementation: route the prompt FIRST (pre-quote), then apply Circle's
// gateway.require() middleware with that quote. The buyer signs the quote
// exactly; the second (signed) request hits the same cached decision so the
// price stays consistent across the 402 → sign → settle round-trip.
//
// Routing decisions are cached by the verbatim task body for 5 minutes so the
// signed retry hits the same price. Without caching, Gemini's non-determinism
// could re-quote a different price on retry → signature mismatch.

type CachedMetered = { decision: ReturnType<typeof fallbackRoute>; priceUsd: number; ts: number };
const meteredCache = new Map<string, CachedMetered>();
const METERED_TTL_MS = 5 * 60 * 1000;

function gcMeteredCache() {
  const cutoff = Date.now() - METERED_TTL_MS;
  for (const [k, v] of meteredCache) if (v.ts < cutoff) meteredCache.delete(k);
}

app.post("/infer/metered", async (req, res, next) => {
  const task = String(req.body?.task ?? "").trim();
  if (!task) return res.status(400).json({ error: "Missing 'task' in body" });

  gcMeteredCache();
  let cached = meteredCache.get(task);
  if (!cached) {
    const decision = await route(task).catch(() => fallbackRoute(task, "metered fallback"));
    const entry = CATALOG.find(m => m.id === decision.modelId)!;
    // Estimate input tokens roughly (~4 chars/token) for the metered formula.
    const estInputTokens = Math.max(8, Math.ceil(task.length / 4));
    const priceUsd = meteredPrice(entry.paramTier, estInputTokens, decision.estimatedOutputTokens);
    cached = { decision, priceUsd, ts: Date.now() };
    meteredCache.set(task, cached);
  }
  (req as any).meteredCached = cached;

  // Per-call dynamic price: this varies with prompt size, hence "usage-based".
  const priceStr = `$${cached.priceUsd.toFixed(6)}`;
  return gateway.require(priceStr)(req as any, res as any, next);
}, async (req, res) => {
  // Payment was just verified + settled by the middleware above.
  const { decision, priceUsd } = (req as any).meteredCached as CachedMetered;
  const task = String(req.body?.task ?? "").trim();
  const entry = CATALOG.find(m => m.id === decision.modelId)!;

  try {
    const completion = await featherlessChatWithRetry({
      model: decision.modelId,
      messages: [{ role: "user", content: task }],
      max_tokens: Math.max(128, Math.min(1024, decision.estimatedOutputTokens * 2)),
      temperature: 0.3,
    });
    const answer = completion.choices[0]?.message?.content ?? "";
    const usage = {
      prompt_tokens: completion.usage?.prompt_tokens ?? 0,
      completion_tokens: completion.usage?.completion_tokens ?? 0,
    };
    // For transparency: what the price WOULD be if we settled on actual tokens.
    const actualBasedOnRealTokensUsd = meteredPrice(entry.paramTier, usage.prompt_tokens, usage.completion_tokens);

    recordCall({
      ts: Date.now(), task: task.slice(0, 80),
      model: decision.display, priceUsd, ok: true, mode: "metered",
    });

    return res.json({
      answer,
      routing: decision,
      metering: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        tier: entry.paramTier,
        chargedUsd: priceUsd,
        actualBasedOnRealTokensUsd,
        // Negative = caller paid less than the post-hoc actual; positive = paid more.
        // Tracked for the demo's "honesty" column.
        diffUsd: +(priceUsd - actualBasedOnRealTokensUsd).toFixed(6),
      },
      payment: { amountUsd: priceUsd, network: NETWORK, seller: SELLER_ADDRESS },
    });
  } catch (err: any) {
    recordCall({
      ts: Date.now(), task: task.slice(0, 80),
      model: decision.display, priceUsd: 0, ok: false, mode: "metered",
    });
    return res.status(502).json({ error: `Inference failed: ${err?.message ?? err}` });
  }
});

// ─── Marketplace bridge (browser → server signs → loops back to /infer) ──

app.get("/wallet-info", async (_req, res) => {
  if (!marketGateway || !marketAccountAddress) {
    return res.status(503).json({
      error: "PRIVATE_KEY not configured on server — marketplace buy is disabled",
    });
  }
  try {
    const balances = await marketGateway.getBalances();
    res.json({
      address: marketAccountAddress,
      walletUsdc: balances.wallet.formatted,
      gatewayUsdc: balances.gateway.formattedAvailable,
      network: NETWORK,
    });
  } catch (err: any) {
    res.json({
      address: marketAccountAddress,
      walletUsdc: "(rpc error)",
      gatewayUsdc: "(rpc error)",
      network: NETWORK,
      detail: err?.message ?? String(err),
    });
  }
});

// Server-side bridge: browser → server-held wallet pays an x402 endpoint
// → answer + receipt returned to browser. `target` is the path on this server
// to settle (default /infer = flat-rate Per-API Monetization).
async function browserPay(target: "/infer" | "/infer/metered", req: Request, res: Response) {
  if (!marketGateway) {
    return res.status(503).json({ error: "PRIVATE_KEY not configured — marketplace buy is disabled" });
  }
  const task = String(req.body?.task ?? "").trim();
  if (!task) return res.status(400).json({ error: "Missing 'task'" });

  try {
    const result = await marketGateway.pay(`http://localhost:${PORT}${target}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { task },
    });
    return res.status(result.status).json({
      ...((result.data ?? {}) as object),
      payment: {
        amountUsd: Number(result.formattedAmount),
        seller: SELLER_ADDRESS,
        network: NETWORK,
        amountUsdcAtomic: result.amount.toString(),
        amountUsdc: result.formattedAmount,
        transaction: result.transaction,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}

// Per-API Monetization (flat ceiling)
app.post("/buy", (req, res) => browserPay("/infer", req, res));

// Usage-Based Compute Billing (per-call dynamic price)
app.post("/buy-metered", (req, res) => browserPay("/infer/metered", req, res));

// ─── Static files (marketplace.html, dashboard.html) ─────────────────────
app.use(express.static(".", { extensions: ["html"] }));
app.get("/", (_req, res) => res.redirect("/marketplace.html"));

// ─── Error handler ───────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server error]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log("");
  console.log("  ┌─ OracleMesh ─────────────────────────────────────────");
  console.log(`  │ Listening:     http://localhost:${PORT}`);
  console.log(`  │ Marketplace:   http://localhost:${PORT}/marketplace.html`);
  console.log(`  │ Dashboard:     http://localhost:${PORT}/dashboard.html`);
  console.log(`  │ Settlement:    ${NETWORK}`);
  console.log(`  │ Seller:        ${SELLER_ADDRESS}`);
  console.log(`  │ Facilitator:   ${FACILITATOR_URL}`);
  console.log(`  │ Market buyer:  ${marketAccountAddress ?? "(disabled — set PRIVATE_KEY)"}`);
  console.log("  └──────────────────────────────────────────────────────");
  console.log("");
});
