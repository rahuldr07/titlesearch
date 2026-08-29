# ANALYSIS — behavioral specification extracted from `reference-app.html`

Source: `/home/rahul/projects/title-report/design_handoff_titlepipe/reference-app.html`
(1.28 MB self-contained prototype; base64 font blobs stripped to 415 KB before analysis).
Companions read: that bundle's `README.md` (§ *Interactions & behavior*, § *State management*)
and `claude-design-rules.md`.

The README states: *"Interaction behavior in the reference app is the source of truth for
states and gating."* This document is that behavior, extracted.

---

## 1. Complete keyboard map

There is exactly **one** `window.addEventListener("keydown")` in the whole prototype.
Everything else is a local `onKeyDown` on the palette input.

| Key | Action | Scope | Suppressed by |
|---|---|---|---|
| `Cmd/Ctrl+K` | toggle palette + focus it | global | `!user` only — **fires inside inputs** |
| `Escape` | closes palette, shortcuts, NA guide, editor, history modal, zoom, JSON modal; resets `tplStage` | global | `!user` only |
| `?` | toggle shortcuts HUD | global | `!user`, `isInput` |
| `/` | go to Orders + focus search (80 ms later) | global | `!user`, `isInput` |
| `c` | confirm open field | review | `!user`, `isInput`, no open field, `NA_ONLY[open]` |
| `e` | inline editor + focus | review | same as `c` |
| `q` | escalate to QC | review | `!user`, `isInput`, no open field |
| `j` / `k` | next/prev field, wraps; evidence follows if `followFields`; scrolls row | review | `!user`, `isInput` |
| `z` | toggle `zoomTo` | review | `!user`, `isInput` |
| `↑` / `↓` / `Enter` | palette nav/select | palette input only | not global at all |
| **Double-click** | "Directly enter rapid inline editing" | review row | — **README omits this** |

Keys and facts the README does **not** mention:

- **Double-click** on a field row enters the inline editor. It is in the prototype's own
  HUD copy but absent from the README's shortcut list.
- **`Esc` is not `isInput`-guarded.** It fires inside text fields — deliberately, since it
  is what clears field focus.
- **Case sensitivity is inconsistent.** `?` and `/` are matched on the raw `e.key`, while
  `c/e/q/j/k/z` go through `.toLowerCase()`. `Shift+C` confirms; `Shift+/` on a non-US
  layout may not produce `?`.
- **There is no `g`-sequence.** `navigation.spec`'s `g d` / `g q` chords have no basis in
  the prototype; they are a web-v2 invention. Flagged, not resolved.
- **`j`/`k` wrap** modulo `NEED.length` — they never dead-end.
- **`j`/`k` move `hover`, but `c`/`e`/`q` act on `open`** (the first unanswered field), not
  on `hover`. Navigating with `j` and then pressing `c` confirms a *different* field than
  the one the focus ring is on. This is a real defect in the prototype, not a subtlety to
  reproduce.

The prototype's own HUD copy (`shortcutSections`), which is the shipping text for the `?`
overlay:

```js
const shortcutSections = [
  { title:"Review Workstation (High-Velocity Examination)", shortcuts:[
    { key:"C", desc:"Confirm highlighted value as verified" },
    { key:"E", desc:"Open inline correction editor for highlighted field" },
    { key:"Q", desc:"Escalate current field to QC / Legal Queue" },
    { key:"J", desc:"Jump to Next pending decision field" },
    { key:"K", desc:"Jump to Previous field in record list" },
    { key:"Z", desc:"Zoom the evidence page to the focused citation" },
    { key:"Double-Click", desc:"Directly enter rapid inline editing" },
  ]},
  { title:"Global Navigation & Tools", shortcuts:[
    { key:"⌘ K / Ctrl K", desc:"Open Command Palette & Order Switcher" },
    { key:"?", desc:"Toggle this Keyboard Shortcuts HUD" },
    { key:"Esc", desc:"Close any active modal or clear field focus" },
  ]},
  { title:"Law 3 & 4-State NA Taxonomy", shortcuts:[
    { key:"1. Structurally Absent", desc:"Legal concept does not exist for this instrument (e.g., trustee in GA)" },
    { key:"2. Not Found in Package", desc:"Expected in packet but completely omitted by client/searcher" },
    { key:"3. Not Stated in Instrument", desc:"Deed is physically present but leaves consideration/clause blank" },
    { key:"4. Page Unreadable", desc:"Document page scan is below readable optical contrast floor (e.g. p29)" },
  ]},
];
```

