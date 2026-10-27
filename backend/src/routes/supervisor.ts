import { Hono } from "hono";
import { autoLinkDemoSupervisor, clientIp, requireRole, requireUser } from "../auth";
import { all, audit, first, nowIso, parseJson, run } from "../db";
import { fail, intParam } from "../errors";
import { analyzeConstruction, GeminiError } from "../lib/gemini";
import { formFile, haversineM, sha256Hex, sniffMime } from "../lib/util";
import { chainConfig, enqueueAnchor, explorerTx, isRealChain, processAnchors } from "../services/chain";
import type { AppEnv, Env, User } from "../types";

const supervisor = new Hono<AppEnv>();
const supervisorOnly = requireRole("supervisor");

const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
const EVIDENCE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const EVIDENCE_SELECT = `SELECT e.*, p.name AS project_name, s.name AS stage_name, u.full_name AS supervisor_name
  FROM evidence e LEFT JOIN projects p ON p.id = e.project_id LEFT JOIN stages s ON s.id = e.stage_id LEFT JOIN users u ON u.id = e.supervisor_id`;

export function evidenceResponse(e: any, env: Env) {
  const tx: string | null = e.blockchain_tx;
  const isRealTx = !!tx && !tx.startsWith("0xSIM") && !tx.startsWith("0xFAKE");
  return {
    id: e.id, device_evidence_id: e.device_evidence_id, project_id: e.project_id, stage_id: e.stage_id,
    project_name: e.project_name ?? null, stage_name: e.stage_name ?? null, supervisor_id: e.supervisor_id, supervisor_name: e.supervisor_name ?? null,
    file_url: e.file_url, original_filename: e.original_filename, file_size: e.file_size, mime_type: e.mime_type,
    client_sha256: e.client_sha256, server_sha256: e.server_sha256, hash_matched: !!e.hash_matched,
    captured_at: e.captured_at, server_received_at: e.server_received_at, latitude: e.latitude, longitude: e.longitude, accuracy_m: e.accuracy_m,
    distance_to_site_m: e.distance_to_site_m, is_within_radius: !!e.is_within_radius, radius_warning: !!e.radius_warning,
    blockchain_tx: tx, blockchain_status: e.blockchain_status, status: e.status, notes: e.notes,
    ai_analysis: {
      status: e.ai_status || "pending", summary: e.ai_summary, report: e.ai_report, structured_result: parseJson(e.ai_structured_result),
      analyzed_at: e.ai_analyzed_at, model: e.ai_model || env.GEMINI_MODEL, version: "1.0.0", error: e.ai_status === "failed" ? e.ai_report : null,
    },
    blockchain: {
      status: e.blockchain_status || "queued", network: e.blockchain_network || `mst-${env.MST_NETWORK}`, chain_id: e.blockchain_chain_id || Number(env.MST_CHAIN_ID),
      transaction_hash: isRealTx || e.blockchain_status === "simulated" ? tx : null, block_number: e.blockchain_block_number,
      explorer_url: isRealTx ? explorerTx(env, tx) : null, anchored_at: null, contract_address: chainConfig(env).contract_address, last_error: null,
    },
  };
}

const loadEvidence = (db: D1Database, where: string, ...params: unknown[]) => first<any>(db, `${EVIDENCE_SELECT} WHERE ${where}`, ...params);

/** Gemini construction analysis; persists result or failure on the evidence row (formerly also mirrored to Firestore). */
export async function runEvidenceAnalysis(env: Env, evidenceId: number, bytes: ArrayBuffer, mimeType: string, stageName?: string, projectName?: string) {
  await run(env.DB, "UPDATE evidence SET ai_status = 'analyzing', ai_model = ? WHERE id = ?", env.GEMINI_MODEL, evidenceId);
  try {
    const analysis = await analyzeConstruction(env, bytes, mimeType, stageName, projectName);
    await run(env.DB,
      "UPDATE evidence SET ai_status = 'completed', ai_summary = ?, ai_report = ?, ai_structured_result = ?, ai_analyzed_at = ?, ai_model = ? WHERE id = ?",
      analysis.summary, analysis.report, JSON.stringify(analysis), nowIso(), env.GEMINI_MODEL, evidenceId);
  } catch (err) {
    const code = err instanceof GeminiError ? err.code : "AI_FAILED";
    console.error(`AI vision analysis failed for evidence #${evidenceId}: [${code}]`, err);
    await run(env.DB, "UPDATE evidence SET ai_status = 'failed', ai_summary = NULL, ai_report = ? WHERE id = ?",
      `AI Analysis Failed: ${String((err as Error).message).slice(0, 300)}`, evidenceId);
  }
}

