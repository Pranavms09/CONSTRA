# Database Schema (Cloudflare D1)

Database `constra-db` (SQLite). Source of truth: [backend/migrations/](../backend/migrations/). Timestamps are ISO-8601 UTC text; booleans are `0/1`; JSON is stored as text.

## Migrations

| File | Change |
| --- | --- |
| `0001_init.sql` | Core schema |
| `0002_demo_seed.sql` | Demo users, Nashik project, stages, materials, units, BOQ |
| `0003_mst_chain.sql` | `users.wallet_address`; `chain_anchors.anchored_by`, `claimed_at` |
| `0004_wallet_auth.sql` | Unique wallet index, `auth_nonces`, `chain_sync` |
| `0005_rename_demo_project.sql` | Demo project renamed to "Shree Construction, Nashik" |
| `0006_wallet_pairing.sql` | `wallet_pairings` (phone QR sign-in) |
| `0007_more_materials.sql` | Sand, aggregate, bricks, more rebar sizes |
| `0008_backfill_mobile_claims.sql` | Groups earlier mobile photos into per-stage claims |
| `0009_mainnet_reanchor.sql` | Testnet → mainnet switch: re-queues real testnet anchors for mainnet |

Apply: `npm run db:migrate:local` / `db:migrate:remote` in `backend/`.

## Identity and access

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `email` (unique), `full_name`, `role` (`supervisor`/`store_incharge`/`auditor`), `password_hash` (PBKDF2), `firebase_uid` (unique), `auth_provider`, `is_active`, `wallet_address` (unique, case-insensitive), `last_login_at` | For wallet users, `role` and `is_active` mirror `AccessRegistry` on MST |
| `project_members` | `project_id`, `user_id`, `role` | Site roles only see member projects |
| `auth_nonces` | `nonce` (PK), `address`, `message`, `expires_at` | Single-use wallet challenge, 5 min |
| `wallet_pairings` | `id` (PK, in QR), `secret_hash`, `user_id`, `expires_at` | Phone sign-in; only the secret's SHA-256 stored |
| `audit_logs` | `actor_id`, `action`, `entity`, `entity_id`, `detail` (JSON), `ip_address` | Every security-relevant action |

## Projects and BOQ

| Table | Key columns | Notes |
| --- | --- | --- |
| `projects` | `name`, `site_address`, `centroid_lat`, `centroid_lng`, `site_radius_m` (200), `start_date`, `end_date` | Geofence and challan date window |
| `project_settings` | `project_id` (unique), `boq_tolerance_pct` (5), `expected_usage_tolerance` (0.15), `zscore_limit` (2.5), `allow_new_vendors` (1) | Per-project thresholds |
| `stages` | `project_id`, `name`, `"order"`, `status` (`PENDING`/`UNDER_REVIEW`/`FLAGGED`/`CLEARED`), `verified_progress` (0–1) | Progress drives expected consumption |
| `materials` | `name` (unique), `base_unit`, `description` | |
| `unit_conversions` | `material_id`, `unit`, `factor_to_base` | bags/tonnes → base unit |
| `vendors` | `name` (unique), `is_approved` | Unapproved vendor → alert |
| `boq_items` | `project_id`, `stage_id`, `material_id`, `planned_qty`, `unit`, `planned_qty_base` | |

## Store

| Table | Key columns | Notes |
| --- | --- | --- |
| `challans` | `project_id`, `vendor_id`, `vendor_name_raw`, `challan_no`, `challan_date`, `uploaded_by`, `file_path` (R2), `sha256`, `ocr_raw_text`, `ocr_confidence`, `reviewed`, `status` (`processing`/`draft`/`confirmed`/`failed`), `failure_reason`, `version` | `UNIQUE (vendor_id, challan_no)`; `version` for optimistic locking |
| `challan_items` | `challan_id`, `material_id`, `stage_id`, `material_name_raw`, `qty`, `unit`, `qty_base`, `field_confidence` | |
| `material_issues` | `stage_id`, `material_id`, `qty`, `unit`, `qty_base`, `issued_by`, `issued_to`, `note`, `anomaly_flag` | |
| `alerts` | `project_id`, `stage_id`, `challan_id`, `issue_id`, `photo_id`, `type`, `severity`, `status` (`open`/`acknowledged`/`resolved`/`escalated`), `explanation`, `evidence` (JSON), `auditor_comment` | Types: `HASH_MISMATCH`, `GEOFENCE_VIOLATION`, `duplicate_challan`, `boq_over_delivery`, `challan_date_invalid`, `unapproved_vendor`, `consumption_anomaly` |

## Evidence and claims

| Table | Key columns | Notes |
| --- | --- | --- |
| `evidence` | `device_evidence_id` (unique), `project_id`, `stage_id`, `supervisor_id`, `file_path` (R2), `client_sha256`, `server_sha256`, `hash_matched`, `captured_at`, `latitude`, `longitude`, `accuracy_m`, `distance_to_site_m`, `is_within_radius`, `blockchain_tx`, `blockchain_status` (`queued`/`submitted`/`confirmed`/`failed`), `blockchain_network`, `blockchain_chain_id`, `ai_status`, `ai_summary`, `ai_structured_result`, `status` | Idempotent on `device_evidence_id` |
| `claims` | `id` (PK), `data` (JSON document), `created_at` | Photos, field decisions, report; updated with `json_insert` |
| `jobs` | `id`, `data` (JSON) | Background job status for the audit desk |
| `clearance_certificates` | `certificate_number` (unique), `project_id`, `stage_id`, `claim_id`, `auditor_id`, `verdict`, `verdict_note`, `evidence_hashes`, `verification_summary`, `certificate_hash` | Hash = SHA-256 of canonical JSON |
| `image_analyses` | `filename`, `file_hash`, `description`, `model`, `uploaded_by_id` | `/api/analyze-image` history |

## Blockchain

| Table | Key columns | Notes |
| --- | --- | --- |
| `chain_anchors` | `sha256` (PK), `entity`, `entity_id`, `project_id`, `kind` (1 photo, 2 challan, 3 certificate), `status` (`pending`/`sending`/`sent`/`anchored`/`failed`/`awaiting_signature`), `tx_hash`, `chain_id`, `block_number`, `anchored_at`, `anchored_by`, `attempts`, `last_error`, `claimed_at`, `simulated` | Relayer queue; MST is the source of truth, this is a cache |
| `chain_sync` | `key` (PK), `value` | `RoleSet` log cursor, key `roles_block:<registry address>` |

## Relationships

```
projects ─┬─ stages ─┬─ boq_items ── materials ── unit_conversions
          │          ├─ evidence ── users (supervisor)
          │          ├─ material_issues
          │          └─ clearance_certificates
          ├─ challans ─ challan_items
          ├─ alerts
          ├─ project_members ── users
          └─ project_settings
claims (JSON) → evidence ids, stage, project
chain_anchors.sha256 ↔ evidence.server_sha256 / challans.sha256 / certificates.certificate_hash
```

R2 keys: `evidence/{sha}_{deviceId}.jpg`, `challans/challan_{rand}.{ext}`, `uploads/evd_{hash16}.{ext}`.