Note the third section lists the 4-state NA taxonomy as *labels*, not as `1`/`2`/`3`/`4`
key bindings. The digits are **not** bound in the handler. The NA grid is mouse-only in
the prototype.

---

## 2. How the prototype ACTUALLY implements suppression

A tagName test. Nothing else. No focus-within test, no modal flag, no scope stack.
The complete handler, verbatim:

```js
componentDidMount() {
  this._keys = (e) => {
    if (!this.state.user) return;
    const t = e.target;
    const isInput = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); this.setState(p => ({ ...p, paletteOpen: !p.paletteOpen, paletteQuery:"", paletteIndex:0 })); this.focusPalette(); return; }
    if (e.key === "Escape") { this.setState(p => ({ ...p, paletteOpen:false, shortcutsOpen:false, showNaGuide:false, editing:null, historyRef:null, zoomTo:false, jsonOpen:false, tplStage:"editor" })); return; }
    if (!isInput && e.key === "?") { e.preventDefault(); this.setState(p => ({ ...p, shortcutsOpen: !p.shortcutsOpen })); return; }
    if (!isInput && e.key === "/") { e.preventDefault(); if (this.state.screen !== "orders") this.setState(p => ({ ...p, screen:"orders" })); setTimeout(() => this._searchEl && this._searchEl.focus(), 80); return; }
    if (this.state.screen === "review" && !isInput) {
      const k = e.key.toLowerCase();
      const D = this.data();
      const NEED = D.NEED, NA_ONLY = D.NA_ONLY, PAGE_OF = D.PAGE_OF;
      const open = NEED.find(l => !this.state.answers[l]) || null;
      if (k === "c" && open && !NA_ONLY[open]) { e.preventDefault(); this.answer(open, "confirmed"); }
      else if (k === "e" && open && !NA_ONLY[open]) { e.preventDefault(); this.setState(p => ({ ...p, editing:open, editVal:"", editOrig:"" })); this.focusEditor(); }
      else if (k === "q" && open) { e.preventDefault(); this.answer(open, "query"); }
      else if (k === "j" || k === "k") {
        e.preventDefault();
        const cur = Math.max(0, NEED.indexOf(this.state.hover || open || ""));
        const next = NEED[(cur + (k === "j" ? 1 : NEED.length - 1)) % NEED.length];
        this.setState(p => ({ ...p, hover: next, page: p.followFields ? PAGE_OF[next] : p.page }));
        requestAnimationFrame(() => this.scrollRowIntoView(next));
      }
      else if (k === "z") { e.preventDefault(); this.setState(p => ({ ...p, zoomTo: !p.zoomTo })); }
    }
  };
  window.addEventListener("keydown", this._keys);
}
```

The only other keyboard code in the file is the palette's local handler, which is **not**
on the window:

```js
paletteKeys: (e) => {
  const n = this._pal.length || 1;
  if (e.key === "ArrowDown") { e.preventDefault(); this.setState(p => ({ ...p, paletteIndex: (p.paletteIndex + 1) % n })); }
  else if (e.key === "ArrowUp") { e.preventDefault(); this.setState(p => ({ ...p, paletteIndex: (p.paletteIndex - 1 + n) % n })); }
  else if (e.key === "Enter") { e.preventDefault(); const it = this._pal[s.paletteIndex]; if (it) this.palSelect(it); }
},
```

Focus is restored by **polling the DOM**, not by a ref — worth knowing because it races:

```js
focusEl = (sel) => {
  let tries = 0;
  const tick = () => {
    const el = document.querySelector(sel);
    if (el) { el.focus(); if (el.select) el.select(); return; }
    if (tries++ < 12) setTimeout(tick, 25);
  };
  setTimeout(tick, 20);
};
focusPalette = () => this.focusEl("[data-tf-palette]");
focusEditor  = () => this.focusEl("[data-tf-edit]");
componentWillUnmount() { window.removeEventListener("keydown", this._keys); if (this._t) clearInterval(this._t); if (this._q) this._q.forEach(clearTimeout); }
```

Note also `/`'s deferred focus, `setTimeout(..., 80)`, which is a render-timing guess and
will flake under React 19 concurrent rendering.

### Why this is the risk it is flagged as

Three concrete failures follow from the tagName guard:

