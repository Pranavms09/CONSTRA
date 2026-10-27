# Product Requirements Document (PRD)

**Product:** Multi-Stage Construction Milestone Verifier (with VLM Audit and Anomaly Detection) **Domain:** PropTech / Applied Computer Vision / Operations Fraud Detection **Version:** 1.0

---

## 1. What is a PRD? (Simple explanation)

A PRD answers three questions: **What are we building? For whom? Why?** It does not say *how* to build it (that is the TRD). Think of it as the order a customer gives a restaurant: "I want a pizza with these toppings." The kitchen decides the cooking method.

---

## 2. Problem Statement

General contractors lose money and time because:

- **Fabricated progress claims:** A subcontractor says a stage is done and bills for it, but the work is incomplete.
- **Weak delivery verification:** Paper challans (delivery slips) are not matched to what was planned in the Bill of Quantities (BOQ).
- **Off-book material diversion:** Extra material is issued and quietly taken off-site.
- **Unreliable photo logs:** Photos can be old, taken at another location, or edited.

**Analogy:** It is like paying a taxi driver by the kilometre without a meter. The driver can take a longer route and you cannot prove it.

---

## 3. Product Vision and Objective

An automated site-audit platform that **verifies** construction progress and material use using:

1. Vision-Language Model (VLM) checks of site photos against stage descriptions
2. OCR reading of scanned vendor challans, reconciled against the BOQ
3. Statistical detection of unusual material consumption
4. Photo metadata (GPS and timestamp) tamper checks
5. A rule that **blocks milestone certificates** until work is verified

---

## 4. Target Users (Personas)

| Persona | Who they are | Main goal | Main pain today |
| --- | --- | --- | --- |
| **Site Supervisor** | Person on site who manages daily work | Prove a stage is done and get it cleared quickly | Slow manual verification, disputes |
| **Store In-Charge** | Manages material store and deliveries | Record deliveries and issues accurately | Paper challans, manual entry errors |
| **Project Auditor** | Independent reviewer at the contractor | Catch fraud and approve only genuine work | No reliable evidence, too much manual checking |

---

## 5. Goals and Non-Goals

### Goals

- Verify photo evidence against the claimed stage automatically
- Detect GPS and timestamp tampering
- Extract challan data with OCR and reconcile with the BOQ
- Flag abnormal material drawdown
- Give the Auditor a clear alert queue
- Gate milestone certificates on verified outcomes

### Non-Goals (out of scope)

- Payment or billing processing
- Native mobile apps
- Drone or CCTV integration
- Training custom ML models
- Multi-project portfolio analytics

---

## 6. Functional Requirements

Each requirement has an ID so it can be traced into tests and the TRD.

### 6.1 Role-based access (FR-1)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1.1 | Users log in with email and password | Must |
| FR-1.2 | Three roles: Supervisor, Store In-Charge, Auditor | Must |
| FR-1.3 | Each role sees only its allowed screens and actions | Must |
| FR-1.4 | A Supervisor cannot approve their own milestone | Must |

### 6.2 Project and stage setup (FR-2)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-2.1 | Create a project with a site location (latitude, longitude, radius) | Must |
| FR-2.2 | Define ordered stages, each with a text description of completed work | Must |
| FR-2.3 | Upload or enter a BOQ with material, unit, and planned quantity per stage | Must |

### 6.3 Photo evidence and VLM audit (FR-3)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-3.1 | Supervisor uploads one or more photos per stage | Must |
| FR-3.2 | System sends photo and stage description to a VLM | Must |
| FR-3.3 | VLM returns match result, confidence, and reason | Must |
| FR-3.4 | Low confidence or mismatch raises an alert | Must |

### 6.4 Metadata tamper detection (FR-4)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-4.1 | Read EXIF GPS and capture time from each photo | Must |
| FR-4.2 | Flag photos outside the site radius | Must |
| FR-4.3 | Flag photos whose capture time is too far from upload time | Must |
| FR-4.4 | Flag photos with missing or inconsistent EXIF | Must |
| FR-4.5 | Flag duplicate photos reused across stages | Should |

### 6.5 Challan OCR (FR-5)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-5.1 | Store In-Charge uploads a scanned challan | Must |
| FR-5.2 | System extracts vendor, challan number, date, material, quantity, unit | Must |
| FR-5.3 | User can review and correct extracted values before saving | Must |

