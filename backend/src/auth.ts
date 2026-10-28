import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Context, MiddlewareHandler } from "hono";
import { first, run } from "./db";
import { ApiError, fail } from "./errors";
import type { AppEnv, Env, Role, User } from "./types";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export const DEMO_USERS: Record<string, [string, string, Role]> = {
  "demo-supervisor": ["supervisor@siteverify.com", "Alice Supervisor", "supervisor"],
  "demo-store": ["store@siteverify.com", "Bob Storekeeper", "store_incharge"],
  "demo-store_incharge": ["store@siteverify.com", "Bob Storekeeper", "store_incharge"],
  "demo-auditor": ["auditor@siteverify.com", "Carol Auditor", "auditor"],
};

export interface FirebaseClaims extends JWTPayload {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  firebase?: { sign_in_provider?: string };
}

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

export const isDemoMode = (env: Env) => env.DEMO_MODE !== "false";
export const clientIp = (c: Context) => c.req.header("cf-connecting-ip") ?? null;

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifies a Firebase ID token against Google's public keys (signature, issuer, audience, expiry). */
export async function verifyFirebaseToken(token: string, projectId: string): Promise<FirebaseClaims> {
  if (!token) fail(401, "Invalid or expired login");
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return { ...payload, uid: String(payload.user_id ?? payload.sub) } as FirebaseClaims;
  } catch {
    return fail(401, "Invalid or expired login");
  }
}

// shortcut: 10k PBKDF2 iterations keeps hashing inside the free plan's 10 ms CPU budget; raise on Workers Paid.
const PBKDF2_ITERATIONS = 10_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt.buffer)}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  const parts = stored?.split("$");
  if (!parts || parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  return timingSafeEqual(await pbkdf2(password, fromHex(parts[2]), Number(parts[1])), parts[3]);
}

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

function requireSecret(env: Env) {
  if (!env.SECRET_KEY) throw new ApiError(500, "SECRET_KEY is not configured on the server.");
  return env.SECRET_KEY;
}

const SESSION_TTL_S = 24 * 60 * 60;
const sessionSig = async (env: Env, userId: number, email: string, exp: number) =>
  (await hmacHex(requireSecret(env), `${userId}:${email.toLowerCase().trim()}:${exp}`)).slice(0, 32);

/** `sv-<userId>-<expiry unix s>-<hmac>`: the signed expiry keeps a leaked token (e.g. from a ?token= URL) short-lived. */
export async function createSessionToken(env: Env, userId: number, email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  return `sv-${userId}-${exp}-${await sessionSig(env, userId, email, exp)}`;
}

async function verifySessionToken(env: Env, token: string): Promise<User | null> {
  const parts = token.split("-");
  if (parts.length !== 4 || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2])) return null;
  const exp = Number(parts[2]);
  if (exp < Date.now() / 1000) return null;
  const user = await first<User>(env.DB, "SELECT * FROM users WHERE id = ?", Number(parts[1]));
  if (!user || !user.is_active) return null;
  return timingSafeEqual(parts[3], await sessionSig(env, user.id, user.email, exp)) ? user : null;
}

export const findUserByEmail = (db: D1Database, email: string) =>
  first<User>(db, "SELECT * FROM users WHERE lower(email) = ?", email.toLowerCase().trim());

export async function insertUser(
  db: D1Database,
  u: { email: string; full_name: string; role: Role; firebase_uid?: string | null; auth_provider: string; password_hash?: string | null }
) {
  return (await first<User>(
    db,
    `INSERT INTO users (email, full_name, role, is_active, firebase_uid, auth_provider, password_hash)
     VALUES (?, ?, ?, 1, ?, ?, ?) RETURNING *`,
    u.email.toLowerCase(),
    u.full_name,
    u.role,
    u.firebase_uid ?? null,
    u.auth_provider,
    u.password_hash ?? null
  ))!;
}

export async function ensureDemoUser(db: D1Database, role: Role, email: string, fullName: string) {
  return (await findUserByEmail(db, email)) ?? insertUser(db, { email, full_name: fullName, role, firebase_uid: `uid_${role}`, auth_provider: "demo" });
}

export function parseBearer(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) fail(401, "Invalid or expired login");
  return authorization!.slice(7).trim();
}

/** Resolves the Bearer token (session, demo, or Firebase) to an active DB user. Roles always come from the DB. */
export async function resolveUser(env: Env, authorization: string | undefined): Promise<User> {
  if (!authorization?.trim()) fail(401, "Authentication token required. Please sign in.");
  const token = parseBearer(authorization);

  if (token.startsWith("sv-")) {
    const user = await verifySessionToken(env, token);
    if (!user) fail(401, "Invalid or expired session token");
    return user!;
  }

  if (token.startsWith("demo-")) {
    const demo = DEMO_USERS[token];
    if (!demo || !isDemoMode(env)) fail(401, "Invalid demo token");
    return ensureDemoUser(env.DB, demo[2], demo[0], demo[1]);
  }

  const claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
  const provider = claims.firebase?.sign_in_provider;
  // Every provider: an unverified email/password account could otherwise claim someone else's address.
  if (!claims.email_verified) fail(403, "Email is not verified");
  const email = (claims.email ?? "").toLowerCase().trim();
  if (!email) fail(401, "Token missing email claim");

  let user = await first<User>(env.DB, "SELECT * FROM users WHERE lower(email) = ? OR firebase_uid = ?", email, claims.uid);
  if (!user) {
    if (env.BOOTSTRAP_ADMIN_EMAIL && email === env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      user = await insertUser(env.DB, {
        email,
        full_name: claims.name || "Bootstrap Project Auditor",
        role: "auditor",
        firebase_uid: claims.uid,
        auth_provider: provider || "google",
      });
    } else {
      fail(403, "Your account is not registered. Contact your Auditor.");
    }
  }
  if (!user!.is_active) fail(403, "Your account is not registered or is disabled.");
  return user!;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", await resolveUser(c.env, c.req.header("authorization")));
  await next();
};

export const requireRole = (...allowed: Role[]): MiddlewareHandler<AppEnv> => async (c, next) => {
  const user = await resolveUser(c.env, c.req.header("authorization"));
  if (!allowed.includes(user.role)) fail(403, "Not allowed");
  c.set("user", user);
  await next();
};

export async function optionalUser(c: Context<AppEnv>): Promise<User | null> {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return await resolveUser(c.env, header);
  } catch {
    return null;
  }
}

/** Auditors see every project; site roles need a project_members row. 404 (not 403) avoids leaking existence. */
export async function ensureProjectAccess(db: D1Database, user: User, projectId: number) {
  const project = await first(db, "SELECT * FROM projects WHERE id = ?", projectId);
  if (!project) fail(404, "Project not found");
  if (user.role !== "auditor") {
    const member = await first(db, "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?", projectId, user.id);
    if (!member) fail(404, "Project not found");
  }
  return project!;
}

/** Demo supervisor is auto-linked to the first project so the demo flow works on a fresh database. */
export async function autoLinkDemoSupervisor(db: D1Database, user: User, projectId?: number) {
  if (user.email.toLowerCase() !== "supervisor@siteverify.com") return false;
  const pid = projectId ?? (await first<{ id: number }>(db, "SELECT id FROM projects ORDER BY id LIMIT 1"))?.id;
  if (!pid) return false;
  await run(db, "INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'supervisor')", pid, user.id);
  return true;
}

export const userResponse = (u: User) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role, is_active: !!u.is_active, wallet_address: u.wallet_address ?? null, has_password: !!u.password_hash });
