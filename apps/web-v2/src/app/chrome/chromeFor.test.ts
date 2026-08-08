import { describe, expect, test } from "vitest";
import { chromeFor } from "./chromeFor";

/**
 * The audit found the full sidebar and an "L. Vance · ADMIN" identity chip
 * drawn on `/signin`, because both `AppChrome` and `OrderStrip` gated on
 * `/blind` alone. These pin the rule so a third consumer cannot reintroduce it
 * by copying the wrong predicate.
 */

describe("chromeFor", () => {
  test("an ordinary screen gets chrome and may fetch", () => {
    for (const path of ["/", "/queue", "/overview", "/orders/ord_demo_1/review"]) {
      expect(chromeFor(path)).toEqual({ chrome: true, fetches: true });
    }
  });

  test("nobody signed in sees no chrome — and the app asks the server nothing", () => {
    for (const path of ["/signin", "/session"]) {
      expect(chromeFor(path), `${path} must draw no chrome`).toEqual({
        chrome: false,
        fetches: false,
      });
    }
  });

  test("the capture seat is blind, structurally", () => {
    for (const path of ["/blind", "/blind/ord_demo_1"]) {
      expect(chromeFor(path)).toEqual({ chrome: false, fetches: false });
    }
  });

  test("a path that merely starts with a chromeless word keeps its chrome", () => {
    // `/sessions` is not `/session`; prefix matching must respect the boundary.
    expect(chromeFor("/sessions").chrome).toBe(true);
    expect(chromeFor("/signin-help").chrome).toBe(true);
  });
});