### 6.6 BOQ reconciliation (FR-6)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-6.1 | Compare total delivered quantity against BOQ allocation | Must |
| FR-6.2 | Normalize units (bags, kg, tonnes) before comparing | Must |
| FR-6.3 | Flag over-delivery and under-delivery beyond a tolerance | Must |
| FR-6.4 | Flag duplicate challan numbers | Should |

### 6.7 Material consumption anomaly detection (FR-7)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-7.1 | Store In-Charge logs material issued to a stage | Must |
| FR-7.2 | System computes usage versus expected usage for work completed | Must |
| FR-7.3 | System flags statistically unusual drawdowns (z-score based) | Must |

### 6.8 Alerts (FR-8)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-8.1 | Every failed check creates an alert with type, severity, and evidence | Must |
| FR-8.2 | Auditor sees an alert dashboard sorted by severity | Must |
| FR-8.3 | Auditor can resolve or escalate an alert with a written comment | Must |

### 6.9 Milestone clearance (FR-9)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-9.1 | Stage moves through Pending, Under Review, Flagged, Cleared | Must |
| FR-9.2 | Certificate is blocked while any critical alert is open | Must |
| FR-9.3 | Auditor approval generates a downloadable certificate PDF | Must |
| FR-9.4 | Every decision is recorded in an audit log | Must |

---

## 7. User Stories (with acceptance criteria)

**US-1 (Supervisor):** *As a Supervisor, I want to upload stage photos so that my stage can be verified.*

- Given I am on a stage page, when I upload a JPEG, then I see the VLM result and metadata result within a minute.

**US-2 (Store In-Charge):** *As a Store In-Charge, I want to upload a challan so that I do not type every line by hand.*

- Given a clear scan, when I upload it, then the extracted fields appear for my review.

**US-3 (Auditor):** *As an Auditor, I want to see all open alerts in one list so that I can focus on risky items first.*

- Given alerts exist, when I open the dashboard, then they are sorted by severity and show evidence.

**US-4 (Auditor):** *As an Auditor, I want certificates blocked automatically when evidence fails so that no one can bill for unverified work.*

- Given a stage has an open critical alert, when I try to issue a certificate, then the system refuses and tells me why.

---

## 8. Business Rules

1. A stage cannot be cleared if any **critical** alert is open.
2. A Supervisor cannot approve a stage they submitted evidence for.
3. A photo is "location valid" only if inside the site radius (default 200 m).
4. A photo is "time valid" only if captured within 24 hours of upload (configurable).
5. Delivered quantity beyond BOQ tolerance (default 5%) raises a flag.
6. Consumption is anomalous when its absolute z-score exceeds 2.5 (configurable).
7. All overrides require a written reason and are logged.

---

## 9. Non-Functional Requirements (summary)

| Area | Target |
| --- | --- |
| Performance | Photo audit result in under 60 seconds |
| Availability | Works reliably during a demo and pilot |
| Security | Role-based access, encrypted passwords, protected uploads |
| Usability | Works on a phone browser for site users |
| Auditability | Every action traceable |
| Explainability | Every alert shows why it was raised |

---

## 10. Success Metrics

| Metric | Target |
| --- | --- |
| Tamper detection on test set | At least 90% of planted tampered photos flagged |
| Challan field extraction accuracy | At least 85% of fields correct on sample scans |
| False alert rate | Under 15% of alerts dismissed as false |
| Time to clear a genuine stage | Reduced versus manual process |
| Certificates issued with open critical alerts | Exactly 0 |

---

## 11. Assumptions and Dependencies

- Site users take photos with a phone that records GPS and time.
- A VLM API is available.
- A BOQ exists before work begins.
- Challans are legible scans or photos.

---

## 12. Risks and Mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
| VLM gives wrong judgement | False pass or false flag | Show confidence and reason; Auditor has final say |
| Photo has no EXIF (privacy settings) | Cannot verify location | Treat as a flag, not an automatic reject |
| Poor OCR on blurry challans | Wrong data | Human review step before saving |
| Too many false alerts | Users ignore alerts | Tunable thresholds and severity levels |
| Too little history for anomaly stats | Weak detection | Use BOQ-based expected usage as fallback |

---

## 13. Release Plan

| Phase | Scope |
| --- | --- |
| **MVP** | Roles, stages, photo upload with EXIF checks, VLM audit, alerts, clearance gating |
| **Phase 2** | Challan OCR, BOQ reconciliation, consumption anomalies |
| **Phase 3** | Certificate PDF polish, audit log views, threshold settings |

---

## 14. Open Questions

1. What default tolerance should apply to each material type?
2. Should two Auditors be required for high-value stages?
3. How long should evidence be retained?
