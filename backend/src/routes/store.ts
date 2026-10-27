import { Hono } from "hono";
import { ensureProjectAccess, requireRole, resolveUser } from "../auth";
import { all, audit, first, run, stmt } from "../db";
import { fail, intParam, jsonBody } from "../errors";
import { formFile, randomHex, sha256Hex, sniffMime, EXT_BY_MIME } from "../lib/util";
import {
  alertResponse, assessIssue, boqStatus, challanResponse, loadChallan, materialsWithUnits, processChallanOcr,
  raiseAlert, reconcileChallan, stockSummary, toBase,
} from "../services/store";
import { enqueueAnchor } from "../services/chain";
import type { AppEnv } from "../types";

const store = new Hono<AppEnv>();

const anyRole = requireRole("store_incharge", "auditor", "supervisor");
const storeOrAuditor = requireRole("store_incharge", "auditor");
const storeOnly = requireRole("store_incharge");

const stageResponse = (s: any) => ({ id: s.id, project_id: s.project_id, name: s.name, order: s.order, status: s.status, verified_progress: s.verified_progress });
const vendorResponse = (v: any) => ({ id: v.id, name: v.name, is_approved: !!v.is_approved });

function page(q: (k: string) => string | undefined) {
  const p = Number(q("page") ?? 1), l = Number(q("limit") ?? 20);
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(l) || l < 1 || l > 100) fail(422, "page must be >= 1 and limit between 1 and 100");
  return { page: p, limit: l, offset: (p - 1) * l };
}
const paginated = (items: unknown[], total: number, p: { page: number; limit: number }) =>
  ({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });

// --- 1. Projects and reference data ---

store.get("/projects", anyRole, async (c) => {
  const user = c.get("user");
  const rows = user.role === "auditor"
    ? await all(c.env.DB, "SELECT * FROM projects ORDER BY id ASC")
    : await all(c.env.DB, "SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id ASC", user.id);
  return c.json(rows.map((p) => ({ id: p.id, name: p.name, site_address: p.site_address, start_date: p.start_date, end_date: p.end_date, site_radius_m: p.site_radius_m })));
});

store.get("/projects/:pid/stages", anyRole, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  await ensureProjectAccess(c.env.DB, c.get("user"), pid);
  return c.json((await all(c.env.DB, 'SELECT * FROM stages WHERE project_id = ? ORDER BY "order" ASC, id ASC', pid)).map(stageResponse));
});

store.get("/materials", anyRole, async (c) => c.json(await materialsWithUnits(c.env.DB)));
store.get("/vendors", anyRole, async (c) => c.json((await all(c.env.DB, "SELECT * FROM vendors ORDER BY name ASC")).map(vendorResponse)));

store.get("/projects/:pid/materials", anyRole, async (c) => {
  await ensureProjectAccess(c.env.DB, c.get("user"), intParam(c.req.param("pid"), "pid"));
  return c.json(await materialsWithUnits(c.env.DB));
});

store.get("/projects/:pid/vendors", anyRole, async (c) => {
  await ensureProjectAccess(c.env.DB, c.get("user"), intParam(c.req.param("pid"), "pid"));
  return c.json((await all(c.env.DB, "SELECT * FROM vendors ORDER BY name ASC")).map(vendorResponse));
});

// --- 2. Challan ingestion & OCR ---

store.post("/projects/:pid/challans", storeOnly, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  const user = c.get("user");
  await ensureProjectAccess(c.env.DB, user, pid);

  const file = formFile((await c.req.formData()).get("file"), "No challan file provided.");
  const maxMb = Number(c.env.MAX_UPLOAD_MB || 10);
  if (file.size > maxMb * 1024 * 1024) fail(422, `File exceeds maximum allowed size of ${maxMb} MB.`);
  const bytes = await file.arrayBuffer();
  const mime = sniffMime(bytes);
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "application/pdf") {
    fail(422, "Unsupported file format. Please upload a genuine JPEG, PNG, or PDF challan document.");
  }

  const sha256 = await sha256Hex(bytes);
  const key = `challans/challan_${randomHex(16)}${EXT_BY_MIME[mime!]}`;
  await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: mime! }, sha256 });

  const challan = (await first<{ id: number; status: string }>(
    c.env.DB,
    `INSERT INTO challans (project_id, challan_no, uploaded_by, file_path, sha256, status, reviewed, version)
     VALUES (?, ?, ?, ?, ?, 'processing', 0, 1) RETURNING id, status`,
    pid, `PENDING-${randomHex(3).toUpperCase()}`, user.id, key, sha256
  ))!;
  await audit(c.env.DB, { actorId: user.id, action: "upload_challan", entity: "challan", entityId: String(challan.id), detail: { sha256, project_id: pid } });

  // shortcut: waitUntil keeps OCR running ~30 s after the response; move to Cloudflare Queues if OCR regularly takes longer.
  c.executionCtx.waitUntil(processChallanOcr(c.env, challan.id));
  return c.json({ id: challan.id, status: challan.status, message: "Challan uploaded successfully and is being processed." }, 202);
});