1. **`shortcutsOpen` and `paletteOpen` are never consulted by the review branch.** With
   the `?` HUD up, `c` confirms a T1 ruling behind the scrim. This is precisely the trap
   `e2e/invariants/queue-keys.spec.ts` already pins for the queue — "a cheat sheet that
   fires the commands it describes" — except here the command carries ruinous-exposure
   consequence.
2. **A react-aria-components `Select` popover is `<div role="listbox">`, not `SELECT`.**
   The guard fails open on every composite the chosen library ships. `Menu`, `Select`,
   `ComboBox` and `GridList` all implement typeahead, and `c`, `e`, `q`, `j`, `k`, `z`, `/`
   are all printable characters. `q` inside an open NA-state menu would both jump the
   listbox to an option starting with "q" *and* escalate the open field to QC.
3. **`e.preventDefault()` is called on suppression-adjacent keys unconditionally within
   the review branch**, so where the guard is wrong, the inner widget also loses its
   default behavior. That is how `queue-keys.spec` describes the previous build's failure:
   "every Enter anywhere on `/queue` navigated to review and the focused control never
   activated."

Related, already recorded at `docs/frontend/HANDOFF-UI.md:167`: **react-hotkeys-hook does
not recognise `?` or `[` as hotkey names.** Both were registered and never fired. They must
be matched on the character with an explicit keydown listener plus a hand-written input
guard. The prototype does exactly that; the guard is what needs to be better than the
prototype's.

---

## 3. CONTRACT for the React implementation

**Suppression conditions.** The global and screen chord layers stand down when **any** of
the following holds at the moment of `keydown`:

1. There is no session (`!user`). *Every* chord including `Cmd+K` is dead on the sign-in
   screen. ("Dead until signed in.")
2. `document.activeElement` is a text surface:
   `input:not([type=checkbox]):not([type=radio])`, `textarea`, or `[contenteditable]`.
3. `document.activeElement` is inside a composite widget that owns printable keys:
   `[role="listbox"]`, `[role="menu"]`, `[role="grid"]`, `[role="combobox"]`,
   `[role="dialog"]`, or any element carrying `data-typeahead`. This is a
   `closest()` / focus-within test, **not** a tagName test.
4. Any overlay is open: command palette, `?` key map, NA guide, compiled-payload JSON
   modal, audit-history modal.

**What suppression means.** Return without acting and **without calling
`preventDefault()`**. The inner widget keeps its default behavior. A suppressed chord is
suspended, never cancelled and never swallowed.

**Escape is exempt.** `Escape` is never suppressed and pops **exactly one** layer,
innermost first: open composite popover → open overlay → inline editor → citation zoom.
The prototype's single flat `setState` that clears all of them at once is wrong for a
layered UI and must not be reproduced.

**Resumption.** When an overlay or composite closes, focus returns to the element that
invoked it, and the **very next keystroke** is a chord again — with no click, no
`focus()` call from the test, and no mouse event of any kind. This is the clause that is
easiest to regress and the one most worth a test.

**`Cmd+K` exception.** `Cmd+K` survives text fields (condition 2 does not suppress it), as
in the prototype. It does not survive an open palette — closing the palette is `Escape`'s
job, not a second `Cmd+K` toggle, because a toggle-on-toggle races the focus poll.

**Scope precedence.** The innermost layer that can use a key wins: widget → overlay →
screen → global. This is the rule `queue-keys.spec` and `sidebar.spec` #5 already state
for the queue and for text fields; this contract extends it to composites.

**Target correctness.** `c`/`e`/`q` must act on the **focused** field (the `j`/`k` cursor),
not on "the first unanswered field". The prototype's `open`-vs-`hover` split is a defect;
fixing it is required, not optional.

---

## 4. Playwright test cases

Written to `apps/web-v2/e2e/invariants/chord-suppression.spec.ts`, following the
conventions of the existing `key-map-modal.spec.ts`, `navigation.spec.ts` and
`queue-keys.spec.ts` (rule-stating doc comment, `getByTestId`, no weakened assertions).

