import { Hono } from "hono";
import { requireRole, requireUser } from "../auth";
import { all, audit, first, nowIso, parseJson, run, stmt } from "../db";
import { fail, jsonBody } from "../errors";
import { analyzeStoredExif } from "../lib/exif";
import { analyzeConstruction } from "../lib/gemini";
import { canonicalJson, sha256Hex } from "../lib/util";
import { enqueueAnchor, explorerTx, isRealChain, processAnchors } from "../services/chain";
import type { AppEnv } from "../types";

// Claims Audit Desk. Claims were a JSON file + in-memory jobs; both now live in D1 as JSON documents.
const claims = new Hono<AppEnv>();

const SITE = { siteLatitude: 20.03639, siteLongitude: 73.79959 };
const COMMANDS = ["run_ocr", "run_vlm", "run_exif", "run_all", "rerun_field"];
// Which engine re-extracts a field for `rerun_field`.
const FIELD_ENGINE: Record<string, string> = { damage_severity: "run_vlm", gps_distance_m: "run_exif", stated_total: "run_ocr" };
const VLM_CONFIDENCE: Record<string, number> = { high: 0.9, medium: 0.7, low: 0.5 };

const loadClaim = async (db: D1Database, id: string) =>
  parseJson<any>((await first<{ data: string }>(db, "SELECT data FROM claims WHERE id = ?", id))?.data);
const saveClaim = (db: D1Database, claim: any) =>
  run(db, "INSERT INTO claims (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data", claim.id, JSON.stringify(claim));
const claimOr404 = async (db: D1Database, id: string) => (await loadClaim(db, id)) ?? fail(404, "Claim not found");

const certResponse = (c: any) => ({
  id: c.id, certificate_number: c.certificate_number, project_id: c.project_id, stage_id: c.stage_id, claim_id: c.claim_id,
  auditor_id: c.auditor_id, auditor_name: c.auditor_name ?? null, auditor_email: c.auditor_email ?? null, verdict: c.verdict,
  verdict_note: c.verdict_note, evidence_hashes: c.evidence_hashes, verification_summary: c.verification_summary,
  certificate_hash: c.certificate_hash, issued_at: c.issued_at,
});
const CERT_SELECT = "SELECT cc.*, u.full_name AS auditor_name, u.email AS auditor_email FROM clearance_certificates cc LEFT JOIN users u ON u.id = cc.auditor_id";

const photoKey = (claim: any) => {
  const photo = (claim.files ?? []).find((f: any) => f.kind === "photo");
  if (!photo) return null;
  if (typeof photo.url === "string" && photo.url.startsWith("/uploads/")) return photo.url.slice(1);
  return photo.name ? `uploads/${String(photo.name).split("/").pop()}` : null;
};

/** The claim's project and stage, or 422: claims never fall back to another project's stage. */
async function claimTarget(db: D1Database, projectId: unknown, stageId: unknown) {
  const project = (await first<any>(db, "SELECT * FROM projects WHERE id = ?", Number(projectId))) ?? fail(422, "Claim project not found.");
  const stage = (await first<any>(db, "SELECT * FROM stages WHERE id = ? AND project_id = ?", Number(stageId), project.id)) ?? fail(422, "Claim stage not found in its project.");
  return { project, stage };
}

async function photoExif(env: AppEnv["Bindings"], claim: any) {
  const key = photoKey(claim);
  if (!key) return null;
  try {
    return await analyzeStoredExif(env.FILES, key, SITE);
  } catch {
    return null;
  }
}

claims.get("/claims", requireUser, async (c) => {
  const rows = await all<{ data: string }>(c.env.DB, "SELECT data FROM claims ORDER BY created_at ASC");
  return c.json(rows.map((r) => {
    const cl = JSON.parse(r.data);
    return {
      id: cl.id, claimant: cl.claimant ?? "PVGCOE Nashik Infrastructure", submitter_id: cl.submitter_id ?? null, submitter_email: cl.submitter_email ?? null,
      policy_no: cl.policy_no ?? "POL-INSP-001", project_id: cl.project_id ?? "1", stage_id: cl.stage_id ?? null,
      type: cl.type ?? "Stage Milestone Verification", filed_at: cl.filed_at ?? nowIso(), risk: cl.risk ?? "LOW",
      status: cl.status ?? "UNDER_REVIEW", file_count: (cl.files ?? []).length, has_report: cl.report != null, ai: cl.ai ?? {},
    };
  }));
});

