import { beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import worker from "../src/index";
import { toBase } from "../src/services/store";

// Firebase token verification is stubbed: each test sets the claims the "verified" token carries.
vi.mock("jose", () => ({ createRemoteJWKSet: () => ({}), jwtVerify: vi.fn() }));

const STORE_USER = { id: 7, email: "store@siteverify.com", full_name: "Bob Storekeeper", role: "store_incharge", is_active: 1, password_hash: null, firebase_uid: null, auth_provider: "demo", wallet_address: null };

/** Minimal D1 stub: every `.first()` returns `row`; writes succeed. */
function makeEnv(row: unknown) {
  const stmt = { first: async () => row, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) };
  const limiter = { limit: async () => ({ success: true }) };
  return {
    DB: { prepare: () => ({ bind: () => stmt }) }, FILES: {}, LOGIN_LIMITER: limiter, VERIFY_LIMITER: limiter,
    FIREBASE_PROJECT_ID: "test", FRONTEND_ORIGINS: "", DEMO_MODE: "true", SECRET_KEY: "s",
  } as any;
}
const ctx = { waitUntil() {}, passThroughOnException() {} } as any;
const call = (env: any, method: string, path: string, token?: string, body?: unknown) =>
  worker.fetch(new Request(`http://api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env, ctx);

const firebaseClaims = (claims: object) => vi.mocked(jwtVerify).mockResolvedValue({ payload: { sub: "uid1", ...claims } } as any);

describe("auth and authorization guards", () => {
  beforeEach(() => vi.mocked(jwtVerify).mockReset());

  it("rejects an unverified email/password Firebase account on login and on every request", async () => {
    firebaseClaims({ email: "auditor@siteverify.com", email_verified: false, firebase: { sign_in_provider: "password" } });
    expect((await call(makeEnv(STORE_USER), "POST", "/auth/login", "fb-token", {})).status).toBe(403);
    expect((await call(makeEnv(STORE_USER), "GET", "/auth/me", "fb-token")).status).toBe(403);
  });

  it("does not let an unregistered Google account self-register with a claimed role", async () => {
    firebaseClaims({ email: "stranger@gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" } });
    expect((await call(makeEnv(null), "POST", "/auth/login", "fb-token", { claimed_role: "auditor" })).status).toBe(403);
  });

  it("requires login for the claims API", async () => {
    expect((await call(makeEnv(null), "POST", "/api/v1/claims", undefined, { id: "CLM-2026-001" })).status).toBe(401);
    expect((await call(makeEnv(null), "GET", "/api/v1/claims")).status).toBe(401);
  });

  it("stops a store in-charge from resolving alerts", async () => {
    const res = await call(makeEnv(STORE_USER), "PATCH", "/store/alerts/1", "demo-store_incharge", { status: "resolved", justification: "looks fine to me" });
    expect(res.status).toBe(403);
  });

  it("rejects zero and negative quantities", async () => {
    for (const qty of [0, -500]) await expect(toBase(makeEnv(null).DB, 1, "kg", qty)).rejects.toMatchObject({ status: 422 });
  });
});