```ts
import { expect, test } from "@playwright/test";

/**
 * [INVARIANT] — rule: a global chord is SUSPENDED, not cancelled, while a text
 * surface or an overlay holds focus, and it RESUMES on close with no click.
 *
 * The reference prototype guards exactly one way — a tagName test on
 * `e.target` (INPUT/TEXTAREA/SELECT/isContentEditable) — and that test is
 * structurally insufficient under react-aria-components, whose Menu, Select,
 * ComboBox and GridList listboxes are `<div role="listbox">`: they are NOT
 * INPUT, they DO implement typeahead, and C/E/Q/J/K/Z// are all printable.
 * A tagName guard lets `q` both escalate the open field AND jump the menu to
 * "Quarantine". The prototype also never guards on `shortcutsOpen`, so `?`
 * then `c` CONFIRMS A RULING FROM INSIDE THE CHEAT SHEET — the same trap
 * `queue-keys.spec` pins for the queue, on the field that carries T1 exposure.
 *
 * These bound the guard by SCOPE, not by tag: the innermost layer that can use
 * a key wins, and the global layer stands down whenever any composite or
 * overlay is the active element.
 */

const REVIEW = "/orders/ord_demo_1/review";

async function openReview(page: import("@playwright/test").Page) {
  await page.goto(REVIEW);
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
}

test("a chord typed into a text input is TEXT, and the ruling does not move", async ({
  page,
}) => {
  await openReview(page);
  await page.keyboard.press("e");
  const editor = page.getByTestId("edit-value");
  await expect(editor).toBeFocused();
  await page.keyboard.type("cqjkz");
  await expect(editor).toHaveValue(/cqjkz$/);
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
});

test("Escape leaves the editor and the chords resume WITHOUT a click", async ({
  page,
}) => {
  await openReview(page);
  await page.keyboard.press("e");
  await expect(page.getByTestId("edit-value")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("edit-value")).toHaveCount(0);
  // No click, no focus() call — the very next keystroke is a chord again.
  await page.keyboard.press("j");
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
});

test("an open react-aria listbox owns its typeahead — q does not escalate", async ({
  page,
}) => {
  await openReview(page);
  await page.getByTestId("na-state-select").click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  // `q` is typeahead inside the popover, never the escalate chord.
  await page.keyboard.press("q");
  await expect(page.getByTestId("escalate-confirm")).toHaveCount(0);
  await expect(listbox).toBeVisible();
  // `z` likewise must not toggle the citation zoom behind the popover.
  await page.keyboard.press("z");
  await expect(page.getByTestId("evidence-pane")).toHaveAttribute(
    "data-zoomed",
    "0",
  );
  await page.keyboard.press("Escape");
  await expect(listbox).toHaveCount(0);
  await page.keyboard.press("z");
  await expect(page.getByTestId("evidence-pane")).toHaveAttribute(
    "data-zoomed",
    "1",
  );
});

test("the ? map stands the REVIEW chords down — c must not confirm a T1 ruling", async ({
  page,
}) => {
  await openReview(page);
  const before = await page.getByTestId("decisions-settled").textContent();
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.getByTestId("decisions-settled")).toHaveText(before ?? "");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await page.keyboard.press("c");
  await expect(page.getByTestId("decisions-settled")).not.toHaveText(
    before ?? "",
  );
});

test("the command palette owns / and ? while it is up", async ({ page }) => {
  await openReview(page);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByTestId("command-palette-input");
  await expect(palette).toBeFocused();
  await page.keyboard.type("?/");
  await expect(palette).toHaveValue("?/");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp("/review"));
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toBeVisible();
});

test("every chord is DEAD until signed in", async ({ page }) => {
  await page.goto("/sign-in");
  for (const k of ["?", "/", "c", "e", "q", "j", "k", "z"]) {
    await page.keyboard.press(k);
  }
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  await expect(page).toHaveURL(/\/sign-in/);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("command-palette-input")).toHaveCount(0);
});

test("countersign is refused by the SERVER with a 409, not by button state", async ({
  page,
}) => {
  await openReview(page);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/second-reads")),
    page.getByTestId("countersign").click({ force: true }),
  ]);
  expect(res.status()).toBe(409);
  await expect(page.getByTestId("countersign")).toHaveAttribute(
    "title",
    /cannot countersign your own rulings/i,
  );
});
```

**Test ids these require** (none exist yet in web-v2): `na-state-select`,
`evidence-pane` with `data-zoomed`, `decisions-settled`, `command-palette-input`,
`countersign`, `escalate-confirm`. `sel-label`, `edit-value` and `key-map` already exist.

---

## 5. GATING logic and disabled-reason strings

Design rule 9: *every disabled control states its reason (title attr or inline note)*.
These are UI copy **and** test assertions. Verbatim.

### Release button

