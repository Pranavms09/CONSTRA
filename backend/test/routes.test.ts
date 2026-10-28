import { beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { privateKeyToAccount } from "viem/accounts";
import worker from "../src/index";
import { readRole } from "../src/services/chain";
import { toBase } from "../src/services/store";

// Firebase token verification is stubbed: each test sets the claims the "verified" token carries.
vi.mock("jose", () => ({ createRemoteJWKSet: () => ({}), jwtVerify: vi.fn() }));
// AccessRegistry.roleOf is stubbed: each wallet test sets the role "on MST".
vi.mock("../src/services/chain", async (orig) => ({ ...(await orig<typeof import("../src/services/chain")>()), readRole: vi.fn() }));

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

describe("wallet sign-in on MST", () => {
  // Hardhat's well-known test key #0: never funded on MST.
  const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const message = `CONSTRA sign-in on MST Blockchain\nWallet: ${account.address}\nNonce: n1`;
  const future = new Date(Date.now() + 60_000).toISOString();
  const row = (extra: object = {}) => ({ ...STORE_USER, wallet_address: account.address, address: account.address, message, expires_at: future, ...extra });
  const mstEnv = (r: unknown) => ({ ...makeEnv(r), CHAIN_MODE: "mst", MST_CHAIN_ID: "91562037", ACCESS_REGISTRY_ADDRESS: "0x0000000000000000000000000000000000000001" });
  const login = async (env: any, extra: object = {}) =>
    call(env, "POST", "/auth/wallet/login", undefined, { address: account.address, nonce: "n1", signature: await account.signMessage({ message }), ...extra });

  beforeEach(() => vi.mocked(readRole).mockReset());

  it("issues a challenge that names the wallet and MST chain", async () => {
    const res = await call(mstEnv(null), "POST", "/auth/wallet/challenge", undefined, { address: account.address.toLowerCase() });
    const body: any = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toContain(`Wallet: ${account.address}`);
    expect(body.message).toContain("MST chain: 91562037");
  });

  it("is unavailable without the real MST chain", async () => {
    expect((await call(makeEnv(null), "POST", "/auth/wallet/challenge", undefined, { address: account.address })).status).toBe(400);
  });

  it("rejects a signature from a different wallet, an expired challenge, and a missing challenge", async () => {
    const other = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    expect((await login(mstEnv(row()), { signature: await other.signMessage({ message }) })).status).toBe(401);
    expect((await login(mstEnv(row({ expires_at: new Date(0).toISOString() })))).status).toBe(401);
    expect((await login(mstEnv(null))).status).toBe(401);
    expect(readRole).not.toHaveBeenCalled();
  });

  it("denies a wallet with no role on MST even if D1 has an account", async () => {
    vi.mocked(readRole).mockResolvedValue(null);
    expect((await login(mstEnv(row()))).status).toBe(403);
  });

  it("uses the on-chain role, not the client's claimed role", async () => {
    vi.mocked(readRole).mockResolvedValue("store_incharge");
    expect((await login(mstEnv(row()), { claimed_role: "supervisor" })).status).toBe(403);
    const res = await login(mstEnv(row()), { claimed_role: "store_incharge" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).token).toMatch(/^sv-7-/);
  });
});