async function ensureSupervisorProject(db: D1Database, user: User, projectId: number) {
  const project = (await first<any>(db, "SELECT * FROM projects WHERE id = ?", projectId)) ?? fail(404, "Project not found");
  const member = await first(db, "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?", projectId, user.id);
  if (!member && !(await autoLinkDemoSupervisor(db, user, projectId))) fail(404, "Project not found or user is not an assigned member");
  return project;
}

supervisor.get("/projects", supervisorOnly, async (c) => {
  const user = c.get("user");
  await autoLinkDemoSupervisor(c.env.DB, user);
  const rows = await all<any>(c.env.DB,
    "SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id ASC", user.id);
  return c.json(rows.map((p) => ({ id: p.id, name: p.name, site_address: p.site_address, centroid_lat: p.centroid_lat, centroid_lng: p.centroid_lng, site_radius_m: p.site_radius_m || 200 })));
});

supervisor.get("/projects/:pid/stages", supervisorOnly, async (c) => {
  const pid = intParam(c.req.param("pid"), "pid");
  await ensureSupervisorProject(c.env.DB, c.get("user"), pid);
  const rows = await all<any>(c.env.DB, 'SELECT * FROM stages WHERE project_id = ? ORDER BY "order" ASC, id ASC', pid);
  return c.json(rows.map((s) => ({ id: s.id, project_id: s.project_id, name: s.name, order: s.order, status: s.status, verified_progress: s.verified_progress || 0 })));
});

