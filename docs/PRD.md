# Product Requirements Document (PRD)

**Product:** CONSTRA, multi-stage construction milestone verifier
**Event:** MST Buildathon 2.0 · **Version:** 2.0 (shipped build, 2026-10-28)
**Related:** [TRD](TRD.md) · [DESIGN](DESIGN.md) · [SECURITY](SECURITY.md) · [UI-UX](UI-UX.md)

## 1. Problem

Contractors release payments per completed construction stage. The evidence is weak:

- **Fabricated progress:** stages are billed before work is done.
- **Unreliable photos:** old, off-site or edited photos are submitted as proof.
- **Weak delivery checks:** paper challans are not matched to the Bill of Quantities (BOQ).
- **Material diversion:** extra cement or steel is issued and leaves the site.
- **Mutable records:** after payment, anyone with database access can change the evidence and nobody can prove it.

## 2. Vision

Turn every milestone claim into a verified evidence trail with a hard gate before certification, and make that trail independently provable on **MST Blockchain**.

## 3. Personas

| Persona | Goal | Interface |
| --- | --- | --- |
| **Site Supervisor** | Prove a stage is done and get it cleared quickly | Flutter mobile app (camera), web dashboard |
| **Store In-Charge** | Record deliveries and material issues accurately | Web (desktop/tablet) |
| **Project Auditor** | Approve only genuine work; catch fraud | Web command centre, BridgeKey wallet |
| **External verifier** | Check a file without trusting CONSTRA | Public `/verify` page |

## 4. Goals and non-goals

**Goals**
- Verify site photos: integrity (SHA-256), location (geofence), capture time, AI description.
- Extract challan data automatically, with human confirmation, and reconcile against the BOQ.
- Flag abnormal material drawdown against verified progress and history.
- Give auditors one desk with all evidence, alerts and blockers.
- Block certificates until every blocker is cleared.
- Anchor evidence and certificates on MST; keep portal roles on MST.

**Non-goals**
- Payments or billing.
- Drone/CCTV integration, custom ML training.
- Multi-project portfolio analytics.
- Chains other than MST (Buildathon rule).

## 5. Functional requirements

Status: ✅ shipped · ◐ partial · ⏳ pending.

### FR-1 Access and identity
| ID | Requirement | Status |
| --- | --- | --- |
| FR-1.1 | Sign-in with Google (Firebase), email/password, or BridgeKey wallet | ✅ |
| FR-1.2 | Three roles: Supervisor, Store In-Charge, Auditor | ✅ |
| FR-1.3 | Each role sees only its screens, routes and assigned projects | ✅ |
| FR-1.4 | Accounts created by an auditor only; no self sign-up | ✅ |
| FR-1.5 | For wallet users, the role comes from `AccessRegistry` on MST | ✅ |
| FR-1.6 | Mobile sign-in via QR pairing with a desktop BridgeKey or WalletConnect | ✅ |

### FR-2 Project setup
| ID | Requirement | Status |
| --- | --- | --- |
| FR-2.1 | Project with site centroid and radius (default 200 m) | ✅ |
| FR-2.2 | Ordered stages | ✅ |
| FR-2.3 | BOQ per material and stage, with unit conversions | ✅ (seeded via migrations; no admin UI) |
| FR-2.4 | Auditor assigns users to projects | ✅ |

### FR-3 Photo evidence
| ID | Requirement | Status |
| --- | --- | --- |
| FR-3.1 | Capture in-app with live GPS; block mock locations | ✅ |
| FR-3.2 | Burn GPS/time/site tag into the photo, then SHA-256 on device | ✅ |
| FR-3.3 | Server re-hashes; mismatch raises a critical alert | ✅ |
| FR-3.4 | Geofence check; violation raises a high alert | ✅ |
| FR-3.5 | AI vision report per photo shown to the auditor | ✅ |
| FR-3.6 | Offline queue; idempotent retries | ✅ |
| FR-3.7 | Photos join a per-stage claim automatically | ✅ |

### FR-4 Metadata checks
| ID | Requirement | Status |
| --- | --- | --- |
| FR-4.1 | Read EXIF GPS and capture time | ✅ |
| FR-4.2 | Fail photos outside radius or older than max age (default 24 h) or future-dated | ✅ |
| FR-4.3 | Approval re-checks EXIF geofence | ✅ |

### FR-5 Challans and BOQ
| ID | Requirement | Status |
| --- | --- | --- |
| FR-5.1 | Upload challan photo/PDF; automatic text extraction | ✅ |
| FR-5.2 | Extract vendor, number, date, items (material, qty, unit) with confidence | ✅ |
| FR-5.3 | Human review and edit before confirm (optimistic locking) | ✅ |
| FR-5.4 | Normalize units; compare delivered vs BOQ (tolerance 5%) | ✅ |
| FR-5.5 | Flag duplicate challans, invalid dates, unapproved vendors, over-delivery | ✅ |
| FR-5.6 | Manual challan entry fallback | ✅ |

