# Research memo — the external retention floor

**Status: RESEARCH INPUT. Not legal advice, not policy.**
Nothing here is a TitlePipe rule. No number below becomes a default, a config value, a
migration, or a UI string until the owner/compliance decision at
`docs/backend/IMPLEMENTATION_PLAN.md:1458` is actually made and recorded as a ruling.
Cite this memo as *research*, never as authority. Counsel in each operating state must
confirm before anything here is implemented.

Date: 2026-09-01 · Node: `comp-legal-floor` · Prepared against external primary sources.

---

## 1. Why this exists

Every prior compliance audit in this swarm read the repo, not the law. `comp-synth`
flagged it explicitly ("treat Area 2's obligations as repo-derived only"). Retention is
the most exposed item: the plan defers the window to an unmade decision, and the only
number anywhere in the tree is **"7 years" in an HTML design mock**
(`reference-app.html:382`) with zero policy authority behind it. That number is a
pixel, not a rule. Under the hard rule *never generate backend logic from the UI*, it
must not survive contact with the schema.

## 2. The GLBA Safeguards Rule floor (16 CFR Part 314)

TitlePipe processes nonpublic personal information (NPI) on behalf of title agents and
underwriters, so it is in scope as a **service provider** to covered financial
institutions, and plausibly as a covered financial institution itself depending on
activities. Either way the customer's obligations flow to us by contract.

Relevant obligations, from the rule text:

| Obligation | Source |
|---|---|
| Written information security program, based on a **written** risk assessment | 16 CFR 314.4(b)(1) |
| Named Qualified Individual; if that role sits with a service provider, the customer **retains** compliance responsibility and must require the provider to maintain a conforming program | 16 CFR 314.4(a)(1)–(3) |
| Encryption of customer information in transit and **at rest**, or compensating controls approved in writing | 16 CFR 314.4(c)(3) |
| MFA for any individual accessing any information system | 16 CFR 314.4(c)(5) |
| **Secure disposal no later than two years after last use** — with express carve-outs | 16 CFR 314.4(c)(6)(i) |
| **Periodic review of the data retention policy** to minimize unnecessary retention | 16 CFR 314.4(c)(6)(ii) |
| Logging/monitoring of authorized-user activity and tampering detection | 16 CFR 314.4(c)(8) |
| Service-provider oversight: select capable providers, **require safeguards by contract**, periodically reassess | 16 CFR 314.4(f)(1)–(3) |
| Written incident response plan (7 enumerated areas) | 16 CFR 314.4(h) |
| Annual written report to board or senior officer | 16 CFR 314.4(i) |
| **Notify the FTC within 30 days** of discovering a notification event affecting ≥500 consumers | 16 CFR 314.4(j)(1) (added 88 FR 77508, eff. 2024-05-13) |

Sources: <https://www.law.cornell.edu/cfr/text/16/314.4>,
<https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314>,
<https://www.federalregister.gov/documents/2023/11/13/2023-24412/standards-for-safeguarding-customer-information>.

**The critical clause.** 314.4(c)(6)(i) requires disposal within two years of last use
*"unless such information is necessary for business operations or for other legitimate
business purposes, **is otherwise required to be retained by law or regulation**, or
where targeted disposal is not reasonably feasible due to the manner in which the
information is maintained."*

That is not a two-year ceiling. It is a **default with a statutory-retention exception
written into it**. GLBA does not fight state retention law; it yields to it.

## 3. State title/escrow retention minimums (illustrative, not exhaustive)

These are the multi-year statutory minimums that occupy the exception above.

**Texas** — TDI Basic Manual, Procedural Rule **P-32**, under Tex. Ins. Code §2704.001:
- escrow accounting documentation (settlement statements, disbursement sheets, invoices, check copies): **at least 3 years**
- **evidence of insurability** — title commitment, title report, title opinion, **run sheet** — excluding copies of public-record documents: **at least 15 years** after policy issuance
- **title insurance policies: retained indefinitely**
- electronically produced or scanned documents may substitute for hard copies
Source: <https://tdi.texas.gov/title/titlem4f.html>

**California** — Cal. Code Regs. tit. 10, §1737.3: an escrow agent shall preserve **at
least five years from close of escrow** all trust/escrow bank statements, cancelled
checks, deposit slips, banking records, the Statement of Account, escrow instructions
and amendments, and **"all additional records pertinent to the escrow transaction."**
Electronic retention is allowed only on **non-erasable WORM media**, NIST/AIIM quality
standards, with written authentication that the record is an exact unaltered copy.
Source: <https://www.law.cornell.edu/regulations/california/10-CCR-1737.3>

Other states impose their own windows (commonly 3–7 years for escrow files, longer for
policy files). **Not researched here — see open questions.**

The Texas 15-year rule matters most for TitlePipe specifically: a **run sheet** and a
**title report** are named categories of "evidence of insurability." That is precisely
what this product produces. Our primary output is, in Texas, a 15-year record.

## 4. ALTA Best Practices — Pillars 3 and 5

ALTA Best Practices (current version **4.2, effective 2025-08-19**) is a **voluntary
industry framework**, not law. It becomes binding on TitlePipe only through underwriter
or customer contract, which in practice is how it usually binds.

- **Pillar 3 (privacy and information security)**: adopt and maintain a written
  information security plan (WISP) **and** a written privacy plan protecting NPI "as
  required by local, state, and federal law," covering MFA, disposal of NPI, and
  vendor management. Pillar 3 therefore does not add an independent retention number;
  it *incorporates by reference* whatever the applicable law requires, i.e. §3 above.
- **Pillar 5 (policy production and delivery)**: timely production and delivery of the
  policy, with retention of the associated file. Relevant to us mainly because the
  policy-file record is the one Texas says is kept indefinitely.

