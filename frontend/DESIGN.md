# Design System: CONSTRA — Technical Blueprint & Site Spec System
Stitch Project ID: `1559965896611013562`

## 1. Visual Theme & Atmosphere

The design system embodies the calculated precision, utilitarian density, and structural durability of civil site engineering, industrial spec plates, and architectural construction documents. It is tailored for site auditors, structural inspectors, safety directors, and field engineers who evaluate physical assets under high-stakes conditions.

The aesthetic is grounded in industrial functionalism and brutalist technical drafting:
- **Rigid Orthogonality:** Absolute geometric discipline. Every element conforms to strict coordinate baselines, architectural corner crop ticks, and drafting indices.
- **Physical Document Metaphor:** Evokes calibrated blueprint sheets, heavy-stock safety tags, and stamped metal equipment plates.
- **Utilitarian Density:** High information density without decorative excess. Negative space serves strictly as functional drafting margin.
- **Strictly No Gimmicks:** Complete elimination of glassmorphism, multi-stop decorative gradients, organic curves, and ornamental drop shadows.

## 2. Colors

The palette is derived from job-site safety standards, raw concrete aggregates, drafting bond paper, and black technical drawing ink:

- **Primary Accent (`#FCBC18`):** High-visibility Signal Yellow. Deployed deliberately for active states, critical highlight flags, primary triggers, and inspection callout tags.
- **Base Surfaces (`#E6E2DD` & `#F2ECE6`):** Warm drafting-paper gray and warm ivory stock create an authentic physical ground that prevents sterile digital white-out in high-glare field environments.
- **Dark Inks (`#101010`):** Deep carbon black ink applied to solid badges, technical title blocks, and heavy structural dividers.
- **Grid & Rule Lines (`#A39B8F`, `#8C8B91`, `#C3C6C9`):** Neutral gray tones applied as technical drawing division lines, reference scales, and perimeter registration marks.
- **Functional Status (`#2F6F4E` / `#B3261E`):** Field-grade pass/fail verification accents (OK Green and Danger Red) reserved exclusively for compliance logs, tolerance clearances, and critical safety hazards.

## 3. Typography

The typographic hierarchy follows the strict drafting standards of architectural title blocks and engineering plates:

- **Display & Section Labels:** Space Grotesk represents industrial stencil and technical lettering conventions. Always rendered in uppercase with deliberate letter spacing (`0.04em` to `0.14em`) to maintain legibility on field tablets and high-contrast monitors.
- **Body & Tabular Readouts:** Archivo Narrow provides the condensed structure required for multi-column schedule sheets, bill-of-materials tables, and field data logs. Tabular numerals (`font-variant-numeric: tabular-nums`) must be enabled on all numerical outputs to ensure alignment across audit rows.
- **Metadata Micro-Labels:** All dimensional tags, ISO stamps, coordinate stamps, and timestamp trackers use uppercase micro-labels at tracking levels up to `0.14em`.

## 4. Layout & Spacing

Layouts adhere to an uncompromising modular drafting matrix:

- **Grid Architecture:** 12-column rigid fluid grid with continuous vertical and horizontal hairline datum guides. Sections snap to precise coordinates rather than floating dynamically.
- **Asymmetrical Header & Sidebar:** Primary navigation mimics an architectural drawing border. The title block (project ID, revision count, stamp clearance) is anchored persistently into top-right or bottom-right coordinates.
- **Technical Drafting Rules:** Subdivisions use 1px solid hairline borders with controlled opacities (14% stone border `#A39B8F` for major divisions; 6% for secondary field registers).
- **Registration & Crop Marks:** Complex card blocks and document panels feature explicit outer corner crop marks (`+` or corner bracket ticks of 6px length) offset by 2px from container edges.
- **Breakpoints:**
  - **Mobile (< 768px):** Collapses to single-column linear technical stack; outer margin locked to `1rem`; drafting headers condense to compressed tabular strips.
  - **Tablet (768px – 1024px):** 6-column grid; spec sheets split 2:4; margin set to `1.25rem`.
  - **Desktop (> 1024px):** Full 12-column blueprint grid with peripheral datum rails; outer margin fixed at `1.5rem` to `2.5rem`.

## 5. Elevation & Depth

This design system rejects conventional software elevation models:

- **No Blurred Drop Shadows:** Traditional diffuse drop shadows are strictly prohibited. Depth is structural, not atmospheric.
- **Hard Technical Offset (Singular Panel Depth):** When a floating drawer, modal blueprint layer, or selected inspection row requires physical separation, use a hard 2px or 3px 90-degree offset cast in solid deep black ink (`#101010`) without blur radius (`box-shadow: 3px 3px 0px #101010`).
- **Surface-Level Layering:** Depth is communicated primarily through flat physical layering: Warm Ivory (`#F2ECE6`) panels set against Warm Paper (`#E6E2DD`) field grounds, delineated by 1px solid ink borders.
- **Inverted Mechanical Troughs:** Input fields, telemetry counters, and inactive slots sit flush into the surface using a 1px solid inset border rather than feathered inner shadows.

## 6. Shapes & Geometry

- **Zero Radius:** All corners are strictly 0px (`border-radius: 0px`). Buttons, badges, input fields, modals, splitters, and cards possess razor-sharp, unyielding corners.
- **Chamfered Cuts:** Select primary status badges and technical action plates may utilize a 45-degree corner clip (`clip-path: polygon(...)`) of 4px to 6px, referencing heavy-machinery serial plates and punch cards.
- **Orthogonal Rulers:** Dividers are straight, non-rounded paths that run precisely edge-to-edge.

## 7. Component Specifications

### Buttons
- **Primary Action:** Solid Signal Yellow (`#FCBC18`) fill, sharp 0px corners, 1px solid `#101010` border, uppercase Space Grotesk bold text in `#101010`. Hover state triggers an inverted solid `#101010` background with `#FCBC18` text and a hard 2px offset shadow (`2px 2px 0px #FCBC18`).
- **Secondary / Ghost:** Transparent background, 1px solid `#101010` hairline border, `#101010` uppercase text. On hover, fills with `#101010` with `#F2ECE6` text.
- **Critical / Stop:** Solid `#B3261E` fill with `#F2ECE6` text, reserved exclusively for structural failure triggers or safety work stoppages.

### Chips & Inspection Badges
- Heavy 1px solid border (`#101010` or `#A39B8F`), 0px corners, compact padding (`0.125rem 0.375rem`).
- Typography rendered in `label-code` uppercase.
- Status variants incorporate a solid 6px square marker: Green (`#2F6F4E`) for "APPROVED", Yellow (`#FCBC18`) for "PENDING REMEDIATION", Red (`#B3261E`) for "CRITICAL DEFECT".

### Spec Cards & Structural Panels
- Background: Warm Ivory (`#F2ECE6`).
- Border: 1px solid `#A39B8F` with 4-corner drafting crop ticks.
- Header Block: Top utility strip in `#E6E2DD` separated by a 1px solid hairline rule, featuring drawing reference numbers (e.g., `SEC-04 // LOT-81`) and revision codes.
