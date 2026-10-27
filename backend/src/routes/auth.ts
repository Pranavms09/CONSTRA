import { Hono } from "hono";
import type { Context } from "hono";
import {
  clientIp, createSessionToken, ensureDemoUser, findUserByEmail, hashPassword, insertUser, isDemoMode,
  parseBearer, requireUser, timingSafeEqual, userResponse, verifyFirebaseToken, verifyPassword,
} from "../auth";
import { audit, nowIso, run } from "../db";
import { fail, jsonBody } from "../errors";
import { ROLES, type AppEnv, type Role } from "../types";

const auth = new Hono<AppEnv>();

const DEMO_ROLE_MAP: Record<Role, [string, string]> = {
  supervisor: ["supervisor@siteverify.com", "Alice Supervisor"],
  store_incharge: ["store@siteverify.com", "Bob Storekeeper"],
  auditor: ["auditor@siteverify.com", "Carol Auditor"],
};

const asRole = (v: unknown): Role | null => (ROLES.includes(v as Role) ? (v as Role) : null);

async function rateLimit(c: Context<AppEnv>) {
  const { success } = await c.env.LOGIN_LIMITER.limit({ key: clientIp(c) ?? "unknown" });
  if (!success) fail(429, "Rate limit exceeded: 10 per 1 minute");
}

const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

auth.post("/login", async (c) => {
  await rateLimit(c);
  const header = c.req.header("authorization");
  if (!header?.trim()) fail(401, "Missing Authorization header.");
  const body = await jsonBody<{ claimed_role?: string; full_name?: string }>(c.req);
  const ip = clientIp(c);
  const claims = await verifyFirebaseToken(parseBearer(header), c.env.FIREBASE_PROJECT_ID);
  const email = (claims.email ?? "").toLowerCase().trim();
  const provider = claims.firebase?.sign_in_provider;

  if (!claims.email_verified) {
    await audit(c.env.DB, { action: "login_denied", entity: "user", detail: { email, reason: "Email not verified" }, ip });
    fail(403, "Email is not verified. Please verify your email with Google.");
  }

  let user = await findUserByEmail(c.env.DB, email);
  if (!user) {
    // Allowlist: only the bootstrap auditor self-registers; everyone else is created by an auditor.
    if (!c.env.BOOTSTRAP_ADMIN_EMAIL || email !== c.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      await audit(c.env.DB, { action: "login_denied", entity: "user", detail: { email, reason: "Account not registered" }, ip });
      fail(403, "Your account is not registered. Contact your Auditor.");
    }
    user = await insertUser(c.env.DB, {
      email,
      full_name: body.full_name || claims.name || titleCase(email.split("@")[0].replaceAll(".", " ")),
      role: "auditor",
      firebase_uid: claims.uid,
      auth_provider: provider || "firebase",
    });
    await audit(c.env.DB, { actorId: user.id, action: "user_registered", entity: "user", entityId: String(user.id), detail: { email, role: user.role, provider }, ip });
  }

  if (!user.is_active) {
    await audit(c.env.DB, { actorId: user.id, action: "login_denied", entity: "user", entityId: String(user.id), detail: { email, reason: "Account disabled" }, ip });
    fail(403, "Your account is not registered or is disabled.");
  }

  await run(
    c.env.DB,
    "UPDATE users SET firebase_uid = ?, auth_provider = COALESCE(?, auth_provider), last_login_at = ?, updated_at = ? WHERE id = ?",
    claims.uid, provider ?? null, nowIso(), nowIso(), user.id
  );
  await audit(c.env.DB, { actorId: user.id, action: "login", entity: "user", entityId: String(user.id), detail: { role: user.role, claimed_role: body.claimed_role ?? null, provider }, ip });
  return c.json(userResponse(user));
});

auth.get("/me", requireUser, (c) => c.json(userResponse(c.get("user"))));

auth.post("/demo-login", async (c) => {
  if (!isDemoMode(c.env)) fail(404, "Not Found");
  const body = await jsonBody<{ role?: string }>(c.req);
  const role = asRole(body.role) ?? fail(422, "role must be one of supervisor, store_incharge, auditor");
  const [email, fullName] = DEMO_ROLE_MAP[role];
  const user = await ensureDemoUser(c.env.DB, role, email, fullName);
  await run(c.env.DB, "UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), user.id);
  await audit(c.env.DB, { actorId: user.id, action: "login", entity: "user", entityId: String(user.id), detail: { role: user.role, mode: "demo" }, ip: clientIp(c) });
  return c.json({ id: user.id, full_name: user.full_name, email: user.email, role: user.role, token: `demo-${user.role}` });
});

auth.post("/login-password", async (c) => {
  await rateLimit(c);
  const body = await jsonBody<{ email?: string; password?: string; claimed_role?: string }>(c.req);
  const ip = clientIp(c);
  const email = (body.email ?? "").toLowerCase().trim();
  const password = (body.password ?? "").trim();
  if (!email || !password) fail(400, "Email and password are required.");

  const denied = async (actorId: number | null, reason: string, extra: object = {}) =>
    audit(c.env.DB, { actorId, action: "login_denied", entity: "user", entityId: actorId ? String(actorId) : null, detail: { email, reason, ...extra }, ip });

  // Bootstrap auditor credentials come from secrets (formerly hardcoded in source).
  const isBootstrap =
    !!c.env.BOOTSTRAP_ADMIN_EMAIL && !!c.env.BOOTSTRAP_ADMIN_PASSWORD && email === c.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const bootstrapOk = isBootstrap && timingSafeEqual(password, c.env.BOOTSTRAP_ADMIN_PASSWORD!);

  let user = await findUserByEmail(c.env.DB, email);
  if (!user) {
    if (bootstrapOk) {
      user = await insertUser(c.env.DB, { email, full_name: "Bootstrap Auditor", role: "auditor", password_hash: await hashPassword(password), auth_provider: "password" });
    } else if (isBootstrap) {
      await denied(null, "Invalid password");
      fail(401, "Invalid email or password. Please verify your credentials.");
    } else {
      await denied(null, "Account not registered");
      fail(403, "Access denied: Your account is not registered. Only the Project Auditor can authorize Site Supervisors and Store In-Charges.");
    }
  }

  const valid = bootstrapOk || (await verifyPassword(password, user!.password_hash));
  if (!valid) {
    await denied(user!.id, "Invalid password");
    fail(401, "Invalid email or password. Please verify your credentials.");
  }
  if (!user!.is_active) {
    await denied(user!.id, "Account disabled");
    fail(403, "Your account is not registered or is disabled.");
  }
  // Auditors may enter under any selected role; other roles must match their DB role.
  if (body.claimed_role && user!.role !== body.claimed_role && user!.role !== "auditor") {
    await denied(user!.id, "Role mismatch", { claimed_role: body.claimed_role, actual_role: user!.role });
    fail(403, `This account is authorized as '${user!.role}', not '${body.claimed_role}'. Please select your authorized role.`);
  }

  await run(c.env.DB, "UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), user!.id);
  const token = await createSessionToken(c.env, user!.id, user!.email);
  await audit(c.env.DB, { actorId: user!.id, action: "login", entity: "user", entityId: String(user!.id), detail: { role: user!.role, claimed_role: body.claimed_role ?? null, provider: "password" }, ip });
  return c.json({ ...userResponse(user!), token });
});

export default auth;
