import type { ReactNode } from "react";
import { ApiError } from "../api";

/**
 * Mutation-refusal surfacing. A 409/422 is the server explaining itself —
 * the explanation renders next to the control that triggered it, in attend
 * tokens (a refusal asks for attention; hot red stays reserved for quality
 * defects). The screen's job after an error is to invalidate the mutated
 * entity's query so the server's true state repaints — never to guess.
 */

interface ZodIssueish {
  path?: (string | number)[];
  message?: string;
}

/** Collapse an error to one quiet line. Zod-422 bodies (the mock returns
 * `parsed.error.message`, a JSON array of issues) become "path: message". */
export function errorLine(error: unknown): string {
  if (error instanceof ApiError) {
    const msg = error.message.trim();
    if (msg.startsWith("[")) {
      try {
        const issues = JSON.parse(msg) as ZodIssueish[];
        const first = issues[0];
        if (first?.message !== undefined) {
          const path = (first.path ?? []).join(".");
          return path === ""
            ? `server: ${first.message}`
            : `server: ${path}: ${first.message}`;
        }
      } catch {
        /* not zod JSON — fall through to verbatim */
      }
    }
    return `server: ${msg}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export function MutationNote({
  error,
  register = "light",
  testid = "mutation-note",
}: {
  error: unknown;
  register?: "light" | "dark";
  testid?: string;
}): ReactNode {
  if (error == null) return null;
  return (
    <div
      data-testid={testid}
      className={`mt-[6px] text-[11.5px] leading-[1.5] ${
        register === "dark" ? "text-dk-attend" : "text-attend"
      }`}
    >
      {errorLine(error)}
    </div>
  );
}
