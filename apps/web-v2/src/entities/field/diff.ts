/**
 * Where two readings differ, character by character.
 *
 * TRANSCRIPTION IS A DEFECT SOURCE, and so is eyeballing. "SOUTHSTONE" against
 * "S0UTHST0NE" is three substituted characters in a 23-character string, and a
 * reviewer comparing them by eye at speed will pass it. Marking the differing
 * characters turns a proofreading task into a looking task.
 *
 * Deliberately positional rather than a real edit distance: an OCR
 * substitution — the failure mode these two engines actually have — keeps every
 * other character in place, and an alignment algorithm would smear a
 * three-character finding across the whole string on a single inserted space.
 * A length mismatch is shown as a difference from the shorter string's end,
 * which is correct for a truncation and honest about the rest.
 */
export interface DiffChar {
  char: string;
  differs: boolean;
}

export function diffChars(value: string, against: string): DiffChar[] {
  return [...value].map((char, index) => ({
    char,
    differs: against[index] !== char,
  }));
}