claims.post("/claims", requireRole("supervisor"), async (c) => {
  const db = c.env.DB;
  const p = await jsonBody<any>(c.req);
  const user = c.get("user");
  const { project, stage } = await claimTarget(db, p.project_id, p.stage_id);
  // Server-made id + plain INSERT: a client cannot overwrite an existing claim, and parallel creates never collide.
  const claimId = `CLM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const subId = user.id;
  const subName = user.full_name;

  const claim = {
    id: claimId,
    claimant: subName || user.email,
    submitter_id: subId,
    submitter_email: user.email,
    policy_no: p.policy_no || "POL-INSP-LOT81",
    project_id: String(project.id),
    stage_id: stage.id,
    type: p.type || "Stage #02: Structural Slab Concrete Casting & Rebar Binding",
    filed_at: p.filed_at || nowIso(),
    risk: p.risk || "LOW",
    status: "UNDER_REVIEW",
    files: p.files || [],
    ai: p.ai || {},
    decisions: p.decisions || {},
    line_items: p.line_items || [],
    report: p.report ?? null,
  };
  await run(db, "INSERT INTO claims (id, data) VALUES (?, ?)", claim.id, JSON.stringify(claim));
  await run(db, "UPDATE stages SET status = 'UNDER_REVIEW' WHERE id = ?", stage.id);
  await audit(db, { actorId: subId, action: "claim_submitted", entity: "claim", entityId: claimId,
    detail: { claim_id: claimId, project_id: project.id, stage_id: stage.id, file_count: claim.files.length, submitter: subName } });

  return c.json({ status: "success", message: `Claim ${claimId} created and transmitted to Auditor Queue.`, claim });
});

claims.get("/claims/:id", requireUser, async (c) => {
  const claim = await claimOr404(c.env.DB, c.req.param("id"));
  return c.json({ ...claim, exif_report: await photoExif(c.env, claim) });
});

claims.post("/claims/:id/commands", requireRole("auditor"), async (c) => {
  const db = c.env.DB;
  const claim = await claimOr404(db, c.req.param("id"));
  const req = await jsonBody<{ command?: string; params?: any }>(c.req);
  if (!COMMANDS.includes(req.command ?? "")) fail(400, "Invalid agent command");
  const fieldKey = req.params?.fieldKey;
  if (req.command === "rerun_field" && !FIELD_ENGINE[fieldKey]) fail(400, `No extraction engine re-runs field '${fieldKey}'.`);
  const command = req.command === "rerun_field" ? FIELD_ENGINE[fieldKey] : req.command!;
  const jobId = `job_${crypto.randomUUID()}`;
  const job: any = { jobId, claimId: claim.id, command: req.command, state: "running", step: "Initializing agent tools...", created_at: nowIso() };

  try {
    const results: Record<string, any> = {};
    const notes: string[] = [];
    const ai = (claim.ai ??= {});
    if (command === "run_ocr" || command === "run_all") {
      // Claims carry site photos only; there is no document for OCR to read, so no value is invented.
      if (command === "run_ocr") throw new Error("Text extraction needs a document file; this claim has only site photos.");
      notes.push("Text extraction skipped: no document attached.");
    }
    if (command === "run_vlm" || command === "run_all") {
      const key = photoKey(claim);
      const obj = key ? await c.env.FILES.get(key) : null;
      if (!obj) throw new Error("Site photo not found in storage for VLM analysis.");
      const analysis = await analyzeConstruction(c.env, await obj.arrayBuffer(), obj.httpMetadata?.contentType ?? "image/jpeg", claim.type, null);
      const level = String((analysis.stage_assessment as any)?.confidence ?? "").toLowerCase();
      results.damage_severity = { fieldKey: "damage_severity", value: analysis.summary, confidence: VLM_CONFIDENCE[level] ?? 0.5, source: "Gemini Vision (Site Photo Analysis)", source_ref: key };
      // Set only here, never from the client payload: approval reads it as "the server ran the VLM".
      claim.vlm_verified_at = nowIso();
    }
    if (command === "run_exif" || command === "run_all") {
      const report = await photoExif(c.env, claim);
      const gps = report?.checks.find((ch) => ch.name === "gps_geofence");
      const photo = (claim.files ?? []).find((f: any) => f.kind === "photo");
      results.gps_distance_m = { fieldKey: "gps_distance_m", value: (gps?.details as any)?.distance_from_site_m ?? 0.0, confidence: 0.99, source: "EXIF GPS Geofence Check", source_ref: photo?.name || "Site Photo" };
    }

    claim.decisions ??= {};
    for (const [key, r] of Object.entries(results)) {
      const prev = ai[key];
      ai[key] = r;
      const d = claim.decisions[key];
      if (d?.dec && prev && prev.value !== r.value) d.stale = true;
    }
    await saveClaim(db, claim);
    Object.assign(job, { state: "succeeded", step: "Extraction completed successfully.", results, notes });
  } catch (err) {
    Object.assign(job, { state: "failed", error: String((err as Error).message ?? err) });
  }
  await run(db, "INSERT INTO jobs (id, data) VALUES (?, ?)", jobId, JSON.stringify(job));
  return c.json({ jobId, state: job.state });
});

claims.get("/jobs/:id", requireUser, async (c) =>
  c.json(parseJson((await first<{ data: string }>(c.env.DB, "SELECT data FROM jobs WHERE id = ?", c.req.param("id")))?.data) ?? fail(404, "Job not found")));

claims.post("/claims/:id/decisions", requireRole("auditor"), async (c) => {
  const claim = await claimOr404(c.env.DB, c.req.param("id"));
  const body = await jsonBody<{ decisions?: Record<string, any> }>(c.req);
  if (!body.decisions || typeof body.decisions !== "object") fail(422, "decisions object is required");
  claim.decisions = body.decisions;
  await saveClaim(c.env.DB, claim);
  return c.json({ status: "ok", decisions: claim.decisions });
});

claims.post("/claims/:id/submit", requireRole("auditor"), async (c) => {
  const db = c.env.DB;
  const user = c.get("user");
  const claim = await claimOr404(db, c.req.param("id"));
  const body = await jsonBody<{ verdict?: string; verdictNote?: string; decisions?: Record<string, any> }>(c.req);
  if (typeof body.verdict !== "string" || !body.decisions || typeof body.decisions !== "object") fail(422, "verdict and decisions are required");
  const verdict = body.verdict!;
  const decisions = body.decisions!;
  const note = (body.verdictNote ?? "").trim();

  // Self-approval guard: the approver cannot be the milestone submitter.
  const selfApproval =
    (claim.submitter_id && claim.submitter_id === user.id) ||
    (claim.submitter_email && String(claim.submitter_email).toLowerCase().trim() === user.email.toLowerCase().trim()) ||
    (user.full_name && claim.claimant && user.full_name.toLowerCase().trim() === String(claim.claimant).toLowerCase().trim());
  if (selfApproval) fail(403, "Self-approval violation: The approver cannot be the milestone submitter.");
  if (claim.status === "CLEARED") fail(400, "Milestone is already CLEARED. Conflicting concurrent approval detected.");

  const { project, stage } = await claimTarget(db, claim.project_id, claim.stage_id);
  const pid = project.id;

  const decs = Object.values(decisions);
  const amended = decs.filter((d: any) => d?.dec === "amend");
  const flagged = decs.filter((d: any) => d?.dec === "flag");
  const stale = decs.filter((d: any) => d?.stale);

  // Rejection workflow
  if (["disagree", "flag", "reject"].includes(verdict)) {
    if (note.length < 5) fail(422, "A mandatory written reason of at least 5 characters is required when rejecting a milestone.");
    const report = { claim_id: claim.id, verdict, verdict_note: note, decisions, submitted_at: nowIso(), auditor_id: user.id, auditor_email: user.email, status: "FLAGGED" };
    Object.assign(claim, { report, status: "FLAGGED" });
    await saveClaim(db, claim);
    await run(db, "UPDATE stages SET status = 'FLAGGED' WHERE id = ?", stage.id);
    await audit(db, { actorId: user.id, action: "milestone_rejected", entity: "stage", entityId: String(stage.id), detail: { claim_id: claim.id, verdict, reason: note } });
    return c.json({ status: "success", message: "Milestone rejected and flagged with mandatory written reason recorded in audit trail.", report });
  }

  // Approval workflow: collect blockers
  const blockers: string[] = [];
  if (stale.length) blockers.push("Cannot approve: Re-review fields marked stale.");
  if (verdict === "agree" && (amended.length || flagged.length)) blockers.push("Verdict 'Agree' is not allowed when fields are Amended or Flagged.");
  if (verdict === "amend" && !amended.length) blockers.push("Verdict 'Agree with amendments' requires at least one Amended field.");

  const [openAlerts, processing, confirmed] = await Promise.all([
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM alerts WHERE project_id = ? AND status IN ('open','acknowledged') AND severity IN ('critical','high')", pid),
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM challans WHERE project_id = ? AND status = 'processing'", pid),
    all<{ sha256: string }>(db, "SELECT sha256 FROM challans WHERE project_id = ? AND status = 'confirmed'", pid),
  ]);
  if (openAlerts!.n) blockers.push(`Unresolved ${openAlerts!.n} critical/high severity alert(s) remain on this project. Resolve all critical alerts before approval.`);
  const photos = (claim.files ?? []).filter((f: any) => f.kind === "photo");
  if (!photos.length) blockers.push("Required photo verification evidence is missing from this submission.");
  // Computed from the stored photo now; the client never supplies the EXIF verdict.
  const exif = await photoExif(c.env, claim);
  const geofence = exif?.checks.find((ch) => ch.name === "gps_geofence");
  if (geofence?.status === "FAIL") {
    blockers.push("Photo EXIF GPS geofence check failed: Photo coordinates are outside permitted project boundary.");
  }
  if (processing!.n) blockers.push(`${processing!.n} delivery challan(s) remain in processing state. Confirm material challans before milestone clearance.`);
  if (blockers.length) fail(422, { message: "Milestone approval blocked: Required verification criteria not satisfied.", blockers });

  // All checks passed: clear the stage and issue a certificate.
  const issuedAt = nowIso();
  const stageId = stage.id;
  const certNumber = `CERT-SV-${pid}-${stageId}-${Math.floor(Date.now() / 1000)}`;
  const photoHashes = await Promise.all(photos.map(async (f: any) => f.sha256 || claim.ai?.fileHash || (await sha256Hex(String(f.name ?? "")))));
  const challanHashes = confirmed.map((r) => r.sha256);
  const certHash = await sha256Hex(canonicalJson({
    certificate_number: certNumber, project_name: project.name, stage_name: stage.name,
    auditor: user.full_name || user.email, auditor_id: user.id, verdict, photo_hashes: photoHashes, challan_hashes: challanHashes, issued_at: issuedAt,
  }));

  const [, certRow] = await db.batch([
    stmt(db, "UPDATE stages SET status = 'CLEARED', verified_progress = 1.0 WHERE id = ?", stage.id),
    stmt(db,
      `INSERT INTO clearance_certificates (certificate_number, project_id, stage_id, claim_id, auditor_id, verdict, verdict_note, evidence_hashes, verification_summary, certificate_hash, issued_at)
       VALUES (?, ?, ?, ?, ?, 'CLEARED', ?, ?, ?, ?, ?) RETURNING id`,
      certNumber, pid, stageId, claim.id, user.id, body.verdictNote ?? "", JSON.stringify(photoHashes),
      JSON.stringify({ photos_verified: photos.length, challans_reconciled: challanHashes.length, exif_geofence_verified: geofence?.status === "PASS", ai_vlm_verified: !!claim.vlm_verified_at }),
      certHash, issuedAt),
  ]);
  const certId = (certRow.results[0] as { id: number }).id;
  const certificate = certResponse(await first(db, `${CERT_SELECT} WHERE cc.id = ?`, certId));

  // Anchor the certificate seal on MST. An auditor with a linked BridgeKey wallet signs it themselves;
  // otherwise the relayer anchors it.
  const awaitSigner = isRealChain(c.env) && !!user.wallet_address;
  const anchor = await enqueueAnchor(c.env, { entity: "certificate", entityId: certId, sha256: certHash, projectId: pid, awaitSigner });
  if (!awaitSigner) c.executionCtx.waitUntil(processAnchors(c.env));
  const chain = {
    status: anchor?.status ?? "failed", awaiting_wallet_signature: awaitSigner, contract_address: c.env.CONTRACT_ADDRESS || null,
    chain_id: Number(c.env.MST_CHAIN_ID), tx_hash: anchor?.tx_hash ?? null, explorer_url: explorerTx(c.env, anchor?.tx_hash),
  };

  const report = { claim_id: claim.id, verdict, verdict_note: body.verdictNote, decisions, ai_snapshot: claim.ai ?? {}, submitted_at: issuedAt, sha256: certHash, certificate };
  Object.assign(claim, { report, status: "CLEARED" });
  await saveClaim(db, claim);
  await audit(db, { actorId: user.id, action: "milestone_approved", entity: "clearance_certificate", entityId: certNumber,
    detail: { claim_id: claim.id, certificate_number: certNumber, certificate_hash: certHash, project_id: pid, stage_id: stageId } });

  return c.json({
    status: "success",
    message: `Milestone CLEARED! Clearance certificate #${certNumber} issued with cryptographic SHA-256 seal ${certHash.slice(0, 12)}...`,
    report,
    certificate,
    chain,
  });
});

claims.get("/claims/:id/certificate", requireUser, async (c) => {
  const cert = await first(c.env.DB, `${CERT_SELECT} WHERE cc.claim_id = ? ORDER BY cc.id DESC LIMIT 1`, c.req.param("id"));
  if (cert) return c.json(certResponse(cert));
  const claim = await loadClaim(c.env.DB, c.req.param("id"));
  if (claim && claim.status !== "CLEARED") fail(400, "Clearance certificate is only generated after milestone approval.");
  return fail(404, "Clearance certificate not found");
});

claims.get("/stages/:id/certificate", requireUser, async (c) => {
  const cert = await first(c.env.DB, `${CERT_SELECT} WHERE cc.stage_id = ? ORDER BY cc.id DESC LIMIT 1`, Number(c.req.param("id")));
  return cert ? c.json(certResponse(cert)) : fail(404, "No clearance certificate issued for this stage.");
});

export default claims;
