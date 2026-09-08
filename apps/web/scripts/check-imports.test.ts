/**
 * Every direction rule in check-imports.mjs, proven able to fail. Each case
 * copies the clean fixture tree, plants exactly one prohibited import, and
 * asserts the checker exits nonzero naming that rule — a rule with only its
 * passing case pinned is a rule with no ceiling. The clean tree pins the
 * other side: zero violations, exit 0, including the dynamic mock import in
 * main.tsx that the prod-reachability rule must leave alone.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const checker = join(scriptsDir, "check-imports.mjs");
const cleanTree = join(scriptsDir, "check-imports.fixtures", "clean");

function run(overlays: Record<string, string>): { status: number; output: string } {
  const root = mkdtempSync(join(tmpdir(), "check-imports-"));
  cpSync(cleanTree, root, { recursive: true });
  for (const [rel, content] of Object.entries(overlays)) {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const res = spawnSync(process.execPath, [checker, "--root", root], {
    encoding: "utf8",
  });
  return { status: res.status ?? -1, output: res.stdout + res.stderr };
}

const web = "apps/web/src";

describe("check-imports", () => {
  it("passes the clean tree, dynamic mock bootstrap included", () => {
    const res = run({});
    expect(res.output).toContain("check-imports: clean");
    expect(res.status).toBe(0);
  });

  it("fails a feature importing a sibling feature", () => {
    const res = run({
      [`${web}/features/alpha/useAlpha.ts`]: `
        import { BetaThing } from "../beta/BetaThing";
        export function useAlpha(): unknown {
          return BetaThing;
        }
      `,
    });
    expect(res.output).toContain("[cross-feature]");
    expect(res.status).not.toBe(0);
  });

  it("fails a feature import that reaches even a sibling's entry point", () => {
    const res = run({
      [`${web}/features/alpha/useAlpha.ts`]: `
        import { BetaThing } from "../beta";
        export function useAlpha(): unknown {
          return BetaThing;
        }
      `,
    });
    expect(res.output).toContain("[cross-feature]");
    expect(res.status).not.toBe(0);
  });

  it("fails app composition importing a feature internal instead of the entry", () => {
    const res = run({
      [`${web}/app/routeTree.ts`]: `
        import { AlphaScreen } from "../features/alpha/AlphaScreen";
        export function routeTree(t: unknown): unknown {
          return [AlphaScreen, t];
        }
      `,
    });
    expect(res.output).toContain("[feature-internal]");
    expect(res.status).not.toBe(0);
  });

  it("fails a cross-feature import laundered through a re-export barrel", () => {
    // Every edge here is individually legal — shared re-exports beta's ENTRY,
    // alpha imports shared — which is exactly what a line scanner cannot see.
    const res = run({
      [`${web}/shared/barrel.ts`]: `export * from "../features/beta";\n`,
      [`${web}/features/alpha/useAlpha.ts`]: `
        import { BetaThing } from "../../shared/barrel";
        export function useAlpha(): unknown {
          return BetaThing;
        }
      `,
    });
    expect(res.output).toContain("[barrel-laundered]");
    expect(res.status).not.toBe(0);
  });

  it("fails a ui primitive importing a feature, through the tsconfig alias", () => {
    const res = run({
      [`${web}/components/ui/button.tsx`]: `
        import { AlphaScreen } from "@/features/alpha";
        export function Button(): unknown {
          return AlphaScreen;
        }
      `,
    });
    expect(res.output).toContain("[ui-imports-feature]");
    expect(res.status).not.toBe(0);
  });

  it("fails shared importing the app shell", () => {
    const res = run({
      [`${web}/shared/util.ts`]: `
        import { routeTree } from "../app/routeTree";
        export function util(x: string): unknown {
          return routeTree(x);
        }
      `,
    });
    expect(res.output).toContain("[shared-imports-app]");
    expect(res.status).not.toBe(0);
  });

  it("fails the contract importing mocks", () => {
    const res = run({
      ["packages/contract/src/index.ts"]: `
        import { data } from "@titlepipe/mocks";
        export type Thing = { id: string };
        export const Thing = data;
      `,
    });
    expect(res.output).toContain("[contract-imports-pkg-mocks]");
    expect(res.status).not.toBe(0);
  });

  it("fails the contract importing a presentation library", () => {
    const res = run({
      ["packages/contract/src/index.ts"]: `
        import { useState } from "react";
        export type Thing = { id: string };
        export const Thing = useState;
      `,
    });
    expect(res.output).toContain("[contract-imports-presentation]");
    expect(res.status).not.toBe(0);
  });

  it("fails the production entry reaching mocks over a static import", () => {
    const res = run({
      [`${web}/main.tsx`]: `
        import { worker } from "@titlepipe/mocks/browser";
        import { routeTree } from "./app/routeTree";
        routeTree(worker);
      `,
    });
    expect(res.output).toContain("[prod-reaches-dev]");
    expect(res.status).not.toBe(0);
  });

  it("fails the production entry reaching mocks transitively", () => {
    const res = run({
      [`${web}/shared/util.ts`]: `
        import { worker } from "@titlepipe/mocks/browser";
        export function util(x: string): unknown {
          return worker.start() ?? x;
        }
      `,
      [`${web}/app/routeTree.ts`]: `
        import { util } from "../shared/util";
        import { AlphaScreen } from "../features/alpha";
        export function routeTree(t: unknown): unknown {
          return [util("x"), AlphaScreen, t];
        }
      `,
    });
    expect(res.output).toContain("[prod-reaches-dev]");
    expect(res.status).not.toBe(0);
  });

  it("fails an import cycle", () => {
    const res = run({
      [`${web}/shared/a.ts`]: `
        import { b } from "./b";
        export const a: string = b;
      `,
      [`${web}/shared/b.ts`]: `
        import { a } from "./a";
        export const b: string = a;
      `,
    });
    expect(res.output).toContain("[import-cycle]");
    expect(res.status).not.toBe(0);
  });

  it("fails an import the resolver cannot place", () => {
    const res = run({
      [`${web}/features/alpha/useAlpha.ts`]: `
        import { gone } from "./doesNotExist";
        export function useAlpha(): unknown {
          return gone;
        }
      `,
    });
    expect(res.output).toContain("[unresolved-import]");
    expect(res.status).not.toBe(0);
  });
});
