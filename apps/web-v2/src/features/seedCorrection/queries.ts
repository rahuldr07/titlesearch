import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { GoldenResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

/**
 * The three writes return the server's acknowledgement, and NOTHING READS IT.
 * The screen refetches `/api/golden` instead, because the tag, the signature
 * and the timestamp are all server-derived — rendering a locally-assembled
 * version of the record would be the client keeping its own copy of a state
 * machine it does not own (§9.9).
 */
const Ack: Validator<unknown> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null
      ? { success: true, data: input }
      : { success: false, error: { message: "expected an object" } },
};

export const goldenQuery = queryOptions({
  queryKey: ["golden"],
  queryFn: () => get("/api/golden", GoldenResponse),
});

function useGoldenWrite<TBody>(path: (body: TBody) => string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => post(path(body), Ack, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["golden"] }),
  });
}

/**
 * A GOLDEN CORRECTION IS REFUSED WITHOUT A SOURCE AND A REASON
 * (`golden.spec` #3). The contract requires both at `min(1)`, so the server
 * refuses too — the disabled button is the courtesy, not the enforcement.
 *
 * A correction here changes what every future measurement is graded against.
 * Without a citation the next person cannot check it, and an unverifiable seed
 * silently marks a correct extraction wrong forever.
 */
export function useCorrectSeed() {
  return useGoldenWrite<{
    golden_field_id: string;
    corrected_value: string;
    source_citation: string;
    reason: string;
  }>(() => "/api/golden/corrections");
}

/** Affirming a seed as-is still requires a reason (`golden.spec` #4). */
export function useConfirmSeed(id: string) {
  return useGoldenWrite<{ reason: string }>(() => `/api/golden/${id}/confirm`);
}

/**
 * DEMOTE-TO-SUSPECT is the third answer, and the one that keeps the other two
 * honest (`golden.spec` #5): a seed nobody can confirm from the document is not
 * a correction and not an affirmation. Without this the only exits are "change
 * it" and "bless it", and an illegible recital gets blessed.
 */
export function useDemoteSeed(id: string) {
  return useGoldenWrite<{ reason: string }>(() => `/api/golden/${id}/demote`);
}
