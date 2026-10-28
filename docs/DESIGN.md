# Software Design

**Product:** CONSTRA · **Version:** 2.0 (shipped build, 2026-10-28)
**Related:** [architecture.md](../architecture.md) · [TRD](TRD.md) · [CHAIN_INTEGRATION](CHAIN_INTEGRATION.md)

## Design goals

1. **Evidence first:** every claim decision traces to a file whose hash is on MST.
2. **Server decides:** clients send raw data only; the server computes hashes, verdicts, ids and roles.
3. **Hard gate:** clearance is a server rule, not a UI convention.
4. **Free to run:** Cloudflare free plan and MST gas only.
5. **Explainable:** every alert and blocker says why.

## Architecture style

A modular monolith in one Worker (`constra-api`) plus a static frontend Worker (`constra`). Modules are route files with shared domain services; no microservices, no queues yet.

| Module | Owns |
| --- | --- |
| `auth.ts` | Token resolution, `requireRole`, project membership |
| `routes/supervisor.ts` | Photo ingestion and status |
| `routes/store.ts` + `services/store.ts` | Challans, units, reconciliation, anomalies, alerts |
| `routes/claims.ts` | Claim documents, field decisions, clearance gate, certificates |
| `routes/chain.ts` + `services/chain.ts` | Relayer, verification, wallet link, role sync |
| `routes/analysis.ts` + `lib/` | AI vision, EXIF, hashing, fuzzy matching |

## Main flows

### Photo to chain
```
Phone: GPS fix → capture → burn tag → SHA-256 → offline queue → POST /supervisor/evidence
API:   re-hash → geofence → R2 → D1 evidence → alerts → claim join → chain_anchors(pending)
BG:    waitUntil(relayer, AI) ; cron every minute → anchorMany → receipt → confirmed
```
Burning the tag before hashing means the anchored hash also protects the visible GPS/time stamp.

### Challan
```
upload → R2 → processing → waitUntil extract → fuzzy match → draft
draft → human edit (version check) → confirm → reconcile → alerts → anchor (kind 2)
```

### Material issue
```
preview(stage, material, qty) → evaluate(expected vs cumulative, z-score) → warn/alert
issue → material_issues row → consumption_anomaly alert if flagged
```

### Clearance
```
auditor decisions per field → submit(verdict)
  → self-approval? 403
  → blockers? 422 {blockers[]}
  → stage CLEARED, certificate {canonical JSON, sha256}
  → wallet-linked auditor: BridgeKey anchor(hash, 3) → POST /chain/certificates/{id}/onchain (receipt checked)
  → otherwise: relayer anchors it
```

### Wallet roles
```
auditor BridgeKey setRole(addr, role) on AccessRegistry
  → cron or POST /chain/roles/sync reads RoleSet logs → roleOf → D1 role/is_active
wallet login → challenge → personal_sign → roleOf on MST → sv- session
```

## Stage state machine

| From | To | Trigger |
| --- | --- | --- |
| PENDING | UNDER_REVIEW | claim opened (first photo) |
| UNDER_REVIEW | FLAGGED | auditor rejects with a written reason |
| FLAGGED | UNDER_REVIEW | new evidence submitted |
| UNDER_REVIEW | CLEARED | approved with no blockers |

Open high/critical alerts do not change the state; they block the `CLEARED` transition.

`CLEARED` is final: re-approval returns 400; photos for cleared stages do not join claims.

## Algorithms

**Geofence:** Haversine distance; valid if `distance ≤ site_radius_m + min(max(0, accuracy_m), 50)`. The cap stops a fake huge accuracy value from disabling the check.

**Consumption:** `expected = planned_qty_base × verified_progress`. No progress → warn. `cumulative > expected × (1 + tol)` → alert (high when excess > 2 × tol, else medium). With ≥ 5 daily totals, `|z| > zscore_limit` → alert. Cumulative checking stops "many small issues just under the limit".

**Reconciliation:** delivered base qty per material vs BOQ base qty; above `boq_tolerance_pct` → `boq_over_delivery`.

**Certificate seal:** SHA-256 over canonical JSON (sorted keys) of claim, stage, verdict, evidence hashes and checks. Same input always gives the same hash, so the on-chain value can be recomputed.

## Key decisions

| Decision | Why | Trade-off |
| --- | --- | --- |
| Cloudflare Workers + D1 + R2 | Free, no cold starts | CPU limit; no image processing |
| Relayer in the Worker (cron + `waitUntil`) | No extra server; supervisors need no wallet | Relayer key is a Worker secret |
| Batch `anchorMany` ≤ 50 | Fewer txs, less gas | Up to one minute delay |
| Auditor signs certificates personally | Approval is attributable to a wallet, not to our server | Needs BridgeKey |
| `AccessRegistry` as role source | Roles cannot be changed by editing our DB | One cron tick of lag |
| Plain signed challenge, not SIWE | MST-only rule; minimal surface | Custom format |
| Tag burned into JPEG before hashing | Hash covers the visible proof | Original unstamped image not kept |
| Gemini `gemini-2.5-flash` | Fast enough for the `waitUntil` budget | Newer models too slow |
| Claims as JSON documents in D1 | Flexible field decisions | Atomic updates via `json_insert` |
| AI advisory only | Model errors must not block or pass work | Auditor workload |

## Error handling

- `fail(status, detail)` → `{"detail": ...}`; blockers returned as a list.
- Background failures are recorded on the row (`ai_status`, `failure_reason`, `last_error`) with retry endpoints.
- Anchoring never blocks the user: rows stay queued until the chain accepts them.

## Extension path

Cloudflare Queues for AI/extraction, project/BOQ admin UI, MST mainnet, two-auditor approval for high-value stages.
