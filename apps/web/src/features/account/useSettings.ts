import { useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RbacMatrixResponse } from "@titlepipe/contract";
import { patch } from "../../shared/api";
import { audit, people, rbacMatrix } from "../../shared/accountQueries";
import { notify } from "../../shared/notify";

/**
 * The Settings pane's two writes. `PATCH /api/rbac` posts one clicked cell;
 * the server owns the cycle order (— → VIEW → EDIT → —) and answers with
 * the whole matrix, which replaces the cache verbatim — the client never
 * advances a level locally. `PATCH /api/people/{id}/role` posts the picked
 * role; the roster repaints from its own re-read. Both file audit events
 * server-side, so the audit pane's read is invalidated alongside.
 */
export function useCycleRbac() {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (cell: { row_id: string; role: string }) =>
      patch("/api/rbac", RbacMatrixResponse, cell),
    onSuccess: async (matrix) => {
      // The response IS the re-read; setting it avoids a paint of stale cells.
      client.setQueryData(rbacMatrix.key, matrix);
      await client.invalidateQueries({ queryKey: audit.key });
    },
    onSettled: () => {
      inFlight.current = false;
    },
    // The server's sentence, verbatim. Never composed here.
    onError: (error: Error) => notify.error(error.message),
  });

  const { mutate, reset } = mutation;
  const cycle = useCallback(
    (rowId: string, role: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      reset();
      mutate({ row_id: rowId, role });
    },
    [mutate, reset],
  );

  return { cycle, pending: mutation.isPending };
}

export function useAssignRole() {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (input: { personId: string; role: string }) =>
      patch(`/api/people/${input.personId}/role`, OkResponse, { role: input.role }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: people.key }),
        client.invalidateQueries({ queryKey: audit.key }),
      ]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const { mutate, reset } = mutation;
  const assign = useCallback(
    (personId: string, role: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      reset();
      mutate({ personId, role });
    },
    [mutate, reset],
  );

  return { assign, pending: mutation.isPending };
}

/** The mock's `{ ok: true }` acknowledgement — structural, like useEscalations'. */
const OkResponse = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};
