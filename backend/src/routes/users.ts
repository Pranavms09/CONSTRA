import { Hono } from "hono";
import { getAddress, isAddress } from "viem";
import { denyDemo, findUserByEmail, hashPassword, insertUser, requireRole, userResponse } from "../auth";
import { all, audit, first, nowIso, run } from "../db";
import { fail, intParam, jsonBody } from "../errors";
import { ROLES, type AppEnv, type Role, type User } from "../types";

const users = new Hono<AppEnv>();
users.use("*", requireRole("auditor"), (c, next) => (c.req.method === "GET" ? next() : denyDemo(c, next)));

const checkRole = (role: unknown) => (role == null || ROLES.includes(role as Role) ? (role as Role | undefined) : fail(422, "Invalid role"));
// undefined keeps the current wallet, null or "" unlinks it.
const checkWallet = (v: unknown) => (v === undefined ? undefined : !v ? null : typeof v === "string" && isAddress(v) ? getAddress(v) : fail(422, "Invalid wallet address"));

const checkProjectIds = (v: unknown) =>
  v === undefined ? [] : Array.isArray(v) && v.every((id) => Number.isInteger(id) && id > 0) ? (v as number[]) : fail(422, "project_ids must be an array of project ids");

/** Adds project memberships (site roles need one to see a project); unknown project ids are skipped. */
async function addMemberships(db: D1Database, user: User, projectIds: number[]) {
  for (const pid of projectIds) {
    await run(db, "INSERT OR IGNORE INTO project_members (project_id, user_id, role) SELECT id, ?, ? FROM projects WHERE id = ?", user.id, user.role, pid);
  }
}

const withProjects = async (db: D1Database, rows: User[]) => {
  const members = await all<{ user_id: number; project_id: number }>(db, "SELECT user_id, project_id FROM project_members ORDER BY project_id");
  return rows.map((u) => ({ ...userResponse(u), project_ids: members.filter((m) => m.user_id === u.id).map((m) => m.project_id) }));
};

async function setWallet(db: D1Database, id: number, wallet: string | null) {
  try {
    await run(db, "UPDATE users SET wallet_address = ? WHERE id = ?", wallet, id);
  } catch {
    fail(409, "This wallet is already linked to another account.");
  }
}

users.get("/", async (c) => c.json(await withProjects(c.env.DB, await all<User>(c.env.DB, "SELECT * FROM users ORDER BY id ASC"))));

users.post("/", async (c) => {
  const body = await jsonBody<{ full_name?: string; email?: string; role?: string; password?: string; wallet_address?: string; project_ids?: number[] }>(c.req);
  if (!body.full_name || !body.email) fail(422, "full_name and email are required");
  const role = checkRole(body.role) ?? fail(422, "role is required");
  const wallet = checkWallet(body.wallet_address);
  const projectIds = checkProjectIds(body.project_ids);
  const email = body.email!.toLowerCase().trim();
  if (await findUserByEmail(c.env.DB, email)) fail(400, "A user with this email already exists.");

  let created = await insertUser(c.env.DB, {
    email,
    full_name: body.full_name!.trim(),
    role,
    password_hash: body.password ? await hashPassword(body.password.trim()) : null,
    auth_provider: body.password ? "password" : "firebase",
  });
  if (wallet) {
    await setWallet(c.env.DB, created.id, wallet);
    created = { ...created, wallet_address: wallet };
  }
  await addMemberships(c.env.DB, created, projectIds);
  await audit(c.env.DB, {
    actorId: c.get("user").id, action: "user_created", entity: "user", entityId: String(created.id),
    detail: { email: created.email, role: created.role, full_name: created.full_name, wallet: created.wallet_address ?? null, projects: projectIds },
  });
  return c.json(userResponse(created), 201);
});

users.patch("/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  const body = await jsonBody<{ role?: string; full_name?: string; is_active?: boolean; password?: string; wallet_address?: string | null; project_ids?: number[] }>(c.req);
  const role = checkRole(body.role);
  const wallet = checkWallet(body.wallet_address);
  const projectIds = checkProjectIds(body.project_ids);
  const target = (await first<User>(c.env.DB, "SELECT * FROM users WHERE id = ?", id)) ?? fail(404, "User not found");
  // Wallet-linked roles live in AccessRegistry on MST; D1 only mirrors them (see syncRoles).
  const linkedWallet = wallet === undefined ? target.wallet_address : wallet;
  if (role && role !== target.role && linkedWallet) {
    fail(409, "This account's role is managed on MST. Change it with BridgeKey (AccessRegistry.setRole).");
  }
  if (wallet !== undefined) await setWallet(c.env.DB, id, wallet);

  const updated = (await first<User>(
    c.env.DB,
    `UPDATE users SET role = ?, full_name = ?, is_active = ?, password_hash = ?, updated_at = ? WHERE id = ? RETURNING *`,
    role || target.role,
    body.full_name?.trim() || target.full_name,
    body.is_active == null ? target.is_active : body.is_active ? 1 : 0,
    body.password ? await hashPassword(body.password.trim()) : target.password_hash,
    nowIso(),
    id
  ))!;
  await addMemberships(c.env.DB, updated, projectIds);
  await audit(c.env.DB, {
    actorId: c.get("user").id, action: "user_updated", entity: "user", entityId: String(id),
    detail: { email: updated.email, old_role: target.role, new_role: updated.role, is_active: !!updated.is_active, wallet: updated.wallet_address ?? null, added_projects: projectIds },
  });
  return c.json(userResponse(updated));
});

users.delete("/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (c.get("user").id === id) fail(400, "Cannot delete your own auditor account.");
  const target = (await first<User>(c.env.DB, "SELECT * FROM users WHERE id = ?", id)) ?? fail(404, "User not found");
  try {
    await run(c.env.DB, "DELETE FROM users WHERE id = ?", id);
  } catch {
    // FK RESTRICT: challans, issues or certificates still reference this user.
    fail(409, "User has linked delivery, issue or certificate records. Deactivate the account instead.");
  }
  await audit(c.env.DB, { actorId: c.get("user").id, action: "user_deleted", entity: "user", entityId: String(id), detail: { email: target.email } });
  return c.body(null, 204);
});

export default users;
