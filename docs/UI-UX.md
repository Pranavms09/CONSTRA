# UI/UX Design Document

**Product:** Multi-Stage Construction Milestone Verifier **Version:** 1.0

---

## 1. What is a UI/UX doc? (Simple explanation)

- **UX (User Experience)** is how the product *feels to use*: is it easy, fast, clear?
- **UI (User Interface)** is how it *looks*: colours, buttons, layout.

**Analogy:** UX is how smoothly a restaurant runs (ordering, serving, billing). UI is the decoration and the menu design.

This doc describes users, journeys, screens, components, and the visual style so a designer or developer can build the interface without guessing.

---

## 2. Design Principles

| Principle | What it means here |
| --- | --- |
| **Clarity first** | Every verification result shows a clear pass, warn, or fail state with a reason |
| **Mobile-first for site roles** | Supervisors and Store staff use phones, often outdoors, sometimes with one hand |
| **Desktop-first for the Auditor** | Auditors review lots of evidence side by side |
| **Explain every flag** | Never show "Failed" alone; always show *why* and *what to do* |
| **Low typing** | Prefer camera, upload, dropdowns, and pre-filled fields |
| **Safe actions** | Destructive or approval actions need confirmation |

---

## 3. User Journeys (step by step)

### 3.1 Site Supervisor journey

1. Log in and land on **My Project** page.
2. Pick a **Stage** card (for example "Slab Casting").
3. Tap **Upload Photos** (camera or gallery).
4. See upload progress, then a **Verification in progress** state.
5. See results: location check, time check, VLM check.
6. If flagged, read the reason and upload a better photo.
7. When all pass, stage shows **Under Review** and waits for the Auditor.

### 3.2 Store In-Charge journey

1. Log in and land on **Store Dashboard**.
2. Tap **New Delivery**, upload challan scan.
3. Review the **extracted fields** (editable), fix mistakes.
4. Confirm; see BOQ comparison (delivered vs planned).
5. Tap **Issue Material**, choose stage, material, quantity.
6. See a warning if usage looks unusual.

### 3.3 Project Auditor journey

1. Log in and land on **Audit Dashboard** (alerts sorted by severity).
2. Open an alert and see **evidence panel** (photo, map, numbers, VLM reason).
3. Choose **Resolve with comment**, **Escalate**, or **Reject evidence**.
4. Open a stage and review the **verification checklist**.
5. Tap **Approve and Issue Certificate** (only enabled when allowed).
6. Download the certificate PDF.

---

## 4. Information Architecture (Navigation Map)

```
Login
 |
 |-- Supervisor
 |     |-- My Project (stage list)
 |     |-- Stage Detail (photos, results)
 |     |-- Upload Photos
 |
 |-- Store In-Charge
 |     |-- Store Dashboard
 |     |-- New Delivery (challan upload + review)
 |     |-- Material Issue
 |     |-- Stock Summary
 |
 |-- Auditor
       |-- Audit Dashboard (alerts)
       |-- Alert Detail
       |-- Stage Review
       |-- Projects and BOQ setup
       |-- Settings (thresholds)
       |-- Certificates
```

---

## 5. Screen Specifications

Each screen lists its purpose, main elements, and states. The simple layouts below are text wireframes.

### 5.1 Login Screen

**Purpose:** secure entry.

```
+--------------------------------+
|        [Logo] SiteVerify       |
|                                |
|   Email     [______________]   |
|   Password  [______________]   |
|                                |
|        [   Sign In   ]         |
|        Forgot password?        |
+--------------------------------+
```

**States:** default, loading, wrong credentials (inline message), locked account. **Behaviour:** after login, redirect by role.

---

### 5.2 Supervisor: My Project

**Purpose:** see all stages and their status at a glance.

```
+----------------------------------------+
| Project: Tower Block A        [Profile]|
+----------------------------------------+
| 1. Excavation       [CLEARED]  green   |
| 2. Footing          [CLEARED]  green   |
| 3. Column           [UNDER REVIEW] blue|
| 4. Slab Casting     [FLAGGED]  red     |
| 5. Brickwork        [PENDING]  grey    |
+----------------------------------------+
```

**Elements:** stage cards with status badge, progress bar, number of open flags. **Empty state:** "No stages yet. Ask your Auditor to set up stages."

---

### 5.3 Supervisor: Stage Detail and Photo Upload

**Purpose:** upload evidence and see automatic checks.

