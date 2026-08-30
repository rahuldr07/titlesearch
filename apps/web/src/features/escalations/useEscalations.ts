import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResolveEscalationRequest } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { escalations } from "../../shared/queries";
import { audit, rules } from "../../shared/accountQueries";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE ESCALATION SCREEN'S DATA, AND THE TWO MUTATIONS IT IS ALLOWED.
 *
 * `GET /api/escalations` (handlers.ts:1389) and `GET /api/rules`
 * (handlers.ts:1407) are separate reads because they are separate objects: the
 * cluster is the question, the rulebook is the answer space, and joining them
 * client-side would put the rule catalog behind an escalation fetch. Both go
 * through the DESCRIPTORS in `shared/` — this file used to restate both paths
 * and both cache keys, which is `queries.ts`'s "two spellings, two caches".
 *
 * ══ THE REQUEST TYPE IS THE CONTRACT'S, NOT A LOCAL SHAPE ══════════════════
 *
 * `ResolveEscalationRequest` (endpoints.ts:268) is a union whose two arms ARE
 * `INVARIANTS:37`'s "exactly two resolution paths" — cite a rule id, or supply
 * a draft. Typing the mutation against it means a third path does not compile,
 * and means the client cannot post a resolution with no rule at all: the
 * `rule` key is required by the schema, so the refusal that
 * `endpoints.ts:233-236` states in prose is a TYPE ERROR here before it is a
 * 422 there.
 *
 * ══ NO OPTIMISTIC ANYTHING ═════════════════════════════════════════════════
 *
 * `INVARIANTS:4`. On success the queries are invalidated and the SERVER's rows
 * repaint. A drafted rule's `pending` status, in particular, is a thing only
 * the server can say.
 */
export function useEscalations() {
  return useRead(escalations);
}

export function useRules() {
  return useRead(rules);
}

/**
 * One act files one record. `isPending` is state read at render, so three
 * clicks inside one frame all see `false` and all three post — MEASURED: three
 * synchronous clicks produced three `POST /resolve` before this latch. The ref
 * moves synchronously, so the second and third are dropped before they leave.
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
        // The ruling files an audit event server-side (RULED 2026-08-29).
        client.invalidateQueries({ queryKey: audit.key }),
      ]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
    // The server's sentence, verbatim (INVARIANTS:58-59). Never composed here.
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
 * The engineer gate (handlers.ts:1410) — the ONLY thing that can make a
 * PENDING rule bind. Drafting a candidate and confirming one are two different
 * acts by two different roles, which is the whole point of `INVARIANTS:38`.
 */
export function useConfirmRule() {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (ruleId: string) => post(`/api/rules/${ruleId}/confirm`, OkResponse),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: rules.key }),
        // Confirming files an audit event server-side (RULED 2026-08-29).
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
    // The server's sentence, verbatim (INVARIANTS:58-59). Never composed here.
    refusal: mutation.error === null ? null : mutation.error.message,
  };
}

/**
 * The mock's `{ ok: true }` acknowledgement. A structural validator rather than
 * a zod schema, because `shared/api.ts` takes `Validator<T>` and this package
 * deliberately never imports zod into the browser bundle. The response carries
 * no state — the invalidated queries do.
 */
const OkResponse = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};
