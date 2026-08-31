import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResolveEscalationRequest } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { escalations } from "../../shared/queries";
import { audit, rules } from "../../shared/accountQueries";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * Escalations and rules stay separate reads: the cluster is the question, the
 * rulebook is the answer space. Both go through the descriptors in `shared/` —
 * restating a path here means two spellings, two caches.
 *
 * `ResolveEscalationRequest` is the contract's union — cite a rule id, or
 * supply a draft — so a resolution with no rule is a type error before it is
 * a 422. Nothing optimistic: on success the queries are invalidated and the
 * server's rows repaint.
 */
export function useEscalations() {
  return useRead(escalations);
}

export function useRules() {
  return useRead(rules);
}

/**
 * One act files one record. `isPending` is state read at render, so repeated
 * clicks inside one frame all see `false` and all post; the ref latch moves
 * synchronously, so the repeats are dropped before they leave.
 */
export function useResolveEscalation(escalationId: string | null) {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (body: ResolveEscalationRequest) => {
      if (escalationId === null) {
        // Not reachable from the screen — the resolve card does not render
        // without a selected cluster. Thrown rather than silently no-op'd.
        throw new Error("No escalation selected.");
      }
      return post(`/api/escalations/${escalationId}/resolve`, OkResponse, body);
    },
    onSuccess: async () => {
      notify.success("✓ Rule written — cluster cleared.");
      await Promise.all([
        client.invalidateQueries({ queryKey: escalations.key }),
        client.invalidateQueries({ queryKey: rules.key }),
        // The ruling files an audit event server-side.
        client.invalidateQueries({ queryKey: audit.key }),
      ]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
    // The server's sentence, verbatim — never composed here.
    onError: (error: Error) => notify.error(error.message),
  });

  const { mutate, reset } = mutation;
  const resolve = useCallback(
    (body: ResolveEscalationRequest) => {
      if (inFlight.current) return;
      inFlight.current = true;
      reset();
      mutate(body);
    },
    [mutate, reset],
  );

  return { resolve, pending: mutation.isPending };
}

/**
 * The engineer gate — the only thing that can make a pending rule bind.
 * Drafting a candidate and confirming one are different acts by different roles.
 */
export function useConfirmRule() {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (ruleId: string) => post(`/api/rules/${ruleId}/confirm`, OkResponse),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: rules.key }),
        // Confirming files an audit event server-side.
        client.invalidateQueries({ queryKey: audit.key }),
      ]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const { mutate, reset } = mutation;
  const confirm = useCallback(
    (ruleId: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      reset();
      mutate(ruleId);
    },
    [mutate, reset],
  );

  return {
    confirm,
    pending: mutation.isPending,
    // The server's sentence, verbatim — never composed here.
    refusal: mutation.error === null ? null : mutation.error.message,
  };
}

/**
 * A structural validator rather than a zod schema — `shared/api.ts` takes
 * `Validator<T>`. The response carries no state; the invalidated queries do.
 */
const OkResponse = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};
