import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { Preferences, UpdatePreferencesRequest } from "@titlepipe/contract";
import { mockServer } from "@titlepipe/mocks/node";

/**
 * `theme` is a preference like `nav_collapsed` — server-side (decision C16),
 * defaulted, and round-tripped through the mock's sessionStorage stand-in
 * (packages/mocks/src/workspace.ts — the MOCK's database, not app storage;
 * §9.11 forbids browser storage in app code, not in the mock backend).
 */

describe("Preferences schema carries a theme", () => {
  test("defaults to titlepipe when absent", () => {
    const p = Preferences.parse({ nav_collapsed: false, reduced_motion: false, default_zoom: 1 });
    expect(p.theme).toBe("titlepipe");
  });

  test("accepts the declared themes", () => {
    expect(() =>
      Preferences.parse({
        nav_collapsed: false,
        reduced_motion: false,
        default_zoom: 1,
        theme: "mocha",
      }),
    ).not.toThrow();
  });

  test("rejects an undeclared theme", () => {
    expect(() =>
      Preferences.parse({
        nav_collapsed: false,
        reduced_motion: false,
        default_zoom: 1,
        theme: "neon",
      }),
    ).toThrow();
  });

  test("PATCH accepts a lone theme field (partial update)", () => {
    expect(() => UpdatePreferencesRequest.parse({ theme: "mocha" })).not.toThrow();
  });
});

/**
 * The mock's handlers carry RELATIVE paths ("/api/me/preferences") for the
 * browser Service Worker (`@titlepipe/mocks/browser`), which resolves them
 * against the page's own `location`. Node has no such global, so `msw/node`
 * cannot rebase a relative pattern without one — this shim supplies just the
 * `.href` msw's resolver actually reads (`getAbsoluteUrl`), scoped to this
 * file only.
 */
globalThis.location = { href: "http://localhost/" } as Location;

describe("the mock persists theme across GET after PATCH", () => {
  beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
  afterEach(() => mockServer.resetHandlers());
  afterAll(() => mockServer.close());

  test("a PATCHed theme is echoed by the next GET", async () => {
    const patched = await fetch("http://localhost/api/me/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "mocha" }),
    });
    expect(patched.ok).toBe(true);
    const patchedBody: unknown = await patched.json();
    expect((patchedBody as { preferences: { theme: string } }).preferences.theme).toBe("mocha");

    const got = await fetch("http://localhost/api/me/preferences");
    const gotBody: unknown = await got.json();
    expect((gotBody as { preferences: { theme: string } }).preferences.theme).toBe("mocha");
  });
});