```
+----------------------------------------+
| < Back     Slab Casting     [FLAGGED]  |
+----------------------------------------+
| Expected: Steel mesh laid, shuttering, |
| concrete poured and leveled.           |
+----------------------------------------+
| [ Take Photo ]   [ Upload from Gallery ]|
+----------------------------------------+
| Photo 1                                |
|  [thumbnail]                           |
|  Location check    OK   (42 m from site)|
|  Time check        OK   (captured 3 min ago)|
|  Stage check       FAIL (confidence 82%)|
|   Reason: Image shows bare soil, no    |
|   reinforcement visible.               |
|  [Replace photo]                       |
+----------------------------------------+
```

**Elements:** expected-work text, upload buttons, per-photo result rows with icons, reason text, replace button. **States:** uploading (progress bar), analysing (spinner with text "Checking your photo"), done, error (retry). **Key UX rule:** results must be written in plain language, for example "Photo was taken 410 m away from the site" instead of "GPS mismatch".

---

### 5.4 Store: New Delivery (Challan Review)

**Purpose:** let the user confirm OCR output quickly.

```
+------------------------------------------------+
| New Delivery                                   |
+----------------------+-------------------------+
|  [Challan image]     | Vendor      [ABC Traders]|
|  (zoomable)          | Challan No  [CH-1042]    |
|                      | Date        [05-Oct-2026]|
|                      | Items                    |
|                      |  Cement  [100] [bags]    |
|                      |  Steel   [2.5] [tonnes]  |
|                      | [Low confidence fields   |
|                      |  highlighted in amber]   |
+----------------------+-------------------------+
| BOQ check:  Cement 100 of 500 bags allocated   |
|                                [ Confirm ]     |
+------------------------------------------------+
```

**On phones:** image on top, fields below. **Rule:** low-confidence fields are highlighted amber and must be touched or confirmed before saving.

---

### 5.5 Store: Material Issue

**Purpose:** log material leaving the store.

**Fields:** Stage (dropdown), Material (dropdown), Quantity, Unit (auto-filled), Issued to (name), Note. **Live feedback:** a small panel shows "Expected for work done so far: 120 bags. Already issued: 95. This issue: 40 (total 135, 12% above expected)." **Warning state:** yellow banner for mild deviation, red banner for anomaly, with the option to continue (the system logs it and alerts the Auditor).

---

### 5.6 Auditor: Audit Dashboard

**Purpose:** a single place to triage risk.

```
+-------------------------------------------------------------+
| Open alerts: 7    Critical: 2   High: 3   Medium: 2         |
+-------------------------------------------------------------+
| Filters: [Project v] [Severity v] [Type v] [Status v]       |
+-------------------------------------------------------------+
| CRITICAL  Slab Casting   Photo does not match stage   2h ago|
| HIGH      Column         Photo location 410 m away    5h ago|
| HIGH      Cement         Over-delivery +24%           1d ago|
| MEDIUM    Brickwork      EXIF data missing            1d ago|
+-------------------------------------------------------------+
```

**Elements:** summary tiles, filters, sortable alert list, severity colour tags. **Charts to include:** alerts by type (bar), alerts over time (line), stage status funnel.

---

### 5.7 Auditor: Alert Detail

**Purpose:** all evidence in one view so the decision is quick.

```
+---------------------------------------------------------+
| Alert: Photo location mismatch          [HIGH] [OPEN]   |
+-----------------------------+---------------------------+
| [Photo]                     | [Map: site circle + pin]  |
|                             | Distance: 410 m           |
+-----------------------------+---------------------------+
| Why raised: Photo GPS is outside the 200 m site radius. |
| Uploaded by: Supervisor (role) at 14:05                 |
| File hash: a3f9...   Duplicate of another file? No      |
+---------------------------------------------------------+
| Comment: [______________________________]               |
| [ Resolve ]  [ Escalate ]  [ Reject evidence ]          |
+---------------------------------------------------------+
```

**Rule:** Resolve and Reject need a mandatory comment.

---

### 5.8 Auditor: Stage Review and Clearance

**Purpose:** final decision on a stage.

```
+---------------------------------------------------------+
| Slab Casting - Verification Checklist                    |
+---------------------------------------------------------+
| [x] Photo evidence matches stage (VLM)                   |
| [x] Location and time valid                              |
| [x] Material delivered within BOQ tolerance              |
| [ ] Consumption normal          <- 1 open anomaly        |
+---------------------------------------------------------+
| Open alerts: 1          Certificate: BLOCKED             |
| [ Approve and Issue Certificate ]  (disabled)            |
| Tooltip: Resolve the open consumption anomaly first.     |
+---------------------------------------------------------+
```

The button becomes active only when the checklist is complete. The tooltip always says why it is disabled.

---

### 5.9 Settings (Auditor)

Threshold controls with plain-language labels:

