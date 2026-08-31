import { useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplateSaveResponse, type TemplateToken } from "@titlepipe/contract";
import { patch } from "../../shared/api";
import { templateCatalog, templateDetail } from "../../shared/templateQueries";
import { audit } from "../../shared/accountQueries";
import { notify } from "../../shared/notify";

/**
 * The template save. Posts the edited wording; the server answers with the
 * draft version and appends the audit event. Guarded by `template.edit`
 * server-side (403) — the disabled button with its hint is a courtesy,
 * never the enforcement.
 */
export function useSaveTemplate(templateId: string | null) {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (wording: Record<string, string>) => {
      if (templateId === null) throw new Error("No template selected.");
      return patch(`/api/templates/${templateId}`, TemplateSaveResponse, { wording });
    },
    onSuccess: async (saved) => {
      notify.success(`Saved ✓ — ${saved.version}.`);
      await Promise.all([
        client.invalidateQueries({ queryKey: templateCatalog.key }),
        client.invalidateQueries({ queryKey: templateDetail(saved.id).key }),
        // The save files an audit event server-side.
        client.invalidateQueries({ queryKey: audit.key }),
      ]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
    // The server's sentence, verbatim. Never composed here.
    onError: (error: Error) => notify.error(error.message),
  });

  const { mutate, reset } = mutation;
  const save = useCallback(
    (wording: Record<string, string>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      reset();
      mutate(wording);
    },
    [mutate, reset],
  );

  return { save, pending: mutation.isPending };
}

/**
 * The live preview: the block's expression with each served token replaced
 * by its served sample. Presentation of two server lists, not a value the
 * report emits — the compiled manifest stays the server's (`export_spec`).
 */
export function interpolate(wording: string, tokens: readonly TemplateToken[]): string {
  let out = wording;
  for (const { token, sample } of tokens) {
    out = out.split(token).join(sample);
  }
  return out;
}

/** The four NA members, in the drawn order with the drawn labels. */
export const NA_MODES = [
  { id: "structurally_absent", label: "1. Structurally Absent" },
  { id: "not_found", label: "2. Not Found" },
  { id: "not_stated", label: "3. Not Stated" },
  { id: "unreadable", label: "4. Unreadable" },
] as const;
export type NaModeId = (typeof NA_MODES)[number]["id"];
