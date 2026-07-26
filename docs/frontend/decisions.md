# Frontend rebuild — decisions record

Decisions delegated to me and made. Each records what was decided, on what evidence, and what it costs if wrong.

---

## D1 — Escalation resolution still requires a rule. Unchanged.

**Decided 2026-07-26.** Resolves `open-rulings.md` Q11 / `conflicts.md` C11.

### Decision

`POST /api/escalations/{id}/resolve` is **refused without a rule**. Two paths, exactly as documented: **cite an existing rule**, or **draft a new one** (lands PENDING, visually inert, cannot affect the pipeline until an engineer confirms).

**No third "does not generalise" escape hatch** — including the middle path I floated earlier. I withdraw that proposal; see below.

The design export's looser flow — write a ruling, return, and *optionally* convert it to a PENDING rule afterwards — is **overridden**. The escalation screen is redrawn with the rule step inside resolution.

### Evidence

The strict rule is attested in **six independent places**, one of which is the repo's own hard-rules list:

| Source | Text |
|---|---|
| `CLAUDE.md` (root, "Hard rules — violations are design defects") | *"Escalation resolution is refused without a rule."* |
| CONTEXT §7 | `POST /api/escalations/{id}/resolve` — *"ruling + rule (REFUSED without a rule)"* |
| CONTEXT §14 anti-patterns | *"escalation resolution **refused** without a rule"* |
| CONTEXT §18 release gates | *"escalation resolve refused without a rule"* |
| PRD §17 release gates | *"escalation resolve refused without rule"* |
| `frontend-master-prompt.md` §0.5 | *"escalation resolve disabled without a rule (cite existing OR draft new → lands PENDING)"* |

Plus `escalations.spec` #1, an INVARIANT that passes today.

Against that: a generated mock, which the brief defines as *"a rendering reference, not a source of truth… every behavior in it was invented by a generator, not decided by the business."*

This is not a close call.

### Why I withdrew my own middle path

I earlier proposed allowing "field-specific, does not generalise" plus a reason as a third path, to answer the design's fair worry that forcing a rule on every one-off produces junk rules.

That worry is **already handled by the existing mechanism**, and I missed it when I raised it:

1. A drafted rule lands **PENDING**, which by rule *cannot affect the pipeline*. A junk draft is inert.
2. The **engineer gate** is where junk gets rejected. That gate exists precisely to absorb this.
3. Most field escalations are instances of an existing rule — the "cite existing" path handles the common case without authoring anything.

So the cost of a junk PENDING draft is near zero, while the cost of resolving without a rule is that the same question returns next month — which is exactly what principle 3 exists to prevent (*"The same question is never asked twice"*).

CONTEXT §11 also cuts against the escape hatch directly, on the EXCEPTIONS drop-reasons question: *"Whoever writes those reasons is writing the rulebook, one order at a time."* The project's own position is that these reasons **are** the rulebook. A "doesn't generalise" checkbox would be a hole in it.

### Cost if wrong

Seniors author some PENDING rules that engineers later retire. That is visible, cheap, and self-correcting at the gate. The failure mode in the other direction — escalations resolving into nothing — is invisible and compounds.

### Consequences

- `escalations.spec` #1 stays INVARIANT and un-weakened.
- Design conflict C9 (escalate with no question) and C11 both require redraw. The escalation screen's "Reason" field finally has a source.
- No contract change.

---

## D2 — REVERSED by the owner, 2026-07-26. The design-mock pane ships as drawn.

**Superseded. `design-mock/` is the design of record for every screen it covers, including the Review document pane.**

