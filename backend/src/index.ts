import { Hono } from "hono";
import { cors } from "hono/cors";
import { ApiError } from "./errors";
import analysis from "./routes/analysis";
import auth from "./routes/auth";
import chain from "./routes/chain";
import claims from "./routes/claims";
import pings from "./routes/pings";
import store from "./routes/store";
import supervisor from "./routes/supervisor";
import users from "./routes/users";
import { processAnchors, syncRoles } from "./services/chain";
import { recoverStuckChallans } from "./services/store";
import type { AppEnv, Env } from "./types";

const app = new Hono<AppEnv>();

// Exact-origin CORS only (FRONTEND_ORIGINS); no wildcard because routes are authenticated.
app.use("*", async (c, next) => {
  const allowed = c.env.FRONTEND_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  return cors({ origin: (origin) => (allowed.includes(origin) ? origin : null), credentials: true, maxAge: 600 })(c, next);
});

app.route("/", analysis); // /health, /api/health, /api/analyze-image, /uploads/*, EXIF demo
app.route("/auth", auth);
app.route("/users", users);
app.route("/", pings);
app.route("/store", store);
app.route("/supervisor", supervisor);
app.route("/chain", chain);
app.route("/api/v1", claims);

app.notFound((c) => c.json({ detail: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ detail: err.detail }, err.status);
  console.error(err);
  return c.json({ detail: "Internal Server Error" }, 500);
});

export default {
  fetch: app.fetch,
  // Every minute: confirm sent MST transactions and anchor queued hashes.
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processAnchors(env).then((r) => console.log("anchor relayer", JSON.stringify(r))));
    ctx.waitUntil(recoverStuckChallans(env).then((r) => console.log("challan OCR recovery", JSON.stringify(r))).catch((err) => console.warn("challan OCR recovery failed:", err)));
    ctx.waitUntil(syncRoles(env).then((r) => console.log("role sync", JSON.stringify(r))).catch((err) => console.warn("role sync failed:", err)));
  },
} satisfies ExportedHandler<Env>;
