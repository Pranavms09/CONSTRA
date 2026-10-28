# UI/UX

**Product:** CONSTRA · **Version:** 2.0 (shipped build, 2026-10-28)
**Related:** [PRD](PRD.md) · [DESIGN](DESIGN.md)

## Principles

1. **Evidence on screen:** every verdict shows its source (photo, EXIF, AI report, tx link).
2. **Say why:** alerts and approval blockers are written in plain language.
3. **Field first:** the supervisor app works with gloves, sunlight and no network.
4. **No dead ends:** every failed background task has a retry button.
5. **Plain wording:** UI says "text extractor" and "AI vision", never vendor or model names or "OCR".

## Web routes (`frontend/src/App.jsx`)

| Route | Who | Content |
| --- | --- | --- |
| `/`, `/landing` | Public | Landing page |
| `/login` | Public | Google, email/password, "Sign in with BridgeKey"; "Enter demo mode" per role (works when `DEMO_MODE` is on) |
| `/supervisor` | Supervisor | Tabs: 01 assigned project, 02 evidence capture stream / target stage, 03 stage telemetry, 04 account & app login (set mobile password) |
| `/store` | Store In-Charge | Dashboard, `deliveries`, `deliveries/new`, `deliveries/:id` (challan review), `issue`, `issues`, `stock`, `alerts` |
| `/auditor` | Auditor | Tabs: 01 Claim Audit Desk, 02 store challans, 03 audit alerts, 04 EXIF & GPS, 05 user access |
| `/verify` | Public | Drop a file → browser SHA-256 → `EvidenceRegistry.verify` over MST RPC |
| `/wallet-pair` | Wallet holder | Approve phone sign-in with BridgeKey; shows the confirmation code |
| `/analyze`, `/image-analysis` | Signed in | AI image description + EXIF report |

Dashboards sit behind `ProtectedRoute` and `WalletLinkGate`: accounts without a linked wallet are asked to link BridgeKey first.

## Key journeys

**Supervisor (mobile)**
1. Sign in: email/password, "BridgeKey on a computer" (QR + 8-char code), or "Wallet on this phone" (WalletConnect).
2. Pick site and stage (`site_picker_screen`).
3. Camera with live GPS HUD (accuracy, distance to site); shutter disabled without a fresh fix or with mock location.
4. Review the stamped photo, submit. Works offline; queued items upload later.
5. Evidence list: AI status, anchor status (`queued → submitted → confirmed`), explorer link.

**Store In-Charge**
1. New delivery → upload challan (or manual entry).
2. Review: low-confidence fields highlighted amber; edit; confirm.
3. See reconciliation alerts; check stock and BOQ progress bars.
4. Issue material: live anomaly preview (warn/alert) before saving.

**Auditor**
1. Claim Audit Desk: pick a claim; see photos, AI report, EXIF GPS result, anchor status.
2. Mark each field agree / amend / flag; choose verdict.
3. Approve → blockers listed if any; otherwise certificate modal.
4. Sign the certificate anchor with BridgeKey; print the certificate.
5. Resolve alerts with justification; manage users, projects and on-chain roles (`setRole`).

## Mobile screens (`mobile/lib/screens/`)

`login_screen`, `pairing_screen`, `home_screen`, `site_picker_screen`, `camera_screen`, `review_screen`, `evidence_screen`. Theme in `mobile/lib/ui.dart` (heavy headline weights, monospace for hashes and coordinates).

## Visual system (web)

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary-container` | `#fcbc18` | Safety amber: primary actions, highlights |
| `--color-primary` | `#7a5900` | Text on light amber, links |
| `--color-tertiary` | `#296a49` | Pass / confirmed |
| `--color-error` | `#ba1a1a` | Critical alerts, blockers |
| `--color-on-surface` | `#1b1b20` | Body text |
| `--color-surface-container-*` | `#ffffff` → `#e4e1e8` | Layered panels |

Typography: Space Grotesk (UI, numbers) and Archivo Narrow (condensed headings, numbered section labels like `01 // CLAIM AUDIT DESK`). Hashes and tx ids in monospace, shortened with copy and explorer link. Motion: GSAP + Lenis on the landing page only.

## Components (`frontend/src/components/store/`)

`AnomalyBanner`, `BoqProgressBar`, `ConfidenceField`, `ConfirmDialog`, `EmptyState`, `FileUploader`, `ImageViewer`, `ReconcileTable`, `SeverityTag`, `SkeletonLoader`, `StatusBadge`, `Toast`. Shared: `ConstraLogo`, `MstCertificatePanel`, `ImageAnalysisSection`, `AccountPasswordPanel`.

## Status language

| State | Colour | Label |
| --- | --- | --- |
| Critical / high alert | Red | Severity tag + explanation |
| Medium alert, warn | Amber | Severity tag |
| Confirmed anchor, pass | Green | "Confirmed on MST" + block |
| Pending / processing | Neutral + skeleton | "Queued", "Extracting text…" |

## States every screen handles

Loading (skeletons), empty (`EmptyState` with next action), error (message from `detail` + retry), offline (mobile queue badge), permission denied (redirect to the role home).

## Accessibility requirements

- Text contrast ≥ 4.5:1 on amber and surfaces; status never shown by colour alone (icon + label).
- All actions reachable by keyboard; dialogs keep focus until closed.
- Touch targets ≥ 44 px in the mobile app.

## Responsive

Supervisor web and mobile app: phone first. Store: tablet and desktop. Auditor: desktop, side-by-side evidence panel that stacks on narrow screens.
