/**
 * The golden capture roster.
 *
 * These are SHORT CODES, not field paths, and that is deliberate: the code is
 * the key in the exported fixture, and a fixture the test suite consumes
 * directly has to be typed by hand without a transcription step in between.
 * `golden.spec` #1 addresses `golden-ZIP` — the code IS the contract with the
 * test suite.
 */
export interface CaptureField {
  /** Fixture key and testid suffix — `golden-{code}`. */
  code: string;
  label: string;
  /** What the typist is looking at, so the label is not the only instruction. */
  hint: string;
}

export interface CaptureSection {
  title: string;
  fields: readonly CaptureField[];
}

/**
 * THE TWO SPECIAL VALUES ARE DIFFERENT OBJECTS, and this is the whole reason
 * the capture screen has two buttons instead of one "skip".
 *
 * `__DONT_KNOW__` is the typist: I could not read it. `__NOT_STATED__` is the
 * document: it is silent on this. They are the same two states the pipeline
 * carries as PRESENT_UNREADABLE and NOT_PRESENT, and collapsing them here
 * would make the golden set unable to grade the distinction it exists to
 * measure — a machine that says "not present" about a smudged figure would
 * score as correct against a seed that only recorded "blank".
 */
export const DONT_KNOW = "__DONT_KNOW__";
export const NOT_STATED = "__NOT_STATED__";

export const CAPTURE_SECTIONS: readonly CaptureSection[] = [
  {
    title: "SUBJECT",
    fields: [
      { code: "APN", label: "Parcel number", hint: "as printed on the tax card" },
      { code: "ZIP", label: "ZIP", hint: "the situs address, not the mailing address" },
      { code: "ACRES", label: "Acreage", hint: "from the legal description" },
      { code: "LEGAL", label: "Legal description", hint: "lot / block / plat book" },
    ],
  },
  {
    title: "VESTING",
    fields: [
      { code: "GRANTEE", label: "Current grantee", hint: "exactly as spelled in the vesting deed" },
      { code: "DEED_TYPE", label: "Deed type", hint: "warranty, quitclaim, executor's" },
      { code: "DEED_BK_PG", label: "Book / page", hint: "recording reference" },
      { code: "CONSID", label: "Consideration", hint: "words prevail over numerals" },
    ],
  },
  {
    title: "TAXES",
    fields: [
      { code: "TAX_YEAR", label: "Tax year", hint: "the year the bill is for" },
      { code: "TAX_AMT", label: "Amount", hint: "total due, all jurisdictions" },
      { code: "TAX_STATUS", label: "Status", hint: "paid, due, delinquent" },
    ],
  },
  {
    title: "LIENS",
    fields: [
      { code: "MTG_1_LENDER", label: "First lender", hint: "the beneficiary, not the servicer" },
      { code: "MTG_1_AMT", label: "First amount", hint: "the face amount of the security deed" },
    ],
  },
];
