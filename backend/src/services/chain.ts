import { first, nowIso, run } from "../db";
import { normalizeSha256, sha256Hex } from "../lib/util";

// Blockchain anchoring was dropped in the Cloudflare port: every anchor is simulated immediately
// (the old CHAIN_MODE=fake behaviour), so no background worker or wallet is needed.

export const ENTITY_TO_KIND: Record<string, number> = { photo: 1, challan: 2, certificate: 3 };
export const KIND_TO_ENTITY: Record<number, string> = { 1: "photo", 2: "challan", 3: "certificate" };
export const SIMULATED_CHAIN_ID = 11155111;

/** Records a simulated anchor (idempotent on sha256). Never throws into the business flow; returns null on failure. */
export async function enqueueAnchor(
  db: D1Database,
  a: { entity: string; entityId: string | number; sha256: string; projectId?: string | number | null }
): Promise<{ sha256: string; tx_hash: string } | null> {
  try {
    const entity = a.entity.trim().toLowerCase();
    const kind = ENTITY_TO_KIND[entity];
    if (!kind) return null;
    const hash = normalizeSha256(a.sha256);
    const txHash = `0xFAKE${(await sha256Hex(hash + Date.now())).slice(0, 58)}`;
    await run(
      db,
      `INSERT OR IGNORE INTO chain_anchors (sha256, entity, entity_id, project_id, kind, status, tx_hash, chain_id, anchored_at, attempts, simulated)
       VALUES (?, ?, ?, ?, ?, 'anchored', ?, ?, ?, 1, 1)`,
      hash, entity, String(a.entityId), a.projectId == null ? null : String(a.projectId), kind, txHash, SIMULATED_CHAIN_ID, nowIso()
    );
    const row = await first<{ tx_hash: string }>(db, "SELECT tx_hash FROM chain_anchors WHERE sha256 = ?", hash);
    return { sha256: hash, tx_hash: row!.tx_hash };
  } catch (err) {
    console.warn("enqueueAnchor failed:", err);
    return null;
  }
}
