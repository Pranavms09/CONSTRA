import { Hono } from "hono";
import type { Context } from "hono";
import { clientIp, requireRole, requireUser } from "../auth";
import { all, first, run } from "../db";
import { fail } from "../errors";
import { formFile, normalizeSha256, sha256Hex } from "../lib/util";
import { KIND_TO_ENTITY, SIMULATED_CHAIN_ID } from "../services/chain";
import type { AppEnv } from "../types";

const chain = new Hono<AppEnv>();
const MAX_VERIFY_BYTES = 25 * 1024 * 1024;

async function rateLimit(c: Context<AppEnv>) {
  const { success } = await c.env.VERIFY_LIMITER.limit({ key: clientIp(c) ?? "unknown" });
  if (!success) fail(429, "Rate limit exceeded: 10 per 1 minute");
}

async function verifyHash(db: D1Database, input: string) {
  let hash: string;
  try {
    hash = normalizeSha256(input);
  } catch {
    return { status: "not_found", sha256: input, simulated: false };
  }
  const row = await first<any>(db, "SELECT * FROM chain_anchors WHERE sha256 = ?", hash);
  if (!row || (row.status !== "anchored" && row.status !== "confirmed")) return { status: "not_found", sha256: hash, simulated: false };
  return {
    status: "authentic", sha256: hash, anchored_at: row.anchored_at, kind: KIND_TO_ENTITY[row.kind] ?? "photo",
    tx_hash: row.tx_hash, explorer_url: null, simulated: true,
  };
}

// Public: hash an uploaded file (never stored) and look it up.
chain.post("/verify", async (c) => {
  await rateLimit(c);
  const file = formFile((await c.req.formData()).get("file"), "No file provided.");
  if (file.size > MAX_VERIFY_BYTES) fail(413, "File size exceeds maximum allowed limit of 25 MB");
  return c.json(await verifyHash(c.env.DB, await sha256Hex(await file.arrayBuffer())));
});

chain.get("/verify/:sha256", async (c) => {
  await rateLimit(c);
  return c.json(await verifyHash(c.env.DB, c.req.param("sha256")));
});

chain.get("/anchors/:entity/:entityId", requireUser, async (c) => {
  const user = c.get("user");
  const entity = c.req.param("entity").trim().toLowerCase();
  const row = (await first<any>(c.env.DB, "SELECT * FROM chain_anchors WHERE entity = ? AND entity_id = ? LIMIT 1", entity, c.req.param("entityId")))
    ?? fail(404, "Anchor not found");
  if (row.project_id && user.role !== "auditor" && /^\d+$/.test(row.project_id)) {
    const member = await first(c.env.DB, "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?", Number(row.project_id), user.id);
    if (!member) fail(404, "Anchor not found");
  }
  return c.json({
    status: row.status, sha256: row.sha256, entity: row.entity, entity_id: row.entity_id, kind: row.kind, tx_hash: row.tx_hash,
    anchored_at: row.anchored_at, explorer_url: null, simulated: true, attempts: row.attempts, last_error: row.last_error,
  });
});

chain.get("/status", requireRole("auditor"), async (c) => {
  const rows = await all<{ status: string; n: number }>(c.env.DB, "SELECT status, COUNT(*) AS n FROM chain_anchors GROUP BY status");
  const count = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return c.json({
    mode: "fake", chain_id: SIMULATED_CHAIN_ID, contract_address: null, wallet_address: "0xSIMULATED_WALLET_ADDRESS",
    wallet_balance_eth: 10.0, wallet_low_funds: false,
    counts: { pending: count("pending"), sent: count("sent"), anchored: count("anchored"), failed: count("failed") },
    explorer_tx_url: null, explorer_address_url: null, show_chain_copy: c.env.SHOW_CHAIN_COPY === "true",
  });
});

chain.post("/anchors/:id/retry", requireRole("auditor"), async (c) => {
  const id = c.req.param("id");
  const res = await run(c.env.DB, "UPDATE chain_anchors SET status = 'anchored', attempts = 0, last_error = NULL WHERE sha256 = ?", id);
  if (!res.meta.changes) fail(404, "Anchor not found");
  return c.json({ success: true, sha256: id, message: "Anchor status reset (simulated anchoring is immediate)" });
});

export default chain;