store.post("/projects/:pid/challans/manual", storeOnly, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  const user = c.get("user");
  await ensureProjectAccess(c.env.DB, user, pid);
  const row = await first<{ id: number }>(
    c.env.DB,
    `INSERT INTO challans (project_id, challan_no, uploaded_by, file_path, sha256, status, reviewed, version)
     VALUES (?, ?, ?, '', ?, 'draft', 0, 1) RETURNING id`,
    pid, `MANUAL-${randomHex(3).toUpperCase()}`, user.id, `manual_${randomHex(16)}`
  );
  return c.json(challanResponse(await loadChallan(c.env.DB, row!.id)));
});

async function accessibleChallan(c: any, id: number) {
  const challan = (await loadChallan(c.env.DB, id)) ?? fail(404, "Challan not found");
  await ensureProjectAccess(c.env.DB, c.get("user"), challan.project_id);
  return challan;
}

for (const path of ["/challans/:id", "/deliveries/:id"]) {
  store.get(path, storeOrAuditor, async (c) => c.json(challanResponse(await accessibleChallan(c, intParam(c.req.param("id"))))));
}

for (const method of ["put", "patch"] as const) {
  store[method]("/challans/:id", storeOnly, async (c) => {
    const challan = await accessibleChallan(c, intParam(c.req.param("id")));
    const body = await jsonBody<any>(c.req);
    if (challan.status !== "draft") fail(400, `Cannot edit challan in status '${challan.status}'. Only draft challans can be edited.`);
    if (challan.version !== body.version) fail(409, "Conflict: Challan was modified by another request. Please refresh to continue.");
    if (typeof body.challan_no !== "string" || !Array.isArray(body.items)) fail(422, "challan_no and items are required.");

    const db = c.env.DB;
    const writes = [stmt(db, "DELETE FROM challan_items WHERE challan_id = ?", challan.id)];
    for (const item of body.items) {
      const qty = Number(item.qty);
      if (!Number.isFinite(qty) || typeof item.unit !== "string") fail(422, "Each item needs a numeric qty and a unit.");
      const qtyBase = item.material_id ? await toBase(db, item.material_id, item.unit, qty).catch(() => qty) : qty;
      writes.push(stmt(db,
        "INSERT INTO challan_items (challan_id, material_id, stage_id, material_name_raw, qty, unit, qty_base, field_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        challan.id, item.material_id ?? null, item.stage_id ?? null, item.material_name_raw ?? null, qty, item.unit, qtyBase, item.field_confidence || 100));
    }
    // Version guard in the WHERE clause keeps the optimistic lock atomic.
    writes.push(stmt(db,
      "UPDATE challans SET challan_no = ?, vendor_id = ?, vendor_name_raw = ?, challan_date = ?, version = version + 1 WHERE id = ? AND version = ?",
      body.challan_no.trim(), body.vendor_id ?? null, body.vendor_name_raw ?? null, body.challan_date ?? null, challan.id, challan.version));
    try {
      await db.batch(writes);
    } catch {
      fail(400, `Challan #${body.challan_no.trim()} already exists for this vendor.`);
    }
    await audit(db, { actorId: c.get("user").id, action: "edit_challan", entity: "challan", entityId: String(challan.id) });
    return c.json(challanResponse(await loadChallan(db, challan.id)));
  });
}

store.post("/challans/:id/confirm", storeOnly, async (c) => {
  const db = c.env.DB;
  const challan = await accessibleChallan(c, intParam(c.req.param("id")));
  const body = await c.req.json().catch(() => null);
  if (body?.version != null && challan.version !== body.version) fail(409, "Conflict: Challan was modified by another request. Please refresh to continue.");

  const errors: string[] = [];
  if (!challan.challan_no || challan.challan_no.startsWith("PENDING-")) errors.push("Challan number is required.");
  if (!challan.items.length) errors.push("At least one delivery line item is required.");
  const baseUpdates = [];
  for (const [idx, item] of challan.items.entries()) {
    if (!item.material_id) errors.push(`Line item ${idx + 1} must be matched to a registered material.`);
    if (item.qty <= 0) errors.push(`Line item ${idx + 1} quantity must be greater than 0.`);
    if (item.material_id) {
      try {
        item.qty_base = await toBase(db, item.material_id, item.unit, item.qty);
        baseUpdates.push(stmt(db, "UPDATE challan_items SET qty_base = ? WHERE id = ?", item.qty_base, item.id));
      } catch (e: any) {
        errors.push(`Line item ${idx + 1}: ${e.detail ?? e.message}`);
      }
    }
  }
  if (errors.length) fail(422, { code: "VALIDATION_ERROR", message: errors.join("; ") });

  if (!challan.vendor_id && challan.vendor_name_raw) {
    const settings = await first<any>(db, "SELECT allow_new_vendors FROM project_settings WHERE project_id = ?", challan.project_id);
    if (settings?.allow_new_vendors) {
      const name = challan.vendor_name_raw.trim();
      await run(db, "INSERT OR IGNORE INTO vendors (name, is_approved) VALUES (?, 0)", name);
      challan.vendor_id = (await first<{ id: number }>(db, "SELECT id FROM vendors WHERE name = ?", name))!.id;
    }
  }

  if (challan.vendor_id) {
    const dup = await first<{ id: number }>(db,
      "SELECT id FROM challans WHERE vendor_id = ? AND challan_no = ? AND status = 'confirmed' AND id != ? LIMIT 1",
      challan.vendor_id, challan.challan_no, challan.id);
    if (dup) fail(400, `Challan #${challan.challan_no} has already been confirmed for this vendor (ID: ${dup.id}).`);
  }

  try {
    await db.batch([
      ...baseUpdates,
      stmt(db, "UPDATE challans SET vendor_id = ?, status = 'confirmed', reviewed = 1, version = version + 1 WHERE id = ?", challan.vendor_id, challan.id),
    ]);
  } catch {
    fail(400, `Challan #${challan.challan_no} already exists for this vendor.`);
  }

  await enqueueAnchor(db, { entity: "challan", entityId: challan.id, sha256: challan.sha256, projectId: challan.project_id });
  const reconcileSummary = await reconcileChallan(db, challan);
  const alerts = await all(db, "SELECT * FROM alerts WHERE challan_id = ? ORDER BY id", challan.id);
  await audit(db, { actorId: c.get("user").id, action: "confirm_challan", entity: "challan", entityId: String(challan.id), detail: { items_count: challan.items.length } });

  return c.json({ challan: challanResponse(await loadChallan(db, challan.id)), reconcile_summary: reconcileSummary, alerts_created: alerts.map(alertResponse) });
});

store.get("/projects/:pid/challans", storeOrAuditor, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  await ensureProjectAccess(c.env.DB, c.get("user"), pid);
  const q = (k: string) => c.req.query(k) || undefined;
  const p = page(q);
  const where = ["project_id = ?"];
  const args: unknown[] = [pid];
  if (q("status")) where.push("status = ?"), args.push(q("status"));
  if (q("vendor_id")) where.push("vendor_id = ?"), args.push(Number(q("vendor_id")));
  if (q("start_date")) where.push("challan_date >= ?"), args.push(q("start_date"));
  if (q("end_date")) where.push("challan_date <= ?"), args.push(q("end_date"));
  if (q("search")) {
    where.push("(challan_no LIKE ? OR vendor_name_raw LIKE ?)");
    const pattern = `%${q("search")!.trim()}%`;
    args.push(pattern, pattern);
  }
  const sqlWhere = where.join(" AND ");
  const total = (await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM challans WHERE ${sqlWhere}`, ...args))!.n;
  const ids = await all<{ id: number }>(c.env.DB, `SELECT id FROM challans WHERE ${sqlWhere} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`, ...args, p.limit, p.offset);
  const items = await Promise.all(ids.map(async ({ id }) => challanResponse(await loadChallan(c.env.DB, id))));
  return c.json(paginated(items, total, p));
});

// Accepts `?token=` because <img>/<iframe> tags cannot send an Authorization header.
store.get("/files/:id", async (c) => {
  const token = c.req.query("token");
  const header = c.req.header("authorization") || (token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : undefined);
  if (!header) fail(401, "Authentication token required");
  const user = await resolveUser(c.env, header);
  if (user.role !== "store_incharge" && user.role !== "auditor") fail(403, "Not allowed");
  c.set("user", user);

  const challan = await accessibleChallan(c, intParam(c.req.param("id")));
  const obj = challan.file_path ? await c.env.FILES.get(challan.file_path) : null;
  if (!obj) fail(404, "Physical evidence file not found on server");
  return new Response(obj!.body, {
    headers: {
      "Content-Type": obj!.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${challan.file_path.split("/").pop()}"`,
    },
  });
});