supervisor.post("/evidence", supervisorOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  const form = await c.req.formData();
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : fail(422, `Missing form field '${k}'`);
  };
  const num = (k: string) => {
    const n = Number(field(k));
    return Number.isFinite(n) ? n : fail(422, `Form field '${k}' must be a number`);
  };
  const deviceEvidenceId = field("device_evidence_id");

  // 1. Idempotent on device_evidence_id
  const existing = await loadEvidence(db, "e.device_evidence_id = ?", deviceEvidenceId);
  if (existing) return c.json(evidenceResponse(existing, c.env), 200);

  // 2. Membership and stage
  const projectId = intParam(field("project_id"), "project_id");
  const stageId = intParam(field("stage_id"), "stage_id");
  const project = await ensureSupervisorProject(db, user, projectId);
  const stage = (await first<any>(db, "SELECT * FROM stages WHERE id = ? AND project_id = ?", stageId, projectId)) ?? fail(404, "Stage not found for this project");
  const latitude = num("latitude"), longitude = num("longitude"), accuracyM = num("accuracy_m");

  // 3. File validation
  const file = formFile(form.get("file"), "No evidence file provided");
  if (file.size === 0) fail(400, "Uploaded evidence file is empty");
  if (file.size > MAX_EVIDENCE_BYTES) fail(413, `File exceeds maximum allowed size of ${MAX_EVIDENCE_BYTES / (1024 * 1024)} MB`);
  const bytes = await file.arrayBuffer();
  const mime = sniffMime(bytes);
  if (!mime || !EVIDENCE_MIME.has(mime)) fail(400, "Invalid or corrupted image format: expected JPEG, PNG or WebP");

  // 4. Server-side SHA-256
  const serverSha = await sha256Hex(bytes);
  const clientSha = field("client_sha256").trim().toLowerCase();
  const hashMatched = serverSha === clientSha;

  // 5. Geofence (device accuracy widens the radius)
  let distance: number | null = null;
  let withinRadius = true;
  if (project.centroid_lat != null && project.centroid_lng != null) {
    distance = haversineM(latitude, longitude, project.centroid_lat, project.centroid_lng);
    withinRadius = distance <= (project.site_radius_m || 200) + Math.max(0, accuracyM);
  }

  // 6. Private storage in R2
  const key = `evidence/${serverSha}_${deviceEvidenceId.replace(/[^\w.-]/g, "_")}.jpg`;
  await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: mime! }, sha256: serverSha });

  const capturedRaw = field("captured_at");
  const capturedAt = isNaN(Date.parse(capturedRaw)) ? nowIso() : new Date(capturedRaw).toISOString();
  const notes = form.get("notes");

  // 7. Persist
  const inserted = (await first<{ id: number }>(db,
    `INSERT INTO evidence (device_evidence_id, project_id, stage_id, supervisor_id, file_path, original_filename, file_size, mime_type,
       client_sha256, server_sha256, hash_matched, captured_at, server_received_at, latitude, longitude, accuracy_m,
       distance_to_site_m, is_within_radius, radius_warning, blockchain_status, ai_status, ai_model, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'pending', ?, ?, ?) RETURNING id`,
    deviceEvidenceId, projectId, stageId, user.id, key, file.name || key.split("/")[1], file.size, mime,
    clientSha, serverSha, hashMatched ? 1 : 0, capturedAt, nowIso(), latitude, longitude, accuracyM,
    distance == null ? null : Math.round(distance * 100) / 100, withinRadius ? 1 : 0, withinRadius ? 0 : 1,
    c.env.GEMINI_MODEL, hashMatched ? "VERIFIED_SUBMITTED" : "HASH_MISMATCH_SUSPICIOUS", typeof notes === "string" ? notes : null))!;
  const evidenceId = inserted.id;
  await run(db, "UPDATE evidence SET file_url = ? WHERE id = ?", `/supervisor/evidence/${evidenceId}/file`, evidenceId);

  // 8. Alerts
  if (!hashMatched) {
    await run(db, `INSERT INTO alerts (project_id, stage_id, photo_id, type, severity, status, explanation, evidence) VALUES (?, ?, ?, 'HASH_MISMATCH', 'critical', 'open', ?, ?)`,
      projectId, stageId, evidenceId,
      `Evidence submission hash mismatch detected. Client reported ${clientSha}, but server calculated ${serverSha}.`,
      JSON.stringify({ device_evidence_id: deviceEvidenceId, evidence_id: evidenceId }));
  }
  if (!withinRadius) {
    await run(db, `INSERT INTO alerts (project_id, stage_id, photo_id, type, severity, status, explanation, evidence) VALUES (?, ?, ?, 'GEOFENCE_VIOLATION', 'medium', 'open', ?, ?)`,
      projectId, stageId, evidenceId,
      `Site photo captured ${distance!.toFixed(1)}m from site centroid (site radius ${project.site_radius_m}m, accuracy ±${accuracyM.toFixed(1)}m).`,
      JSON.stringify({ latitude, longitude, distance_m: distance, accuracy_m: accuracyM, evidence_id: evidenceId }));
  }

  // 9. Audit
  await audit(db, { actorId: user.id, action: "EVIDENCE_CAPTURED", entity: "evidence", entityId: String(evidenceId), ip: clientIp(c) ?? "unknown",
    detail: { device_evidence_id: deviceEvidenceId, project_id: projectId, stage_id: stageId, sha256: serverSha, hash_matched: hashMatched, radius_warning: !withinRadius, distance_to_site_m: distance } });

  // 10. Queue the evidence hash for anchoring on MST (relayer sends it now and the cron retries)
  const anchor = await enqueueAnchor(c.env, { entity: "photo", entityId: evidenceId, sha256: serverSha, projectId });
  await run(db, "UPDATE evidence SET blockchain_status = ?, blockchain_tx = ?, blockchain_network = ?, blockchain_chain_id = ? WHERE id = ?",
    !anchor ? "failed" : isRealChain(c.env) ? "queued" : "simulated", anchor?.tx_hash ?? null, `mst-${c.env.MST_NETWORK}`, Number(c.env.MST_CHAIN_ID), evidenceId);
  c.executionCtx.waitUntil(processAnchors(c.env));

  // 11. Background AI analysis
  c.executionCtx.waitUntil(runEvidenceAnalysis(c.env, evidenceId, bytes, mime!, stage.name, project.name));

  return c.json(evidenceResponse(await loadEvidence(db, "e.id = ?", evidenceId), c.env), 201);
});

