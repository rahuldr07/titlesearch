# CONTRACT GAP — the queue screen, 2026-09-05

Written while building card TP-2. Everything here is a decision someone else
owns; nothing below was invented in `apps/web` to make a screen look finished.

The screen itself is `apps/web/src/features/queue/`, at `/queue`. It binds
`GET /api/queue/next` (`QueueNextResponse`, `endpoints.ts:75`) and
`POST /api/orders/{id}/pass` (`PassOrderRequest`/`PassOrderResponse`,
`endpoints.ts:218-226`, permission `order.pass`, `authz.ts:93`). Both are
settled shapes and both are served by `packages/mocks`.

---

## 1. `GET /api/queue/bands` is defined, served, and read by nothing

`QueueBandsResponse` (`endpoints.ts:108-125`) is a complete shape —
`mine` / `held` / `in_flight` / `delivered`, each with a server-supplied
`title`, `note`, `count` and row list — and `packages/mocks` serves it with a
role gate (`queueBandsFor`). **No screen in `apps/web` reads it.**

It was not put on `/queue`, and the reason is not that it was overlooked:

- `e2e/invariants/queue.spec.ts` #1 asserts `getByTestId("order-ref")`
  `toHaveCount(1)`, and its comment names the assertion — *"`toHaveCount(1)`
  IS 'no list'"*. Four bands of order rows is a list on the one screen whose
  whole invariant is that there is not one.
- The dispatch for this card restated it as a product requirement: the server
  owns assignment, there is no cherry-picking and no browsing for a next
  order.

The contract's own block comment argues the other way, and it argues well: no
band row carries a claim token, an assignment field or an orderable cursor, so
`/api/queue/next` stays the only hand-over *by construction* and a band list
cannot be used to take work. `mine` is what you already hold; `delivered` says
"get back to a recent one".

**The question, for whoever owns it:** which surface owns the bands? Three
answers are all defensible and this is not the file that picks one.

1. `/queue` gains them below the served order. Cheapest, and the invariant
   survives on the contract's argument — but the screen stops being "one
   order" at a glance, and `queue.spec` #1's comment would need rewriting to
   mean "exactly one *served* order" rather than "no list".
2. `/orders-list` gains them as a grouping. It is already the browse surface,
   so no invariant moves. But bands are scoped to the caller and All Orders is
   an ops index — the two answer different questions.
3. They stay unread until the four-layer port decides. Nothing breaks; a
   contract shape and a mock handler sit unused, which is what they do today.

Until then this is recorded rather than resolved. Nothing in `apps/web`
consumes the shape, and no local widening of any type was done.

## 2. What the queue deliberately does not draw

Not gaps. Each is a refusal with a citation, and each is the design's own list
furniture that a served-order hand-over must not have:

| the design's All Orders row has | why the queue has none |
|---|---|
| an `Assigned` column | INVARIANTS 22-23. `Order` (`entities.ts`) carries no assignment field; an order you were served is yours by definition |
| a `Due` / SLA chip | INVARIANTS 24-25 — no timers, no estimates. There is no SLA field in the contract to bind one to |
| a per-row `Open →` | taking a specific row IS the cherry-pick. One order, one primary act |
| a search box, filter tabs, pagination | all browse affordances; `/orders-list` is the surface that has them |

## 3. The door has no rail entry, and that is a product question

`authz.ts:62` grants `screen.queue.enter` to reviewer and admin, so the door
is real. `reference-app.html` draws no rail entry for it — its rail's Pipeline
group is Overview and All Orders, and the screen it calls `queue` internally
is the one labelled **Overview** (the palette calls it "Queue & Pipeline
Overview"). Drawing a third Pipeline entry would be inventing an affordance
the ruling source of truth does not have, which is the move
`CONFLICT-deleted-queue-and-rail-controls.md` §2 and §3 already refused twice.

So `/queue` sits in `doors.ts`'s `more` section, off the rail, offered by the
⌘K palette — the same placement as `/blind`, `/jurisdiction`, `/ingest` and
`/delivery`. **That leaves a reviewer's primary surface reachable only by
palette.** If the answer is that Pipeline gets a third entry, it is one line
in `doors.ts` and nothing else changes.

## 4. `ux.spec` :123 still fails, and its reason has moved

`CONFLICT-deleted-queue-and-rail-controls.md` §8 recorded *"the queue's pass
refusal nudges too"* as red because **there was no pass affordance anywhere in
the app**. There is one now, and the test gets further: `p` opens the reason,
the field takes focus, an empty Enter is refused and speaks. It still fails,
on vocabulary rather than on absence:

| the harvested spec wants | the screen renders |
|---|---|
| `data-testid="nudge"` | `data-testid="pass-nudge"` |
| copy containing `a pass needs its why` | "A pass needs its reason — the next person inherits this order and the reason is what they inherit with it." |

That is the same hold-vs-nudge axis §8 lists against HANDOFF decision #3, and
neither side was edited here: product copy is not rewritten to match a
harvested string, and an assertion is not weakened to match product copy. When
#3 is ruled, this closes with a testid and a sentence.

## 5. The queue contract in the four-layer port

`design/backend-2026-09/CONVENTIONS.md` §10 puts the wire in
`api/schemas` with `api/mappers` as the only place a model and a DTO meet.
Two properties this screen depends on should survive that move, because they
are what make its refusals real rather than decorative:

- `PassOrderResponse` is `{ ok: true }` **and nothing else**. Pass counts and
  the fourth-pass auto-escalation never reach the client. There is no counter
  to render and no way for the browser to learn one.
- `QueueNextResponse.order` is **nullable**, and null is the server's answer —
  "nothing for this seat" — not an empty list to browse. The screen prints
  three distinct states (asking / failed / answered-nothing) and must keep
  being able to.
