import { Hono } from "hono";
import type { Context } from "hono";
import { getAddress, isAddress, isHash, verifyMessage, type Hex } from "viem";
import { clientIp, requireRole, requireUser } from "../auth";
import { all, audit, first, run } from "../db";
import { fail, intParam, jsonBody } from "../errors";
import { formFile, normalizeSha256, sha256Hex } from "../lib/util";
import {
  authorizeAnchorer, chainConfig, explorerTx, isRealChain, KIND_TO_ENTITY, processAnchors, readOnChain, recordWalletAnchor, relayerStatus, syncRoles,
} from "../services/chain";
import type { AppEnv } from "../types";

const chain = new Hono<AppEnv>();
const MAX_VERIFY_BYTES = 25 * 1024 * 1024;

async function rateLimit(c: Context<AppEnv>) {
  const { success } = await c.env.VERIFY_LIMITER.limit({ key: clientIp(c) ?? "unknown" });
  if (!success) fail(429, "Rate limit exceeded: 10 per 1 minute");
}

/** Message a user signs with BridgeKey to prove wallet ownership. */
export const walletLinkMessage = (address: string, user: { id: number; email: string }, chainId: number) =>
  `CONSTRA wallet link\nWallet: ${address}\nAccount: ${user.email} (#${user.id})\nMST chain: ${chainId}`;

const anchorResponse = (c: Context<AppEnv>, row: any) => ({
  status: row.status, sha256: row.sha256, entity: row.entity, entity_id: row.entity_id, kind: row.kind, tx_hash: row.tx_hash,
  block_number: row.block_number, anchored_at: row.anchored_at, anchored_by: row.anchored_by ?? null,
  explorer_url: explorerTx(c.env, row.tx_hash), simulated: !!row.simulated, attempts: row.attempts, last_error: row.last_error,
});

async function verifyHash(c: Context<AppEnv>, input: string) {
  let hash: string;
  try {
    hash = normalizeSha256(input);
  } catch {
    return { status: "not_found", sha256: input, simulated: false };
  }
  const row = await first<any>(c.env.DB, "SELECT * FROM chain_anchors WHERE sha256 = ?", hash);

  if (!isRealChain(c.env)) {
    if (row?.status !== "anchored") return { status: "not_found", sha256: hash, simulated: false };
    return { status: "authentic", sha256: hash, anchored_at: row.anchored_at, kind: KIND_TO_ENTITY[row.kind], tx_hash: row.tx_hash, explorer_url: null, simulated: true };
  }

  // The MST contract is the source of truth; D1 only adds the tx hash for the explorer link.
  const onChain = await readOnChain(c.env, hash);
  if (!onChain.time) {
    if (row?.status === "anchored") {
      await audit(c.env.DB, {
        action: "DATABASE_TAMPER_DETECTED", entity: row.entity, entityId: row.entity_id, ip: clientIp(c),
        detail: { sha256: hash, contract: c.env.CONTRACT_ADDRESS, reason: "D1 marks anchored but EvidenceRegistry.verify returned 0" },
      });
    }
    return { status: "not_found", sha256: hash, simulated: false, pending: row ? row.status : null };
  }
  return {
    status: "authentic", sha256: hash, anchored_at: new Date(onChain.time * 1000).toISOString(), kind: KIND_TO_ENTITY[onChain.kind] ?? "unknown",
    anchored_by: onChain.by, tx_hash: row?.tx_hash ?? null, block_number: row?.block_number ?? null, explorer_url: explorerTx(c.env, row?.tx_hash),
    contract_address: c.env.CONTRACT_ADDRESS, network: `mst-${c.env.MST_NETWORK}`, simulated: false,
  };
}

// Public network info the frontend uses for BridgeKey network switching and direct contract reads.
chain.get("/config", (c) => c.json(chainConfig(c.env)));

chain.post("/verify", async (c) => {
  await rateLimit(c);
  const file = formFile((await c.req.formData()).get("file"), "No file provided.");
  if (file.size > MAX_VERIFY_BYTES) fail(413, "File size exceeds maximum allowed limit of 25 MB");
  return c.json(await verifyHash(c, await sha256Hex(await file.arrayBuffer())));
});

chain.get("/verify/:sha256", async (c) => {
  await rateLimit(c);
  return c.json(await verifyHash(c, c.req.param("sha256")));
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
  return c.json(anchorResponse(c, row));
});

chain.get("/status", requireRole("auditor"), async (c) => {
  const rows = await all<{ status: string; n: number }>(c.env.DB, "SELECT status, COUNT(*) AS n FROM chain_anchors GROUP BY status");
  const counts = Object.fromEntries(["pending", "sending", "sent", "anchored", "failed", "awaiting_signature"].map((s) => [s, rows.find((r) => r.status === s)?.n ?? 0]));
  const cfg = chainConfig(c.env);
  const relayer = await relayerStatus(c.env);
  return c.json({
    ...cfg, chain_id: cfg.chain_id, wallet_address: relayer.wallet_address, wallet_balance_eth: relayer.wallet_balance, wallet_low_funds: relayer.wallet_low_funds,
    counts, explorer_tx_url: `${cfg.explorer_url}/tx/`, explorer_address_url: `${cfg.explorer_url}/address/`, show_chain_copy: c.env.SHOW_CHAIN_COPY === "true",
  });
});