Sources: <https://www.alta.org/policies-and-standards/best-practices/>,
<https://www.alta.org/news-and-publications/news/20240917-Revision-to-ALTA-Best-Practices-Published-as-Final>,
<https://www.stewart.com/en/insights/alta-best-practices-latest-revisions-2024>.
ALTA's own normative text should be read directly before anything is built on this
paragraph; the summaries above are secondary sources.

## 5. Does anything forbid the deletion GLBA implies?

**Yes — and this is the memo's central finding.**

The GLBA disposal duty is real but **conditional**, and the condition is satisfied by
state title/escrow retention law. There is no conflict to resolve:

- 16 CFR 314.4(c)(6)(i) suspends its own two-year disposal clock where retention is
  "required to be retained by law or regulation."
- Texas P-32 and Cal. §1737.3 are exactly such requirements.
- So for records in those categories, **deleting at two years would violate state law,
  and retaining them does not violate GLBA.**

The residual GLBA duty is therefore not "delete everything at two years." It is:
**delete everything that is *not* under a statutory hold, and be able to prove which
is which.** That is a *classification* obligation, and it is the one the repo currently
has no vocabulary for. A single tenant-wide retention window cannot express it.

## 6. What this does to the append-only-audit vs. purge tension

The repo treats `audit_log` as append-only and enforces it in the database
(`docs/HANDOFF.md:30` — two BEFORE STATEMENT triggers; `docs/CONTEXT.md:144`;
`docs/PRD.md:123`), while simultaneously promising "per-tenant retention windows +
secure deletion" (`docs/PRD.md:248`, `docs/HANDOFF.md:102`). Those two are in tension
only if they are applied to the same bytes. The external floor suggests they should not be:

1. **The audit log is evidence, not subject matter.** 314.4(c)(8) affirmatively
   *requires* logging of user activity and tampering detection. California's §1737.3(b)(3)
   goes further for escrow records and demands **WORM, non-erasable** storage with
   authentication that the copy is unaltered. Append-only is not merely compatible with
   the floor; for some record classes it is closer to what the floor asks for than a
   mutable store would be.
2. **Purge applies to NPI payloads**, not to the fact that an event occurred. An audit
   row that records *"actor X released report Y at time T"* is not obviously NPI. An
   audit row that embeds a borrower DOB is. If audit rows are kept free of NPI payloads
   by construction, the append-only guarantee and the disposal duty stop competing.
3. **Crypto-shredding is the standard reconciliation** and the repo is already close to
   it: field-level envelope encryption for DOB/bankruptcy already exists in the plan
   (`docs/PRD.md:248`). Destroying a per-record data key renders the ciphertext
   unreadable without deleting a row, satisfying "secure disposal" while preserving
   append-only structure. **Whether that counts as disposal under 314.4(c)(6) is a
   legal question, not an engineering one, and is unresolved here.**
4. **Retention is per record class, not per tenant.** Texas alone forces at least four
   classes (escrow accounting 3y / evidence of insurability 15y / policy indefinite /
   everything else). A single `retention_days` column on a tenant is not expressive
   enough to be compliant and would be a schema defect, not a config gap.

## 7. What the owner ruling must choose BETWEEN

The floor removes most of the freedom the plan implicitly assumed. The decision at
`IMPLEMENTATION_PLAN.md:1458` is **not** "pick a number." It is a set of constrained
choices:

1. **Longest-common-window vs. per-jurisdiction windows.** Either retain everything to
   the longest applicable floor (in Texas, that means *indefinite* for policy records,
   15y for run sheets/reports) and accept the GLBA minimization tension, **or** build
   per-jurisdiction, per-record-class retention. There is no third option where one
   short number is safe. "7 years" satisfies neither Texas branch and is below no floor
   worth naming — it is simply unsourced.
2. **Who owns the record.** If TitlePipe is a processor and the agent is the record
   holder of the P-32 file, the statutory window may bind the *customer*, with our duty
   arriving by contract (and possibly requiring **return-then-delete** rather than
   retain). If TitlePipe holds the only copy, the statutory window binds our storage
   directly. These produce different systems. **This is the first question to answer;
   everything else depends on it.**
3. **Deletion mechanics: row deletion vs. crypto-shredding vs. tombstone.** Constrained
   by the append-only triggers and by California's WORM requirement. Choosing row
   deletion means abandoning append-only for some tables; choosing crypto-shredding
   means the key lifecycle becomes the compliance artifact and must itself be audited.
4. **Record-class taxonomy.** Whatever is chosen, the schema needs a record-class
   dimension (evidence-of-insurability / escrow-accounting / policy / derived-artifact /
   NPI-payload) before any retention field is meaningful. This is the concrete blocker
   that can be worked now regardless of the owner's numeric choice.
5. **Legal-hold override.** Litigation hold suspends every window above. Absent from
   the repo entirely.

**Recommended framing for the ruling:** the owner is choosing a *retention architecture*
under a floor, not a *retention period*. The number is downstream and per class.

## 8. Open questions / not checked

- ALTA 4.2 normative text not read directly (secondary sources only); Pillar 5 treated thinly.
- Only TX and CA statutes examined. FL, NY, IL, and other target states unresearched.
- Whether TitlePipe is a "financial institution" itself under GLBA vs. only a service provider — unresolved, changes who owes 314.4 directly.
- Whether crypto-shredding satisfies 16 CFR 314.4(c)(6) "secure disposal" — no authority located.
- State breach-notification statutes (50-state) not covered; only the federal FTC 30-day/500-consumer trigger.
- CCPA/CPRA deletion rights and their **GLBA exemption** not analyzed — potentially a second deletion-vs-retention conflict.
- No counsel reviewed any of this.
