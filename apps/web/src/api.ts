import type { z } from "zod";

/**
 * Thin fetch wrapper: every response is parsed against its contract schema,
 * so a drifted mock or server fails loudly at the boundary instead of
 * rendering wrong. The UI derives nothing (CONTEXT §7) — it renders what the
 * schema admits.
 */
export async function api<S extends z.ZodType>(
  schema: S,
  path: string,
  init?: RequestInit,
): Promise<z.output<S>> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return schema.parse(await res.json());
}