### FR-6 Material consumption
| ID | Requirement | Status |
| --- | --- | --- |
| FR-6.1 | Log material issued to a stage | ✅ |
| FR-6.2 | Compare cumulative issue vs planned × verified progress (+15%) | ✅ |
| FR-6.3 | z-score check (`|z| > 2.5`) once 5+ days of history exist | ✅ |
| FR-6.4 | Preview anomaly before issuing | ✅ |

### FR-7 Alerts
| ID | Requirement | Status |
| --- | --- | --- |
| FR-7.1 | Every failed check creates an alert with type, severity, evidence | ✅ |
| FR-7.2 | Only auditors resolve/escalate; store staff may acknowledge | ✅ |
| FR-7.3 | Every action needs a written justification (≥5 chars) and is logged | ✅ |

### FR-8 Clearance
| ID | Requirement | Status |
| --- | --- | --- |
| FR-8.1 | Stage states: PENDING, UNDER_REVIEW, FLAGGED (rejected), CLEARED | ✅ |
| FR-8.2 | Approval blocked by open high/critical alerts, failed geofence, missing photo, processing challans, stale or inconsistent field decisions | ✅ |
| FR-8.3 | Approver cannot be the submitter | ✅ |
| FR-8.4 | Rejection requires a reason | ✅ |
| FR-8.5 | Certificate with SHA-256 seal; printable | ✅ |
| FR-8.6 | Every decision in `audit_logs` | ✅ |

### FR-9 MST Blockchain
| ID | Requirement | Status |
| --- | --- | --- |
| FR-9.1 | Anchor photo, challan and certificate hashes in `EvidenceRegistry` | ✅ |
| FR-9.2 | Auditor signs the certificate anchor with BridgeKey | ✅ (UI flow; real-wallet E2E pending) |
| FR-9.3 | Public `/verify` reads the contract directly | ✅ |
| FR-9.4 | D1 vs chain mismatch logged as tampering | ✅ |
| FR-9.5 | Roles managed with `AccessRegistry.setRole` from BridgeKey | ✅ |
| FR-9.6 | Mainnet deployment | ✅ contracts verified; live app on testnet |

## 6. Business rules

1. No clearance while any high or critical alert is open on the project.
2. Approver ≠ submitter (id, email or name).
3. Location valid only inside radius + GPS accuracy (allowance capped at 50 m).
4. Over-delivery beyond the BOQ tolerance (default 5%) is flagged.
5. Consumption beyond verified progress + 15%, or `|z| > 2.5`, is flagged.
6. Overrides need written reasons and are logged.
7. Client-sent ids, submitter, AI or EXIF verdicts are never trusted; the server sets them.

## 7. Non-functional requirements

| Area | Target |
| --- | --- |
| Cost | Runs on Cloudflare free plan; MST gas only |
| Latency | Upload response < 2 s; AI and anchoring in background (≈30 s / next cron minute) |
| Security | See [SECURITY](SECURITY.md); no secrets in frontend or repo |
| Usability | Mobile app works offline; web works on tablet |
| Auditability | Every action logged; evidence provable on MST |
| Explainability | Every alert and blocker states why |

## 8. Success metrics

| Metric | Target |
| --- | --- |
| Certificates issued with open critical alerts | 0 |
| Tampered/off-site photos flagged in demo set | 100% |
| Evidence hashes anchored and confirmed | ≥ 99% within 5 min |
| Challan fields correct on clear scans | ≥ 85% |

## 9. Assumptions and risks

| Risk | Mitigation |
| --- | --- |
| AI misjudges a photo | Advisory only; auditor decides |
| Blurry challans | Confidence highlighting + human confirm |
| Spoofed GPS | Mock-location block, fresh fix, tag burned before hashing, server geofence |
| Relayer key exposure | Secret in Workers only; anchorer-gated contract; owner can revoke |
| Background work timeout | Cron retries stuck challans and pending anchors |

## 10. Release status

| Phase | Scope | Status |
| --- | --- | --- |
| MVP | Roles, photos, geofence, AI, alerts, clearance gate | Done |
| Phase 2 | Challans, BOQ, consumption anomalies | Done |
| Phase 3 | MST anchoring, BridgeKey, `AccessRegistry`, Flutter app | Done (testnet + mainnet) |
| Next | App on mainnet, real-device and real-wallet E2E, project/BOQ admin UI | Planned |
