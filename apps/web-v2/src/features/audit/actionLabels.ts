/**
 * The server's action vocabulary said in English, with the token kept beside it.
 *
 * RULE: a record of what people did has to READ as what they did. FAILURE
 * PREVENTED: the row printed `golden_correction` and nothing else, so the one
 * screen whose entire purpose is answering "who amended that claim" answered it
 * in the server's log format. The design writes every row as a sentence —
 * "R. Delacroix · Amended claim" — because the person asking that question is
 * an admin reading a record, not an engineer reading a log.
 *
 * THIS IS UI COPY OVER A CLOSED VOCABULARY, NOT DERIVED STATE. Nothing here
 * decides anything: the phrase is a synonym for a token the server already
 * chose, one to one, and no branch reads it. Naming a token is not the same act
 * as computing a verdict from one.
 *
 * ONLY THE ACTIONS THE ENDPOINT ACTUALLY SERVES ARE MAPPED. Pre-mapping tokens
 * nobody emits would be writing copy for facts that do not exist yet; when the
 * server grows an action, this map grows with it and the row shows the token
 * verbatim in the meantime. That fallthrough is the load-bearing part — a log
 * is worth keeping only if it is complete, so an unmapped action must render
 * ugly rather than render blank.
 *
 * THE RAW TOKEN IS NEVER DROPPED. `AuditRow` keeps it in mono on the sub-line,
 * so the string somebody greps for in the server's logs is still the string on
 * screen. The sentence is added; nothing is replaced.
 */
const ACTION_PHRASES: Readonly<Record<string, string>> = {
  engine_seat_change: "Changed engine seat",
  escalation_resolved: "Resolved escalation",
  field_confirmed: "Confirmed field",
  golden_correction: "Corrected golden field",
  rule_confirmed: "Confirmed rule",
};

/** The action as a person says it — or the server's own token, unchanged. */
export function actionPhrase(action: string): string {
  return ACTION_PHRASES[action] ?? action;
}