// --- 3. Material issues ---

async function accessibleStage(c: any, stageId: number) {
  const stage = (await first<any>(c.env.DB, "SELECT * FROM stages WHERE id = ?", stageId)) ?? fail(404, "Stage not found");
  await ensureProjectAccess(c.env.DB, c.get("user"), stage.project_id);
  return stage;
}

store.post("/issue-preview", storeOnly, async (c) => {
  const body = await jsonBody<any>(c.req);
  const stage = await accessibleStage(c, intParam(String(body.stage_id), "stage_id"));
  const qtyBase = await toBase(c.env.DB, intParam(String(body.material_id), "material_id"), String(body.unit ?? ""), body.qty);
  const r = await assessIssue(c.env.DB, stage, body.material_id, qtyBase);
  return c.json({ is_anomalous: r.is_anomalous, level: r.level, reasons: r.reasons, numbers: r.numbers });
});

store.post("/stages/:sid/material-issues", storeOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  const stage = await accessibleStage(c, intParam(c.req.param("sid"), "sid"));
  const body = await jsonBody<any>(c.req);
  if (typeof body.issued_to !== "string" || typeof body.unit !== "string") fail(422, "issued_to and unit are required.");
  const material = (await first<any>(db, "SELECT * FROM materials WHERE id = ?", body.material_id)) ?? fail(404, "Material not found");
  const qtyBase = await toBase(db, material.id, body.unit, body.qty);
  const evalResult = await assessIssue(db, stage, material.id, qtyBase);

  // Never block store work: the issue is always saved, anomalies only raise alerts.
  const issue = (await first<any>(db,
    `INSERT INTO material_issues (stage_id, material_id, qty, unit, qty_base, issued_by, issued_to, note, anomaly_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    stage.id, material.id, Number(body.qty), body.unit.trim(), qtyBase, user.id, body.issued_to.trim(), body.note ?? null, evalResult.is_anomalous ? 1 : 0))!;

  if (evalResult.is_anomalous) {
    await raiseAlert(db, {
      project_id: stage.project_id, stage_id: stage.id, issue_id: issue.id, type: "consumption_anomaly",
      severity: evalResult.level === "alert" ? "high" : "medium",
      explanation: evalResult.reasons.join("; ") || "Unusual consumption detected for verified progress.",
      evidence: evalResult.numbers,
    });
  }
  await audit(db, { actorId: user.id, action: "issue_material", entity: "material_issue", entityId: String(issue.id),
    detail: { material: material.name, qty: issue.qty, unit: issue.unit, anomaly: !!issue.anomaly_flag } });

  return c.json({
    id: issue.id, stage_id: stage.id, stage_name: stage.name, material_id: material.id, material_name: material.name,
    qty: issue.qty, unit: issue.unit, qty_base: issue.qty_base, issued_by: user.id, issuer_name: user.full_name,
    issued_to: issue.issued_to, note: issue.note, anomaly_flag: !!issue.anomaly_flag, issued_at: issue.issued_at,
    anomaly_reasons: evalResult.is_anomalous ? evalResult.reasons : null,
  }, 201);
});

store.get("/projects/:pid/material-issues", storeOrAuditor, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  await ensureProjectAccess(c.env.DB, c.get("user"), pid);
  const q = (k: string) => c.req.query(k) || undefined;
  const p = page(q);
  const where = ["s.project_id = ?"];
  const args: unknown[] = [pid];
  if (q("stage_id")) where.push("mi.stage_id = ?"), args.push(Number(q("stage_id")));
  if (q("material_id")) where.push("mi.material_id = ?"), args.push(Number(q("material_id")));
  if (q("start_date")) where.push("date(mi.issued_at) >= ?"), args.push(q("start_date"));
  if (q("end_date")) where.push("date(mi.issued_at) <= ?"), args.push(q("end_date"));
  const sqlWhere = where.join(" AND ");
  const total = (await first<{ n: number }>(c.env.DB,
    `SELECT COUNT(*) AS n FROM material_issues mi JOIN stages s ON s.id = mi.stage_id WHERE ${sqlWhere}`, ...args))!.n;
  const rows = await all<any>(c.env.DB,
    `SELECT mi.*, s.name AS stage_name, m.name AS material_name, u.full_name AS issuer_name
     FROM material_issues mi JOIN stages s ON s.id = mi.stage_id
     LEFT JOIN materials m ON m.id = mi.material_id LEFT JOIN users u ON u.id = mi.issued_by
     WHERE ${sqlWhere} ORDER BY mi.issued_at DESC LIMIT ? OFFSET ?`, ...args, p.limit, p.offset);
  const items = rows.map((r) => ({
    id: r.id, stage_id: r.stage_id, stage_name: r.stage_name ?? "", material_id: r.material_id, material_name: r.material_name ?? "",
    qty: r.qty, unit: r.unit, qty_base: r.qty_base, issued_by: r.issued_by, issuer_name: r.issuer_name ?? "",
    issued_to: r.issued_to, note: r.note, anomaly_flag: !!r.anomaly_flag, issued_at: r.issued_at,
  }));
  return c.json(paginated(items, total, p));
});

// --- 4. Stock, BOQ status, alerts ---

store.get("/projects/:pid/stock-summary", storeOrAuditor, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  await ensureProjectAccess(c.env.DB, c.get("user"), pid);
  return c.json(await stockSummary(c.env.DB, pid));
});

store.get("/projects/:pid/boq-status", storeOrAuditor, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  await ensureProjectAccess(c.env.DB, c.get("user"), pid);
  return c.json(await boqStatus(c.env.DB, pid));
});

store.get("/projects/:pid/alerts", storeOrAuditor, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  const user = c.get("user");
  await ensureProjectAccess(c.env.DB, user, pid);
  const rows = user.role === "auditor"
    ? await all(c.env.DB, "SELECT * FROM alerts WHERE project_id = ? ORDER BY created_at DESC", pid)
    : await all(c.env.DB,
        `SELECT a.* FROM alerts a LEFT JOIN challans ch ON ch.id = a.challan_id LEFT JOIN material_issues mi ON mi.id = a.issue_id
         WHERE a.project_id = ? AND (ch.uploaded_by = ? OR mi.issued_by = ?) ORDER BY a.created_at DESC`, pid, user.id, user.id);
  return c.json(rows.map(alertResponse));
});

const alertAction = requireRole("auditor", "store_incharge");
const ALERT_STATUSES = ["resolved", "escalated", "acknowledged", "open"];
for (const [method, path] of [["patch", "/alerts/:id"], ["post", "/alerts/:id/action"]] as const) {
  store[method](path, alertAction, async (c) => {
    const body = await jsonBody<{ status?: string; justification?: string }>(c.req);
    const justification = (body.justification ?? "").trim();
    if (justification.length < 5) fail(422, "A mandatory written justification of at least 5 characters is required to resolve or escalate an alert.");
    if (!ALERT_STATUSES.includes(body.status ?? "")) fail(400, "Invalid alert status. Must be resolved, escalated, or acknowledged.");
    const user = c.get("user");
    const alert = (await first<any>(c.env.DB, "SELECT * FROM alerts WHERE id = ?", intParam(c.req.param("id")))) ?? fail(404, "Alert not found");
    await ensureProjectAccess(c.env.DB, user, alert.project_id);

    const updated = await first(c.env.DB, "UPDATE alerts SET status = ?, auditor_comment = ?, updated_at = ? WHERE id = ? RETURNING *",
      body.status, `[${user.full_name || user.email} (${user.role})] ${justification}`, new Date().toISOString(), alert.id);
    await audit(c.env.DB, { actorId: user.id, action: "alert_action", entity: "alert", entityId: String(alert.id),
      detail: { previous_status: alert.status, new_status: body.status, justification, project_id: alert.project_id } });
    return c.json(alertResponse(updated));
  });
}

export default store;