```js
releaseTitle: s.delivered && s.reissue && !s.reissueDone ? "Sign and transmit the v2 reissue"
  : s.delivered ? "Release already executed — reissue from the Delivered page"
  : d.readyToCompose ? "Sign and transmit to the client"
  : d.remaining > 0 ? `Blocked: ${d.remaining} fields still need rulings`
  : !s.secondRead ? "Blocked: T1 second read not countersigned"
  : "Blocked: county records outstanding",
releaseLabel: s.delivered && s.reissue && !s.reissueDone ? "Sign & Execute v2 Release"
  : s.delivered ? "Release Executed ✓" + (s.reissueDone ? " · v2" : " (Reissue Auth)")
  : "Sign & Execute Release",
```

The blocker precedence is strict and must be preserved: **open rulings → countersign →
record gaps.** Only the first applicable reason is shown.

### Countersign

```js
canCountersign:    s.activeRole === "QC Reviewer",
cannotCountersign: s.activeRole !== "QC Reviewer",
countersignNote:   s.activeRole === "QC Reviewer"
  ? "Signing as R. Menon (#GA-9104)"
  : "You cannot countersign your own rulings — a QC user must sign in (fast user switch)",
countersignBtnStyle: `... ${s.activeRole === "QC Reviewer"
  ? "background:#5B4B8A;color:#fff;cursor:pointer"
  : "background:#E4E7ED;color:#8A8E98;cursor:not-allowed"}`,
becomeQC: () => this.loginAs("r.menon@firstkey.co"),
```

Rendered only when blocked: a button reading **`"Switch user: R. Menon (QC)"`**.

### PDF, reissue, QC determination, template save, upload

```js
pdfTitle: s.delivered ? "Download the signed PDF" : "Locked — available after the release is signed",
reissueTitle: s.reissueDone ? "v2 already released — a further correction would open v3" : "Opens a v2 draft in the composer",
qcBtnTitle: s.activeRole === "QC Reviewer" ? "Ruling is stamped to the SOC 2 ledger" : "Requires the QC Reviewer persona",
saveTplTitle: s.activeRole === "Typist (Reviewer)" ? "VIEW access only — RBAC: Typist may not edit templates" : "Publish this template version",
upOk = !!(s.upClient && s.upProduct) && upReady;
upBlockedNote: upOk ? null : !s.upFile ? "Drop the package to begin" : !upReady ? "Waiting on quarantine" : "Pick client and product",
```

### Complete list of disabled-reason strings

- `` `Blocked: ${d.remaining} fields still need rulings` ``
- `"Blocked: T1 second read not countersigned"`
- `"Blocked: county records outstanding"`
- `"Sign and transmit to the client"` *(enabled state)*
- `"Sign and transmit the v2 reissue"` *(enabled state)*
- `"Release already executed — reissue from the Delivered page"`
- `"You cannot countersign your own rulings — a QC user must sign in (fast user switch)"`
- `"Signing as R. Menon (#GA-9104)"` *(enabled state)*
- `"Switch user: R. Menon (QC)"` *(escape-hatch button, rendered only when blocked)*
- `"Locked — available after the release is signed"` / `"Download the signed PDF"` *(enabled)*
- `"v2 already released — a further correction would open v3"` / `"Opens a v2 draft in the composer"` *(enabled)*
- `"Requires the QC Reviewer persona"` / `"Ruling is stamped to the SOC 2 ledger"` *(enabled)*
- `"VIEW access only — RBAC: Typist may not edit templates"` / `"Publish this template version"` *(enabled)*
- `"Drop the package to begin"`
- `"Waiting on quarantine"`
- `"Pick client and product"`

### Prose carrying the same rules (reuse as copy)

- `"All six flagged fields are decided. The three ruinous-exposure rulings need a second examiner's countersign before the report can compose — no single-examiner release."`
- `"All flagged decisions are answered. The three ruinous-exposure (T1) rulings await a second examiner's countersign — no single-examiner release."`
- `"Delivered reports are immutable records. Reissuing generates a certified v2 package with a stated reason, preserving full audit history for the lender."`
- `"✓ T1 second read countersigned by R. Menon (QC)"`
- `` `${d.gapsOpen} record outstanding. The moment county data lands, the section rebuilds and the gap closes.` ``
- `"Every decision is answered, countersigned and cited. The report has been pre-assembled from Template v4.2."`
- `` `${d.remaining} of ${D.human} flagged conflicts still need your ruling.` ``
- `"Awaiting QC or county portal records"`
- `"Client templates dictate formatting and syntax. Structural inclusion and search depth remain governed immutably by Product Overlays."`