// Auditor: run the relayer now instead of waiting for the next cron tick.
chain.post("/process", requireRole("auditor"), async (c) => c.json(await processAnchors(c.env)));

// Auditor: mirror AccessRegistry role changes now (e.g. right after a BridgeKey setRole tx) instead of waiting for cron.
chain.post("/roles/sync", requireRole("auditor"), async (c) => {
  try {
    return c.json(await syncRoles(c.env));
  } catch (err) {
    return fail(502, `Role sync from MST failed: ${(err as Error).message}`);
  }
});

chain.post("/anchors/:id/retry", requireRole("auditor"), async (c) => {
  const id = c.req.param("id");
  const res = await run(c.env.DB,
    "UPDATE chain_anchors SET status = CASE WHEN ? THEN 'pending' ELSE 'anchored' END, attempts = 0, last_error = NULL, claimed_at = NULL WHERE sha256 = ? AND status != 'anchored'",
    isRealChain(c.env) ? 1 : 0, id);
  if (!res.meta.changes) fail(404, "Anchor not found or already anchored");
  c.executionCtx.waitUntil(processAnchors(c.env));
  return c.json({ success: true, sha256: id, message: "Anchor re-queued for the MST relayer" });
});

// Any signed-in user links a BridgeKey (EIP-1193) wallet: the signature proves ownership.
// Auditors may re-link and get their wallet authorized as an anchorer; site roles link once (changes go through an auditor).
chain.post("/wallet", requireUser, async (c) => {
  const user = c.get("user");
  if (user.role !== "auditor" && user.wallet_address) fail(409, "A wallet is already linked to your account. Ask your Project Auditor to change it.");
  const body = await jsonBody<{ address?: string; signature?: string }>(c.req);
  if (!body.address || !isAddress(body.address) || !body.signature) fail(422, "address and signature are required");
  const address = getAddress(body.address!);
  const valid = await verifyMessage({ address, message: walletLinkMessage(address, user, Number(c.env.MST_CHAIN_ID)), signature: body.signature as Hex }).catch(() => false);
  if (!valid) fail(401, "Wallet signature does not match the address");

  try {
    await run(c.env.DB, "UPDATE users SET wallet_address = ? WHERE id = ?", address, user.id);
  } catch {
    fail(409, "This wallet is already linked to another account.");
  }
  let authorizeTx: string | null = null;
  try {
    if (user.role === "auditor") authorizeTx = await authorizeAnchorer(c.env, address);
  } catch (err) {
    fail(502, `Wallet linked, but on-chain authorization failed: ${(err as Error).message}`);
  }
  await audit(c.env.DB, { actorId: user.id, action: "wallet_linked", entity: "user", entityId: String(user.id), detail: { address, authorize_tx: authorizeTx } });
  return c.json({ wallet_address: address, authorize_tx: authorizeTx, explorer_url: explorerTx(c.env, authorizeTx) });
});

chain.get("/wallet/message", requireUser, (c) => {
  const address = c.req.query("address");
  if (!address || !isAddress(address)) fail(422, "address query parameter is required");
  return c.json({ message: walletLinkMessage(getAddress(address!), c.get("user"), Number(c.env.MST_CHAIN_ID)) });
});

// Auditor submits the tx hash of a certificate they anchored from their own wallet; the receipt is checked on MST.
chain.post("/certificates/:id/onchain", requireRole("auditor"), async (c) => {
  const user = c.get("user");
  if (!isRealChain(c.env)) fail(400, "MST anchoring is disabled (CHAIN_MODE=fake).");
  const cert = (await first<any>(c.env.DB, "SELECT * FROM clearance_certificates WHERE id = ?", intParam(c.req.param("id")))) ?? fail(404, "Certificate not found");
  if (!user.wallet_address) fail(400, "Link your BridgeKey wallet first.");
  const body = await jsonBody<{ tx_hash?: string }>(c.req);
  if (!body.tx_hash || !isHash(body.tx_hash)) fail(422, "tx_hash is required");
  let result;
  try {
    result = await recordWalletAnchor(c.env, cert.certificate_hash, body.tx_hash as Hex, user.wallet_address!);
  } catch (err) {
    return fail(422, (err as Error).message);
  }
  await audit(c.env.DB, { actorId: user.id, action: "certificate_anchored_by_auditor", entity: "clearance_certificate", entityId: String(cert.id), detail: { ...result, certificate_hash: cert.certificate_hash } });
  return c.json({ ...result, explorer_url: explorerTx(c.env, result.tx_hash), certificate_hash: cert.certificate_hash });
});

export default chain;
