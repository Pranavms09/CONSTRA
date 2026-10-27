import { Hono } from "hono";
import { clientIp, requireUser } from "../auth";
import { all, audit, first } from "../db";
import { fail } from "../errors";
import { analyzeExifGps, analyzeStoredExif, EXIF_PREFIX_BYTES } from "../lib/exif";
import { describeImage } from "../lib/gemini";
import { EXT_BY_MIME, sha256Hex, sniffMime } from "../lib/util";
import type { AppEnv } from "../types";

const analysis = new Hono<AppEnv>();

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);

const health = (c: any) => c.json({ status: "ok", app: "SiteVerify API", gemini_configured: !!c.env.GEMINI_API_KEY, model: c.env.GEMINI_MODEL });
analysis.get("/health", health);
analysis.get("/api/health", health);

const analyzeImage = async (c: any) => {
  const form = await c.req.formData().catch(() => fail(400, "Expected multipart/form-data upload."));
  const upload = form.get("file") ?? form.get("image");
  if (!(upload instanceof File)) fail(400, "No image file provided. Please upload an image using the 'file' or 'image' field.");
  const file = upload as File;
  const user = c.get("user");
  // Each call spends Gemini quota: 10 per minute per user (separate key space on the verify limiter).
  const { success } = await c.env.VERIFY_LIMITER.limit({ key: `analyze:${user.id}` });
  if (!success) fail(429, "Rate limit exceeded: 10 image analyses per minute");

  if (file.size === 0) fail(400, "Uploaded file is empty. Please select a valid image file.");
  if (file.size > MAX_FILE_SIZE) fail(400, `Image file exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
  const bytes = await file.arrayBuffer();
  const mime = sniffMime(bytes);
  if (!mime || !IMAGE_MIME.has(mime)) fail(400, "The uploaded file is not a valid or readable image. Allowed formats: JPG, PNG, WEBP, GIF, BMP.");

  const hash = await sha256Hex(bytes);
  const duplicate = await first<{ id: number }>(c.env.DB, "SELECT id FROM image_analyses WHERE file_hash = ? ORDER BY id LIMIT 1", hash);
  const savedName = `evd_${hash.slice(0, 16)}${EXT_BY_MIME[mime!]}`;
  await c.env.FILES.put(`uploads/${savedName}`, bytes, { httpMetadata: { contentType: mime! }, sha256: hash });

  let exif = null;
  try {
    exif = await analyzeExifGps(bytes.slice(0, EXIF_PREFIX_BYTES), {
      siteLatitude: 28.628, siteLongitude: 77.3649, siteRadiusM: 350, maxCaptureAgeHours: 48, fileName: savedName, fileSha256: hash,
    });
  } catch (err) {
    console.warn("EXIF analysis note:", err);
  }

  const description = await describeImage(c.env, bytes, mime!);
  const record = await first<any>(c.env.DB,
    `INSERT INTO image_analyses (filename, content_type, file_size, file_hash, description, model, source, uploaded_by_id)
     VALUES (?, ?, ?, ?, ?, ?, 'backend_gemini_vision', ?) RETURNING id, created_at`,
    file.name || "unknown_image.jpg", mime, file.size, hash, description, c.env.GEMINI_MODEL, user.id);
  await audit(c.env.DB, {
    actorId: user.id, action: "image_analysis", entity: "image_analysis", entityId: hash.slice(0, 16), ip: clientIp(c),
    detail: { filename: file.name, saved_filename: savedName, file_size: file.size, is_duplicate: !!duplicate, model: c.env.GEMINI_MODEL, source: "backend_gemini_vision" },
  });

  return c.json({
    status: "success", description, filename: file.name || "unknown_image.jpg", id: record?.id ?? null, file_size: file.size,
    file_hash: hash, file_url: `/uploads/${savedName}`, is_duplicate: !!duplicate, duplicate_of_id: duplicate?.id ?? null,
    exif_gps: exif, model: c.env.GEMINI_MODEL, source: "backend_gemini_vision", created_at: record?.created_at ?? null,
  });
};
analysis.post("/api/analyze-image", requireUser, analyzeImage);
analysis.post("/analyze-image", requireUser, analyzeImage);

const listAnalyses = async (c: any) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20) || 20, 1), 200);
  const rows = await all(c.env.DB, "SELECT * FROM image_analyses ORDER BY id DESC LIMIT ?", limit);
  return c.json(rows);
};
analysis.get("/api/analyses", requireUser, listAnalyses);
analysis.get("/analyses", requireUser, listAnalyses);

// AI-generated descriptions are immutable.
for (const path of ["/api/analyze-image/:id", "/analyze-image/:id"]) {
  analysis.on(["PUT", "PATCH"], path, () => fail(403, "AI-generated descriptions are strictly immutable and cannot be modified."));
}

// Analysis images are public (as the old /uploads static mount was); evidence and challans stay private.
analysis.get("/uploads/:name", async (c) => {
  const name = c.req.param("name");
  if (!/^[\w.-]+$/.test(name)) fail(400, "Invalid filename");
  const obj = (await c.env.FILES.get(`uploads/${name}`)) ?? fail(404, "Not Found");
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=86400" } });
});

// DEMO ONLY (as before): hardcoded project lookup for the EXIF report endpoint.
const DEMO_PROJECTS: Record<string, { latitude: number; longitude: number; site_radius_m: number; max_capture_age_hours: number }> = {
  "project-001": { latitude: 12.9716, longitude: 77.5946, site_radius_m: 200, max_capture_age_hours: 24 },
};

analysis.get("/api/v1/projects/:projectId/evidence/:fileName/exif-gps", async (c) => {
  const project = DEMO_PROJECTS[c.req.param("projectId")] ?? fail(404, "Project not found");
  const name = c.req.param("fileName");
  if (!/^[\w.-]+$/.test(name)) fail(400, "Invalid filename");
  let report;
  try {
    report = await analyzeStoredExif(c.env.FILES, `uploads/${name}`, {
      siteLatitude: project.latitude, siteLongitude: project.longitude, siteRadiusM: project.site_radius_m, maxCaptureAgeHours: project.max_capture_age_hours,
    });
  } catch (err) {
    return fail(422, (err as Error).message);
  }
  return report ? c.json(report) : fail(404, "Evidence file not found");
});

export default analysis;
