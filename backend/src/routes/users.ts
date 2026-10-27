import { Hono } from "hono";
import { findUserByEmail, hashPassword, insertUser, requireRole, userResponse } from "../auth";
import { all, audit, first, nowIso, run } from "../db";
import { fail, intParam, jsonBody } from "../errors";
import { ROLES, type AppEnv, type Role, type User } from "../types";

const users = new Hono<AppEnv>();
users.use("*", requireRole("auditor"));

const checkRole = (role: unknown) => (role == null || ROLES.includes(role as Role) ? (role as Role | undefined) : fail(422, "Invalid role"));

users.get("/", async (c) => c.json((await all<User>(c.env.DB, "SELECT * FROM users ORDER BY id ASC")).map(userResponse)));

users.post("/", async (c) => {
  const body = await jsonBody<{ full_name?: string; email?: string; role?: string; password?: string }>(c.req);
  if (!body.full_name || !body.email) fail(422, "full_name and email are required");
  const role = checkRole(body.role) ?? fail(422, "role is required");
  const email = body.email!.toLowerCase().trim();
  if (await findUserByEmail(c.env.DB, email)) fail(400, "A user with this email already exists.");

  const created = await insertUser(c.env.DB, {
    email,
    full_name: body.full_name!.trim(),
    role,
    password_hash: body.password ? await hashPassword(body.password.trim()) : null,
    auth_provider: body.password ? "password" : "firebase",
  });
  await audit(c.env.DB, {
    actorId: c.get("user").id, action: "user_created", entity: "user", entityId: String(created.id),
    detail: { email: created.email, role: created.role, full_name: created.full_name },
  });
  return c.json(userResponse(created), 201);
});

users.patch("/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  const body = await jsonBody<{ role?: string; full_name?: string; is_active?: boolean; password?: string }>(c.req);
  const role = checkRole(body.role);
  const target = (await first<User>(c.env.DB, "SELECT * FROM users WHERE id = ?", id)) ?? fail(404, "User not found");

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
  await audit(c.env.DB, {
    actorId: c.get("user").id, action: "user_updated", entity: "user", entityId: String(id),
    detail: { email: updated.email, old_role: target.role, new_role: updated.role, is_active: !!updated.is_active },
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
