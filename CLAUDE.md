# Project Memory & Documentation Protection Protocol

## A. Required Files

For every new substantial application, create or maintain:

- `CLAUDE.md` — essential project instructions.
- `MEMORY.md` — compact index of durable project knowledge.
- `architecture.md` — architecture and component relationships.
- `progress.md` — current status, blockers, and next steps.
- `docs/PRD.md` — product requirements.
- `docs/TRD.md` — technical requirements.
- `docs/UI-UX.md` — UI/UX specifications.
- `docs/DB-SCHEMA.md` — database schema.
- `docs/SECURITY.md` — security specifications.
- `docs/DESIGN.md` — software and component design.
- `docs/README.md` — documentation index.
- `docs/DOCUMENTATION-CHECKLIST.md` — readiness checklist.

Inspect and reuse existing documentation before creating files. Use a proportionate subset for small tasks.

## B. Strict Word Limits

Maximum words per file:

| File | Limit |
|---|---:|
| `CLAUDE.md` | 800 |
| `MEMORY.md` | 400 |
| `architecture.md` | 1,200 |
| `progress.md` | 500 |
| `docs/PRD.md` | 1,500 |
| `docs/TRD.md` | 1,500 |
| `docs/UI-UX.md` | 1,200 |
| `docs/DB-SCHEMA.md` | 1,000 |
| `docs/SECURITY.md` | 1,000 |
| `docs/DESIGN.md` | 1,200 |
| `docs/README.md` | 300 |
| `docs/DOCUMENTATION-CHECKLIST.md` | 300 |

Treat limits as hard caps, not targets. Check word counts before saving changes. If a file exceeds its limit, remove redundancy and outdated content while preserving essential requirements, decisions, constraints, security details, and unresolved issues. If necessary, move detailed content into focused supporting files and link to them. Recheck counts; never silently discard important information.

## C. MEMORY.md

Keep `MEMORY.md` an index, not a transcript. Store the project's purpose/state, key decisions, critical constraints, recurring pitfalls, relevant document links, and progress-file location.

Exclude transcripts, source-code copies, large logs, obvious or temporary details, and secrets. Update existing entries instead of duplicating them.

## D. architecture.md

Document major components and responsibilities, system boundaries, important data/request flows, authentication/authorization boundaries, and critical integrations. Prefer concise lists and diagrams; reference source files instead of copying implementation details. Update only when architecture or significant relationships change.

## E. progress.md

Maintain only the current objective, completed milestones, implementation status, verified test results, active blockers, and the next 3–5 actions. Replace outdated status rather than accumulating history. Move durable decisions to `MEMORY.md` or `architecture.md`. Never claim unverified completion.

## F. Selective Context Loading

At task start, follow applicable `CLAUDE.md` instructions. Consult `MEMORY.md` when resuming work and `progress.md` for unfinished tasks. Read `architecture.md` and detailed documentation only when relevant. Inspect actual code before trusting potentially outdated notes. Never load every document or reread already available context unnecessarily.

## G. Documentation Maintenance

After substantial work, update `progress.md` when state changes, `MEMORY.md` for durable knowledge, `architecture.md` for architectural changes, and relevant specifications when approved requirements change. Keep updates concise, within limits, and consistent. Do not regenerate all documentation for minor changes.

## H. Protection and Validation

Before finishing substantial work:
1. Check word counts of all modified Markdown files against their limits.
2. Remove duplication, outdated content, and contradictions.
3. Preserve critical security requirements.
4. Fix violations before declaring documentation complete, or explicitly report unresolved violations.

When feasible, provide a lightweight validation script. Do not install dependencies or modify application code solely for documentation validation without approval.

## I. Token Efficiency and Accuracy

Minimize total token usage through concise instructions, targeted reads, small diffs, reusable summaries, and selective documentation. Preserve accuracy, security, essential context, and functionality. Never sacrifice correctness to save tokens.

## Cloudflare Deployment (Frontend + Backend)

Both frontend and backend deploy to Cloudflare's free plan. No cold starts.

**Backend (Workers)**
- Use Hono, not plain Express. Add a `/health` route that returns 200.
- Create `wrangler.jsonc` with `name`, `main` (entry file), `compatibility_date` (today's date), and `compatibility_flags: ["nodejs_compat"]` if Node APIs are used. Declare D1/KV/R2 bindings there.
- `package.json` scripts: `dev` = `wrangler dev`, `deploy` = `wrangler deploy`. Install `wrangler` and `hono`.
- Local secrets go in `.dev.vars` (git-ignored) with a `.dev.vars.example` listing names only. Production secrets via `wrangler secret put`, never in code or config.
- Limits: ~100k requests/day, ~10-30 ms CPU per request, no shared in-memory state. No heavy compute.
- Database: D1, or Neon/Supabase over their HTTP drivers. Never Render free Postgres.

**Frontend (Cloudflare Pages or Workers static assets)**
- Deploy the built output (`dist`/`build`) with `wrangler pages deploy <dir>` or via the Git integration (build command + output directory). Free plan allows 500 builds/month and unlimited bandwidth.
- For SPAs (React/Vue/Vite), add a `public/_redirects` file with `/* /index.html 200` so client-side routes don't 404.
- Frontend env vars must be build-time and public (e.g. `VITE_API_URL`). Never put secrets in the frontend.
- Put the API base URL in an env var: the Worker URL in production, `http://localhost:8787` locally.

**Connecting them**
- Enable CORS in the Worker for the exact frontend origin(s) only (Pages URL, custom domain, and localhost for dev). No `*` for authenticated routes.
- Optionally route the API under the same domain (e.g. `/api/*` to the Worker) to avoid CORS entirely.
- Use a monorepo or two folders (`/frontend`, `/backend`) with separate deploy scripts, and a root-level `deploy` script that runs both.

**Rules**
- Don't log in, create accounts, or enter credentials for me. Tell me to run `wrangler login`, then the deploy commands, myself.
- If the app needs heavy CPU, long-running processes, or websockets with in-memory state, say so before building and suggest an alternative.