| Label shown | Internal setting |
| --- | --- |
| Allowed distance from site (metres) | site\_radius\_m |
| Maximum photo age (hours) | max\_capture\_age\_hours |
| Minimum AI confidence (%) | vlm\_min\_confidence |
| Allowed delivery variance (%) | boq\_tolerance\_pct |
| Unusual usage sensitivity | zscore\_limit |

Each has a short help text and a reset-to-default link.

---

## 6. Visual Design System

### 6.1 Colour palette

| Role | Colour | Hex | Use |
| --- | --- | --- | --- |
| Primary | Deep blue | #1D4ED8 | Buttons, links, active items |
| Success | Green | #16A34A | Passed, cleared |
| Warning | Amber | #D97706 | Medium alerts, low confidence |
| Danger | Red | #DC2626 | High and critical alerts |
| Info | Sky | #0284C7 | Under review |
| Neutral dark | Slate | #0F172A | Text |
| Neutral light | Light grey | #F1F5F9 | Backgrounds |

**Rule:** never rely on colour alone. Always pair colour with an icon and a text label (for colour-blind users).

### 6.2 Typography

| Element | Font | Size |
| --- | --- | --- |
| Headings | Inter (or system sans-serif) | 24 / 20 / 18 px |
| Body | Inter | 16 px (mobile), 14 px (desktop tables) |
| Captions | Inter | 12 px |

### 6.3 Spacing and layout

- 8-pixel spacing grid (8, 16, 24, 32)
- Minimum touch target 44 x 44 px for phone users
- Breakpoints: 360 px (phone), 768 px (tablet), 1200 px (desktop)

---

## 7. Component Library

| Component | Variants and notes |
| --- | --- |
| **Status badge** | Pending (grey), Under Review (blue), Flagged (red), Cleared (green) |
| **Severity tag** | Low, Medium, High, Critical, each with icon |
| **Check row** | Icon + label + result + reason text |
| **Evidence card** | Thumbnail, metadata, hash, actions |
| **Alert card** | Severity, title, project, time |
| **File uploader** | Camera, gallery, drag and drop on desktop, progress bar |
| **Editable field with confidence** | Normal, amber (low confidence), error |
| **Confirmation dialog** | Title, description, comment box, confirm and cancel |
| **Toast message** | Success, info, error; auto-dismiss in 4 seconds |
| **Disabled button with tooltip** | Explains why an action is blocked |

---

## 8. Feedback and Microcopy

Good microcopy turns a technical failure into an actionable message.

| Situation | Poor message | Better message |
| --- | --- | --- |
| GPS outside site | GPS mismatch | This photo was taken 410 m from the site. Please retake it at the site. |
| Old photo | Timestamp invalid | This photo was taken 3 days ago. Please upload a photo taken now. |
| VLM mismatch | Verification failed | We could not see steel reinforcement in this photo. Please capture the whole slab area. |
| No EXIF | Metadata error | Location and time are missing from this photo. Turn on camera location and retake. |
| Blocked certificate | Not allowed | One consumption alert is still open. Resolve it to continue. |

---

## 9. States Every Screen Must Handle

| State | Design rule |
| --- | --- |
| Loading | Skeleton or spinner with short text |
| Empty | Friendly message with next step |
| Error | Clear reason and retry option |
| Offline or slow network | Banner, and keep the upload queued where possible |
| Success | Brief confirmation, then next logical step |
| Permission denied | Message plus link back to home |

---

## 10. Accessibility Requirements

- Colour contrast ratio of at least 4.5:1 for text
- All images have text alternatives
- Full keyboard navigation on desktop screens
- Form fields have visible labels, not placeholder-only
- Error messages are linked to the field that caused them
- Status is shown with text and icons, not colour only
- Supports browser zoom up to 200 percent without layout break

---

## 11. Responsive Behaviour

| Screen | Phone | Desktop |
| --- | --- | --- |
| Supervisor stage page | Single column, camera button large | Two columns, thumbnails left, results right |
| Challan review | Image on top, fields below | Image left, fields right |
| Audit dashboard | Cards list, filters in a drawer | Table with filters on top |
| Alert detail | Stacked panels | Side-by-side photo and map |

---

## 12. Usability Testing Plan

| Task | Success measure |
| --- | --- |
| Supervisor uploads a photo and understands a failure | Completes in under 2 minutes, can restate the reason |
| Store user corrects an OCR field | Completes in under 1 minute |
| Auditor finds the most critical alert and resolves it | Completes in under 2 minutes |
| Auditor understands why a certificate is blocked | Correctly explains the reason without help |

Test with 3 to 5 people per role, collect confusion points, and iterate.