### The derived-state function all gating reads from

```js
derived() {
  const s = this.state;
  const D = this.data();
  const NEED = D.NEED;
  const answeredNow = NEED.filter(l => s.answers[l]).length;
  const remaining = NEED.length - answeredNow;
  const openLabel = NEED.find(l => !s.answers[l]) ?? null;
  const answeredTotal = D.base + answeredNow;
  const taxCovered = !!s.answers[D.slot.tax];
  const gapsOpen = (s.gaps.tax === "open" && !taxCovered ? 1 : 0) + (s.gaps.judgment === "open" ? 1 : 0);
  const reviewDone = remaining === 0;
  const readyToCompose = reviewDone && gapsOpen === 0 && s.secondRead;
  return { answeredNow, remaining, openLabel, answeredTotal, gapsOpen, reviewDone, readyToCompose };
}
```

Per AGENTS.md ("Server owns all state machines and thresholds. UI never computes `state`
from confidence, never re-derives counts, chain termination, or release resolution"),
**none of `derived()` may survive into the React build as authority.** It may exist only
as a rendering convenience over server-sent values.

---

## 6. Client-side behavior that MUST move server-side

Every item below is enforced in the browser in the prototype. Design rule 12 (roles gate
server-side *and* visibly) and rule 13 (T1 countersign enforced with a **409**, not button
state) make each one a defect if reproduced.

1. **Countersign identity check.**
   ```js
   countersign: () => { if (this.state.activeRole === "QC Reviewer") this.setState(p => ({ ...p, secondRead:true })); },
   ```
   A role-string check in the browser, and it compares **role, not identity**. Two
   different QC users, or the very same user who made the ruling after switching personas,
   both pass. Rule 13 requires `ruling_examiner_id !== countersigner_id` enforced on
   `POST /second_reads` with a **409**. `cannotCountersign` and `countersignBtnStyle`'s
   `cursor:not-allowed` are presentation only.

2. **Release gate.**
   ```js
   release: () => {
     if (!d.readyToCompose) return;
     if (!this.state.delivered) this.set({ screen:"delivered", delivered:true });
     else if (this.state.reissue && !this.state.reissueDone) this.set({ screen:"delivered", reissueDone:true });
   },
   ```
   The entire gate is a client-side `return`. The server must re-check transactionally at
   the moment of signing and refuse with a typed error, per the README's own note that the
   gates "must be server-enforced in real build".

3. **Gate composition.** `readyToCompose = reviewDone && gapsOpen === 0 && s.secondRead`,
   with `gapsOpen` derived from `s.gaps` and `reviewDone` from `remaining === 0`. All three
   components must be recomputed server-side inside the release transaction, never trusted
   from the client. The UI renders the server's blocker, it does not compute one.

4. **Immutability of released versions.** `delivered`, `reissue` and `reissueDone` are
   plain booleans in `setState`. Nothing but a ternary prevents re-releasing v1 or
   double-executing v2. Released report versions must be immutable rows the server refuses
   to mutate; a second release attempt is a **409**, not a disabled button.

5. **Reissue reason.** `freshWork()` sets `reissueReason: 0` — a valid selection by
   default — so "reissue requires a reason" is **never actually enforced anywhere in the
   prototype**. The server must reject a reissue with no explicitly chosen reason, and the
   radio group must start unselected.

6. **RBAC on QC determinations and template save.** `qcBtnTitle` and `saveTplTitle` change
   the tooltip and styling by role, but the click handlers run regardless. Both need
   server-side role checks. Per design rule 12 the control still renders disabled with the
   rule stated, but the refusal itself is the server's.

### Additionally flagged

**`becomeQC: () => this.loginAs("r.menon@firstkey.co")`** — a one-click identity switch
with no authentication, offered directly from the blocked-countersign control. In the real
build that is a re-authentication boundary. It is also the mechanism by which the
prototype's own second-read gate can be defeated in two clicks, which is the clearest
demonstration available that client-side gating is not gating.

Consistent with AGENTS.md: **escalation resolution is refused without a rule**, and
**PENDING rules cannot affect the pipeline until engineer-confirmed** — the prototype's
`approve → rule appears in Settings catalog as PENDING` flow is display-only and carries no
enforcement, which is correct, but the refusal must exist server-side too.
