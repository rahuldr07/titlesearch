# Handoff: TitlePipe v2 — title-abstract production system

## Overview
TitlePipe turns a scanned county title package into a certified, delivered title report where a defect is structurally hard to ship. Pipeline: intake/quarantine → dual-engine extraction → human rulings (Examination Workstation) → T1 second read (different user) → QC determinations → composed certificate → gated release → immutable versions + reissue. Two fully-walkable demo orders: 4176034-1 (Fulton County GA, clean) and 4176055-3 (Shelby County TN, ugly: dissolved-LLC vesting, mis-referenced release, delinquent tax, attaching judgment, unreadable pages).

## About the design files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's environment** (React/Vue/etc.) using its established patterns — or, if no environment exists yet, pick the most appropriate framework and implement there. `reference-app.html` is a single self-contained file: open it in a browser and click through; it is the behavioral spec. `backend plan` (in the main project: "Backend Plan.dc.html") defines the API/data model the frontend should bind to.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, motion and copy are final. Recreate pixel-perfectly using tokens.css / tokens.json. Interaction behavior in the reference app is the source of truth for states and gating.

## App shell
- Left sidebar 240px, background --dark (#1E1B2E), deep well --dark-deep for the profile block. Sections: Pipeline (Overview, All Orders), Active Order (numbered stages 1–5 with state dots), Platform Tools (QC & Escalations, Templates, Settings). Bottom: signed-in profile (avatar initials, name, email mono 10.5px, role pill) + "Switch user / Sign out" + walkthrough Reset.
- Main pane on --canvas (#ECEEF3); order bar (white, hairline bottom) shows ref (mono, 18px), address, product pill, SLA chip, primary action button, and 5 stage tabs.
- Min app width 1360px. Screen-enter animation 260ms cubic-bezier(.32,.72,0,1).

## Screens
1. **Sign-in** — dark canvas, radial accent glow, flat white TF mark, white card (radius 14, modal shadow): email + password, "demo — continue as" divider, 4 account rows (avatar, name, role, →). Overlay scrolls at short viewports (overflow-y:auto, margin:auto centering). Keyboard/global shortcuts disabled until signed in.
2. **Overview** — greeting header, 4 stat cards (label 11px grey, value 28px, note 13px — no invented metrics), Active Spotlight card (accent left border 4px, order ref 28px mono accent, Launch Workstation primary), Recent orders table (last 10) linking to All Orders.
3. **All Orders** — search (field:value syntax + suggestions), filter tabs in 10px/4px/6px segmented control, table: Ref (mono grey) / Address (16px w600) / Client / Stage / Assigned / Due (right, mono). One signal per row. Pagination 10/page. Empty state with Clear search. Row actions: audit-history modal, Open →.
4. **Order Hub** — verdict card: kicker pill, verdict 40px, note, 18-dot progress meter + "N of M decisions settled" (mono), primary CTA. Automated-operations rows (count strings derive from order dataset), deterministic checks list, Abstract Specifications facts grid, event trail (live: rulings, countersign, QC, release, reissue append as they happen).
5. **Intake / Upload** — two-column card: dropzone (dashed, hover accent) → file row + Quarantine Gateway checklist (AV → real-PDF → SHA-256 de-dup, sequential with pulsing dot, "queued/checking…/clear") → sha256 line + Optical Profile card (DPI, clerk stamp located, contrast floor). Right: client/product/order# fields, page count + jurisdiction read-only ("read from clerk stamp"), rulebook banner (amber until quarantine passes, then green with 3 layer chips). Sign button disabled-with-reason until ready.
6. **Extraction** — meta strip (ref / package / volume), Sequential stages timeline (6 rows, live counts, all derived per order), ↺ Replay, page matrix (one cell per page, click → workstation at that page; cream extracted / muted-red degraded), dark terminal (streams log lines with the run), Policy Exceptions card. All numbers reconcile with the hub.
7. **Examination Workstation** — split pane (drag divider, 38–74%). Left: progress meter, hotkey chips (C/E/Q/J-K/Z), sections sorted flagged-first (toggle), field rows (grid 140px/1fr/70px/24px; label 11px, value mono, cite mono grey, mark) with T1 pills on ruinous fields; open decision = 3px accent left rail, field name 13px accent, value 28px, second reading inline, amber consequence line, source-excerpt strip (serif, magnified, boxed hit), actions Confirm/adopt/Edit/Escalate + NA 4-state grid for absence-only fields. Second-read panel after all rulings: 3 T1 rows + countersign (blocked unless QC user; "Switch user: R. Menon (QC)"). Right: evidence pane — toolbar (Prev/p N / M/Next, ◉ Following/○ Free toggle, Fit/150%/200%), paper sheet (--paper-scan, serif body per page, clerk stamp rotated −3.5°, grain, −.35° tilt), citation box (1.5px accent + 13% fill), click/Z zoom-to-citation (scale 1.85 at bbox origin, 300ms), instrument index, filmstrip of page thumbnails (paper-proportioned, current ringed).
8. **Release Compiler** — left rail 320px: doc tabs (Publication Manifest / Telemetry Log), manifest blocks nav with include/omit toggles, release-gate checklist. Center: certificate on --paper-doc (serif, uppercase .1em title, roman-numeral ruled section heads, label column 11px caps sans, values serif 16px); DRAFT — NOT RELEASED watermark (rgba(20,22,28,.05), −16°) / REISSUE DRAFT — v2 / INTERNAL — NOT FOR CLIENT on the call-back tab; pending values amber-dashed and clickable → jump to workstation field; certificate wording interpolates the template expression with ruled values. Footer: gate label links to blocker; PDF locked until release; JSON opens compiled-payload modal; Sign & Execute Release (transactional gate re-check).
9. **Delivered** — header + SHA chip; Certified Deliverables list (artifact rows: PDF chip, name 16px, meta mono 11px, View routes honestly); Transmission Receipt (signed → hash → transmitted → acked, timestamped); Version Ledger (v1 immutable; v2 draft with reason on reissue; statuses flip on v2 release; v1 → "Superseded · retained"); Reissue Gateway (radio reasons, one-way, closes after v2).
10. **QC & Escalations** — queue cards + detail: docket excerpt (serif, boxed debtor name), debtor-vs-owner comparison grid, determination buttons role-gated (disabled + "belongs to QC — with R. Menon" for others), settled banner stamps ledger. Rule Candidates tab: approve → rule appears in Settings catalog as PENDING; reject → recorded.
11. **Templates Architect** — template list w/ filters; live sheet (paper) with block selection; inspector tabs (Syntax / Null States / Overrides / Audit): wording textarea + token chips + live preview, 4-state NA matrix inputs (drive certificate absence language), jurisdiction simulator; Save bumps "v4.2 → v4.3 draft" and logs to audit. Split Diff and JSON Schema views. Read-only banner + disabled Save for Typist role.
12. **Settings** — People (role selects), Access RBAC matrix (cells cycle — / VIEW / EDIT; "live" chips on the 5 enforced rows), Rules & Routing (catalog with scope/status filters + expandable origin/tests, Products, Resolved layers, Escalations candidates, Coverage state map), Organization, Retention & security, Audit log (derived live from session actions + filters).

## Interactions & behavior
- Keyboard: C confirm, E edit, Q escalate, J/K field nav (focus ring + auto-scroll + evidence follows), Z zoom citation, ⌘K palette, ? shortcuts, Esc closes/unzooms, / focuses search. Dead until signed in.
- Gates (must be server-enforced in real build): release requires 0 open fields + T1 countersign by different user + no uncovered record gaps; reissue requires reason; released versions immutable.
- Per-order work state: switching orders stashes/restores rulings; orders without loaded datasets open the audit-history modal instead of the workstation.
- Command palette: screens, orders, actions (switch user, sign out); arrow/enter nav.
- Modals: scrim rgba(20,18,30,.45) + blur(3px), card radius 14, pop 220ms.

## State management (reference model)
Single state tree: session { user, activeRole }, activeOrderRef, per-order work { answers{field→ruling}, gaps, secondRead, qcOutcome, delivered, reissue, reissueDone, reqs, page, zoom, follow }, ui { palette, modals, filters, ordersPage }, templates { blockWording, naMatrix, drafts }, plus static ORDER_DATA per order (fields, tiers, citations, scans, instruments, counts). Backend contract in the project's Backend Plan (orders/packages/pages/instruments/extractions/fields/rulings/second_reads/queries/gaps/templates/report_versions/deliveries/rules/audit_events).

## Design tokens
See tokens.css and tokens.json (identical values). Rules in claude-design-rules.md — paste into the implementing repo's agent context.

## Assets
No binary assets. Fonts via Google Fonts: Plus Jakarta Sans (400–800), JetBrains Mono (400–700), Source Serif 4 (400/600). Brand mark is typed "TF" in a flat square. All paper/scan artwork is CSS.

## Files
- reference-app.html — the full working prototype (self-contained; open in any browser)
- tokens.css / tokens.json — design tokens, copy verbatim
- claude-design-rules.md — the 14 rules for coding agents
- In the main project (not this bundle): "TitlePipe v2.dc.html" (source), "TitlePipe Design System.dc.html" (visual spec), "Backend Plan.dc.html" (API/data model + module split)
