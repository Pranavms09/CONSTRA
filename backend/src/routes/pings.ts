import { Hono } from "hono";
import { requireRole } from "../auth";
import type { AppEnv, Role } from "../types";

const pings = new Hono<AppEnv>();

const ping = (path: string, role: Role, message: string) =>
  pings.get(path, requireRole(role), (c) => {
    const user = c.get("user");
    return c.json({ status: "ok", message, role: user.role, user: user.email });
  });

ping("/supervisor/ping", "supervisor", "Welcome, Site Supervisor. Access granted.");
ping("/store/ping", "store_incharge", "Welcome, Store In-Charge. Access granted.");
ping("/auditor/ping", "auditor", "Welcome, Project Auditor. Access granted.");

export default pings;