Owner direction: implement `design-mock/`. My override below substituted a contrast measurement for the design decision that was actually commissioned — the exact error the brief warns against in reverse ("do not derive product rules from pixels" cuts both ways; a *rendering* choice is the design's to make, and RENDER means implement as drawn).

**What ships now:**
- **Review** — light document pane `#dcdde3`, exactly as `design-mock` draws it.
- **Extraction Bench, Reconciliation, Seed Correction** — these are three of the twelve measurement screens, which by earlier owner direction *keep their own design*. They stay dark.
- `PdfPane` therefore takes a `surround` variant (`light` | `dark`) rather than one hard-coded register. Noted as a consequence, not reopened.

The `--color-document-*` tokens stay in `packages/ui-tokens` — they are still needed by the three dark screens — but they are no longer the default and no longer apply to Review.

The superseded reasoning is kept below, unedited, because the measurement in it is still true and will come up again if anyone revisits the pane.

---

### ~~Original decision (SUPERSEDED)~~

`PdfPane` renders on a **dark surround** in all four screens that use it — Review, Extraction Bench, Reconciliation, Seed Correction. The design export's light pane (`#dcdde3`) is overridden.

Hues are shifted **cool** from the old warm-dark set so the pane sits in the new register. Structure and lightness are preserved, so the archived `.dc.html` layouts port without rework. Seed Correction keeps its deeper terminal register (`--color-document-deep`).

Tokens are renamed semantically — `--color-document-*`, not `--color-dk-*` — per the ui-tokens naming rule.

### Evidence — this is a measurement, not a preference

The product thesis, stated in three places (HANDOFF §4, master §0.9, old `index.css`), is *"the scanned document is the dominant visual, everything else recedes."*

Measured separation of the page from the pane behind it:

| Surround | Page vs. surround |
|---|---:|
| Dark (old, documented) | **14.53 : 1** |
| Light `#dcdde3` (export) | **1.29 : 1** |

At **1.29:1 the page and its own backdrop are nearly the same value.** The document does not read as dominant; it dissolves into the chrome. The light pane does not weakly serve the thesis — it inverts it.

All proposed dark tokens clear WCAG AA on the pane by a wide margin: ink 11.26, ink-soft 8.68, ink-strong 13.43, settled 7.89, attend 8.86, halt 6.79.

### On "colour is RENDER — implement as drawn"

The brief classifies colour as RENDER. I am overriding a RENDER element, so the reasoning has to hold.

The brief also lists a stop condition: *"You catch yourself reasoning 'the design must have had a reason for this.'"* That is exactly this situation, inverted. The dark pane has a **written rationale in three documents**. The light pane exists only as a hex value in a generated mock with **no stated reason anywhere**. Treating the mock's value as deliberate here would be the specific error the brief warns against.

And the measurement settles it independently of provenance: 1.29:1 fails the stated goal on its own terms.

### Cost if wrong

The flagship screen looks different from its mock in one respect — the surround, not the layout. Cheap to reverse: it is a token block, and every consumer reads tokens. If the owner prefers the light pane on sight, swapping the `--color-document-*` values back is a single-file change with no component edits.

### Consequences

- `PdfPane` is unblocked and buildable once its screens come up in Pass 3.
- The 3 re-platformed screens using it keep their current character — consistent with "keep their design".
- `--color-dk-*` (25 tokens) retires into `--color-document-*` (13), cool-shifted.

---

## Also folded in — the six mapping gaps

Closed while resolving D2, since they blocked the same work. All now in `packages/ui-tokens`:

| Gap | Resolution |
|---|---|
| §4.1 third surface level | `--color-surface-raised` restored |
| §4.2 progress track | `--color-track` added |
| §4.3 `ink-dim` → failing token | maps to `--color-ink-secondary`, **not** `--color-ink-muted` |
| §4.4 neutral/idle family | `--color-state-idle{,-surface,-border}` added |
| §4.5 serif on re-platformed screens | **Yes** — same rule, same content type. `--font-quote` for quoted human text. |
| §4.6 two animations | `tp-highlight-arrive`, `tp-act-ring` ported |

Plus: `--color-line-dashed`, `--color-surface-pin` (the pin/highlight distinction the export dropped), `--color-ink-on-action`, `--color-key-chip-on-action`, `--shadow-card`, `--shadow-pop`.

---

## Still open — not mine to decide

These remain owner calls and are **not** blocking Pass 1:

- **Q1 — the NA taxonomy** (4 members vs. the contract's 2). Blocks the field primitive, which is Pass 3 work. Three sources now converge on four; needs ratification plus a contract widening.
- **`--color-ink-muted` fails AA** (3.28:1 on panel, 2.65:1 on app). Most-used token in the design. Darken to ≈`#6f7480`, or restrict it to decoration. Touches every screen.
- **Q4–Q10 — the intake/config layer** (products, sign-off, completeness gate, client overrides, config versioning). ~40% of the export, no backend counterpart. Those screens ship inert or not at all until answered.
- **Q12 — queue as workspace** vs. single card.
- **Q13 — prefilled sign-off answers.**

---

## Pass 1 is unblocked

Deletion scope, per `replatform-mapping.md` §5: only what the new design actually replaces — Queue, Review, Ingest→Upload, the account/rulebook surfaces, shared chrome, and the old theme. The 12 measurement screens are deleted in Pass 3, one at a time, as each replacement lands.

Completion bar: **132** un-skipped and green (126 harvested + 6 keyboard specs promoted to INVARIANT by Q3).
