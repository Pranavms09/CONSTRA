// Thin D1 helpers. D1 rejects `undefined` bindings, so they become NULL.
const clean = (params: unknown[]) => params.map((p) => (p === undefined ? null : p));

export const first = <T = Record<string, any>>(db: D1Database, sql: string, ...params: unknown[]) =>
  db.prepare(sql).bind(...clean(params)).first<T>();

export const all = async <T = Record<string, any>>(db: D1Database, sql: string, ...params: unknown[]) =>
  (await db.prepare(sql).bind(...clean(params)).all<T>()).results;

export const run = (db: D1Database, sql: string, ...params: unknown[]) =>
  db.prepare(sql).bind(...clean(params)).run();

export const stmt = (db: D1Database, sql: string, ...params: unknown[]) => db.prepare(sql).bind(...clean(params));

export const nowIso = () => new Date().toISOString();

export function parseJson<T = any>(value: unknown, fallback: T | null = null): T | null {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function audit(
  db: D1Database,
  entry: { actorId?: number | null; action: string; entity?: string | null; entityId?: string | null; detail?: unknown; ip?: string | null }
) {
  try {
    await run(
      db,
      "INSERT INTO audit_logs (actor_id, action, entity, entity_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
      entry.actorId ?? null,
      entry.action,
      entry.entity ?? null,
      entry.entityId ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
      entry.ip ?? null
    );
  } catch {
    // Audit logging never blocks the business flow.
  }
}