supervisor.get("/evidence", supervisorOnly, async (c) => {
  const user = c.get("user");
  const where = ["e.supervisor_id = ?"];
  const args: unknown[] = [user.id];
  const pid = c.req.query("project_id"), sid = c.req.query("stage_id");
  if (pid) where.push("e.project_id = ?"), args.push(Number(pid));
  if (sid) where.push("e.stage_id = ?"), args.push(Number(sid));
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50) || 50, 1), 200);
  const rows = await all(c.env.DB, `${EVIDENCE_SELECT} WHERE ${where.join(" AND ")} ORDER BY e.id DESC LIMIT ?`, ...args, limit);
  return c.json(rows.map((r) => evidenceResponse(r, c.env)));
});

const ownEvidence = async (c: any) =>
  (await loadEvidence(c.env.DB, "e.id = ? AND e.supervisor_id = ?", intParam(c.req.param("id")), c.get("user").id)) ?? fail(404, "Evidence record not found");

supervisor.get("/evidence/:id", supervisorOnly, async (c) => c.json(evidenceResponse(await ownEvidence(c), c.env)));

supervisor.post("/evidence/:id/retry-ai", supervisorOnly, async (c) => {
  const ev = await ownEvidence(c);
  const obj = (await c.env.FILES.get(ev.file_path)) ?? fail(404, "Physical evidence file not found for re-analysis");
  await run(c.env.DB, "UPDATE evidence SET ai_status = 'pending' WHERE id = ?", ev.id);
  c.executionCtx.waitUntil(runEvidenceAnalysis(c.env, ev.id, await obj.arrayBuffer(), ev.mime_type || "image/jpeg", ev.stage_name, ev.project_name));
  return c.json(evidenceResponse({ ...ev, ai_status: "pending" }, c.env));
});

supervisor.post("/evidence/:id/retry-anchor", supervisorOnly, async (c) => {
  const ev = await ownEvidence(c);
  await enqueueAnchor(c.env, { entity: "photo", entityId: ev.id, sha256: ev.server_sha256, projectId: ev.project_id });
  // A failed row is re-queued with a fresh retry budget.
  await run(c.env.DB, "UPDATE chain_anchors SET status = 'pending', attempts = 0, last_error = NULL WHERE sha256 = ? AND status = 'failed'", ev.server_sha256);
  const status = isRealChain(c.env) ? "queued" : "simulated";
  if (isRealChain(c.env)) await run(c.env.DB, "UPDATE evidence SET blockchain_status = 'queued' WHERE id = ? AND blockchain_status = 'failed'", ev.id);
  c.executionCtx.waitUntil(processAnchors(c.env));
  return c.json(evidenceResponse({ ...ev, blockchain_status: ev.blockchain_status === "failed" ? status : ev.blockchain_status }, c.env));
});

supervisor.get("/evidence/:id/anchor", supervisorOnly, async (c) => c.json(evidenceResponse(await ownEvidence(c), c.env).blockchain));

// Only the capturing supervisor or an auditor may view the private original.
supervisor.get("/evidence/:id/file", requireUser, async (c) => {
  const user = c.get("user");
  const ev = (await first<any>(c.env.DB, "SELECT * FROM evidence WHERE id = ?", intParam(c.req.param("id")))) ?? fail(404, "Evidence not found");
  if (user.role !== "auditor" && ev.supervisor_id !== user.id) fail(404, "Evidence not found");
  const obj = (await c.env.FILES.get(ev.file_path)) ?? fail(404, "Stored file not found");
  return new Response(obj.body, {
    headers: { "Content-Type": ev.mime_type, "Content-Disposition": `inline; filename="${ev.original_filename.replace(/"/g, "")}"` },
  });
});

supervisor.get("/dashboard", supervisorOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  await autoLinkDemoSupervisor(db, user);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const [projects, today, total, recent] = await Promise.all([
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM project_members WHERE user_id = ?", user.id),
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM evidence WHERE supervisor_id = ? AND captured_at >= ?", user.id, todayStart.toISOString()),
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM evidence WHERE supervisor_id = ?", user.id),
    all(db, `${EVIDENCE_SELECT} WHERE e.supervisor_id = ? ORDER BY e.id DESC LIMIT 10`, user.id),
  ]);
  return c.json({
    assigned_projects_count: projects!.n, evidence_today_count: today!.n, total_submitted_count: total!.n,
    recent_submissions: recent.map((r) => evidenceResponse(r, c.env)),
  });
});

export default supervisor;
