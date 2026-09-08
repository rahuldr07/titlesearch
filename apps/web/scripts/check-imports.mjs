/**
 * Dependency direction, enforced on a real module graph. check-rules.mjs is
 * a line scanner and says so in its own header: a cross-feature import
 * laundered through a re-export barrel is invisible to it. This tool parses
 * every module with the TypeScript compiler API, resolves specifiers the way
 * the bundler does (relative paths, tsconfig `paths`, workspace `exports`
 * maps), and checks direction on the resolved edges — so a barrel launders
 * nothing. It checks the graph only; the per-line rules stay in check-rules.
 *
 * The rules, each with its rejected alternative:
 *   feature-internal      Outside a feature, only `features/<f>/index.ts(x)`
 *                         may be imported. Convention-based entries ("the
 *                         Screen file is the entry") were rejected: a
 *                         convention the resolver cannot name is a rule the
 *                         resolver cannot check.
 *   cross-feature         features/a never imports features/b, entry or not.
 *   barrel-laundered      A feature (or ui) importing a module whose
 *                         re-export closure contains another feature's code
 *                         is a cross-feature import wearing a hat.
 *   ui-imports-feature    components/ui is a design system; it may not know
 *                         features exist, entry point or not.
 *   shared-imports-app    src/shared is below the app shell; the reverse
 *                         edge inverts the layering.
 *   contract-*            packages/contract depends on zod and nothing of
 *                         ours: not mocks, not apps/web, not presentation
 *                         libraries (react, @tanstack/*, react-aria).
 *   prod-reaches-dev      From src/main.tsx, static value edges never reach
 *                         packages/mocks or src/workbench. Dynamic imports
 *                         are exempt BY DESIGN: main.tsx's mock bootstrap is
 *                         `await import(...)` behind the build-time
 *                         VITE_API_MODE guard, and the minifier drops that
 *                         branch from live builds. Type-only edges are
 *                         erased and also exempt.
 *   import-cycle          No cycles over static + type-only edges, anywhere
 *                         in apps/web/src or packages/*\/src. Dynamic edges
 *                         are excluded: lazy import is the sanctioned way to
 *                         break a cycle.
 *   unresolved-import     A specifier the resolver cannot place fails the
 *                         run. An unresolved edge is a hole in the graph,
 *                         and a graph with holes proves nothing.
 *
 * Stated holes, mirroring check-rules.mjs's honesty:
 *   - `import {x} from "./f"; export {x}` written as two statements is seen
 *     as an import edge (direction-checked) but not as a re-export, so a
 *     hand-rolled two-statement barrel launders past the closure. The
 *     import edge itself still has to survive the direction rules.
 *   - import(variable) with a computed specifier is invisible.
 *   - *.test.* and *.stories.* files are not part of the shipped graph and
 *     are not scanned; vitest and storybook own their imports.
 *
 * Statement-level `import type` is what marks a type-only edge —
 * verbatimModuleSyntax (tsconfig.app.json) forces pure-type imports into
 * that form, which is what makes the statement-level check sufficient.
 *
 *   node scripts/check-imports.mjs [--root <dir>]
 *
 * --root points at a directory shaped like the repo (apps/web + packages);
 * the fixture trees under check-imports.fixtures/ use it. Default is the
 * real repo, located from this file's own path so cwd does not matter.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const scriptDir = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT =
  rootFlag !== -1 ? resolve(args[rootFlag + 1], "apps/web") : dirname(scriptDir);
const PACKAGES_DIR =
  rootFlag !== -1
    ? resolve(args[rootFlag + 1], "packages")
    : resolve(WEB_ROOT, "../../packages");
const WEB_SRC = join(WEB_ROOT, "src");

const SOURCE_EXTS = [".ts", ".tsx", ".mts", ".mjs"];
const ASSET_EXTS = [".css", ".png", ".svg", ".woff", ".woff2", ".json", ".jpg"];
const PRESENTATION_PACKAGES = [
  "react",
  "react-dom",
  "react-aria-components",
  "@tanstack/react-query",
  "@tanstack/react-router",
  "@tanstack/react-table",
  "@tanstack/react-virtual",
];

/** tsconfig `paths`, read with the TS JSONC reader — the file has comments. */
function readPathAliases(webRoot) {
  const file = join(webRoot, "tsconfig.app.json");
  if (!existsSync(file)) return {};
  const { config } = ts.readConfigFile(file, (p) => readFileSync(p, "utf8"));
  return config?.compilerOptions?.paths ?? {};
}

/** package.json `exports` maps for every workspace package, keyed by name. */
function readWorkspaceExports(packagesDir) {
  const map = new Map();
  if (!existsSync(packagesDir)) return map;
  for (const entry of readdirSync(packagesDir)) {
    const pkgFile = join(packagesDir, entry, "package.json");
    if (!existsSync(pkgFile)) continue;
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    map.set(pkg.name, { dir: join(packagesDir, entry), exports: pkg.exports ?? {} });
  }
  return map;
}

const PATH_ALIASES = readPathAliases(WEB_ROOT);
const WORKSPACE = readWorkspaceExports(PACKAGES_DIR);

function isScannable(name) {
  if (name.endsWith(".d.ts")) return false;
  if (/\.(test|stories)\.[a-z]+$/.test(name)) return false;
  return SOURCE_EXTS.some((ext) => name.endsWith(ext));
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules") continue;
      yield* walk(full);
    } else if (isScannable(name)) yield full;
  }
}

/** Try the bundler's candidate list for an extensionless or .js specifier. */
function resolveAsFile(base) {
  const candidates = [base];
  if (base.endsWith(".js")) candidates.push(base.slice(0, -3) + ".ts", base.slice(0, -3) + ".tsx");
  for (const ext of SOURCE_EXTS) candidates.push(base + ext);
  for (const ext of SOURCE_EXTS) candidates.push(join(base, "index" + ext));
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/**
 * Resolve a specifier to { file } | { external } | { asset } | { unresolved }.
 * Vite query suffixes (?url, ?raw) mark the import an asset by definition.
 */
function resolveSpecifier(spec, fromFile) {
  const clean = spec.split("?")[0];
  if (spec.includes("?") || ASSET_EXTS.some((e) => clean.endsWith(e)))
    return { asset: clean };

  if (clean.startsWith(".")) {
    const file = resolveAsFile(resolve(dirname(fromFile), clean));
    return file ? { file } : { unresolved: spec };
  }

  for (const [pattern, targets] of Object.entries(PATH_ALIASES)) {
    if (!pattern.endsWith("*") || !clean.startsWith(pattern.slice(0, -1))) continue;
    const rest = clean.slice(pattern.length - 1);
    const target = targets[0].replace("*", rest);
    const file = resolveAsFile(resolve(WEB_ROOT, target));
    return file ? { file } : { unresolved: spec };
  }

  const parts = clean.split("/");
  const pkgName = clean.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const ws = WORKSPACE.get(pkgName);
  if (ws !== undefined) {
    const sub = "." + clean.slice(pkgName.length);
    const target = ws.exports[sub];
    if (typeof target !== "string") return { unresolved: spec };
    if (ASSET_EXTS.some((e) => target.endsWith(e))) return { asset: target };
    const file = resolveAsFile(resolve(ws.dir, target));
    return file ? { file } : { unresolved: spec };
  }

  return { external: pkgName };
}

/**
 * Parse one module into edges: { spec, kind, reexport, line }.
 * kind: "static" | "type" | "dynamic".
 */
function parseEdges(file) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edges = [];
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      edges.push({
        spec: st.moduleSpecifier.text,
        kind: st.importClause?.isTypeOnly ? "type" : "static",
        reexport: false,
        line: lineOf(st),
      });
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      edges.push({
        spec: st.moduleSpecifier.text,
        kind: st.isTypeOnly ? "type" : "static",
        reexport: true,
        line: lineOf(st),
      });
    }
  }

  const findDynamic = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      edges.push({
        spec: node.arguments[0].text,
        kind: "dynamic",
        reexport: false,
        line: lineOf(node),
      });
    }
    ts.forEachChild(node, findDynamic);
  };
  ts.forEachChild(sf, findDynamic);

  return edges;
}

/** Zone of a module: feature:<f>, app, ui, components, shared, entities, workbench, web, pkg:<name>. */
function zoneOf(file) {
  if (file.startsWith(WEB_SRC + sep)) {
    const rel = relative(WEB_SRC, file).split(sep);
    if (rel.length === 1) return "app"; // main.tsx and any other src root file
    switch (rel[0]) {
      case "app":
        return "app";
      case "features":
        return "feature:" + rel[1];
      case "components":
        return rel[1] === "ui" ? "ui" : "components";
      case "shared":
        return "shared";
      case "entities":
        return "entities";
      case "workbench":
        return "workbench";
      default:
        return "web";
    }
  }
  const rel = relative(PACKAGES_DIR, file).split(sep);
  return "pkg:" + rel[0];
}

function featureEntry(file) {
  const rel = relative(WEB_SRC, file).split(sep);
  return (
    rel[0] === "features" &&
    rel.length === 3 &&
    (rel[2] === "index.ts" || rel[2] === "index.tsx")
  );
}

// ---------------------------------------------------------------------------
// Build the graph.

const modules = new Map(); // file -> { zone, edges: [{to|external|asset|unresolved, kind, reexport, line, spec}] }
const scanRoots = [WEB_SRC];
if (existsSync(PACKAGES_DIR))
  for (const entry of readdirSync(PACKAGES_DIR)) {
    const src = join(PACKAGES_DIR, entry, "src");
    if (existsSync(src)) scanRoots.push(src);
  }

for (const root of scanRoots)
  for (const file of walk(root))
    modules.set(file, { zone: zoneOf(file), edges: [] });

const offenses = [];
const shortPath = (file) =>
  relative(rootFlag !== -1 ? resolve(args[rootFlag + 1]) : resolve(WEB_ROOT, "../.."), file);

for (const [file, mod] of modules) {
  for (const edge of parseEdges(file)) {
    const resolved = resolveSpecifier(edge.spec, file);
    if (resolved.asset !== undefined) continue;
    if (resolved.unresolved !== undefined) {
      offenses.push(
        `${shortPath(file)}:${edge.line} [unresolved-import] "${edge.spec}" ` +
          `resolves to nothing this checker can see — an unresolved edge is a hole in the graph`,
      );
      continue;
    }
    if (resolved.external !== undefined) {
      mod.edges.push({ ...edge, external: resolved.external });
      continue;
    }
    if (!modules.has(resolved.file)) {
      // A scanned module importing an unscanned file (a .test., a .d.ts)
      // would silently drop graph edges; surface it instead.
      offenses.push(
        `${shortPath(file)}:${edge.line} [unresolved-import] "${edge.spec}" ` +
          `resolves to ${shortPath(resolved.file)}, which is outside the scanned graph`,
      );
      continue;
    }
    mod.edges.push({ ...edge, to: resolved.file });
  }
}

// ---------------------------------------------------------------------------
// Re-export closure: provides(M) = M plus everything its re-exports provide.

const providesMemo = new Map();
function provides(file, seen = new Set()) {
  if (providesMemo.has(file)) return providesMemo.get(file);
  if (seen.has(file)) return new Set([file]);
  seen.add(file);
  const out = new Set([file]);
  for (const edge of modules.get(file)?.edges ?? []) {
    if (!edge.reexport || edge.to === undefined) continue;
    for (const p of provides(edge.to, seen)) out.add(p);
  }
  providesMemo.set(file, out);
  return out;
}

/** Shortest re-export chain from `from` to `target`, for the offense message. */
function reexportChain(from, target) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === target) break;
    for (const edge of modules.get(cur)?.edges ?? []) {
      if (edge.reexport && edge.to !== undefined && !prev.has(edge.to)) {
        prev.set(edge.to, cur);
        queue.push(edge.to);
      }
    }
  }
  const chain = [];
  for (let cur = target; cur !== null; cur = prev.get(cur) ?? null) chain.unshift(shortPath(cur));
  return chain.join(" -> ");
}

// ---------------------------------------------------------------------------
// Direction rules, on the resolved edges.

for (const [file, mod] of modules) {
  const from = mod.zone;
  for (const edge of mod.edges) {
    if (edge.external !== undefined) {
      if (from === "pkg:contract" && PRESENTATION_PACKAGES.includes(edge.external))
        offenses.push(
          `${shortPath(file)}:${edge.line} [contract-imports-presentation] ` +
            `packages/contract imports "${edge.external}" — the contract depends on zod and nothing else of ours`,
        );
      continue;
    }
    const to = modules.get(edge.to).zone;
    const toFeature = to.startsWith("feature:") ? to.slice("feature:".length) : null;
    const fromFeature = from.startsWith("feature:") ? from.slice("feature:".length) : null;

    if (toFeature !== null && from === "ui") {
      offenses.push(
        `${shortPath(file)}:${edge.line} [ui-imports-feature] ` +
          `components/ui imports features/${toFeature} — the design system may not know features exist`,
      );
    } else if (toFeature !== null && fromFeature !== null && toFeature !== fromFeature) {
      offenses.push(
        `${shortPath(file)}:${edge.line} [cross-feature] ` +
          `features/${fromFeature} imports features/${toFeature} — features do not import each other`,
      );
    } else if (toFeature !== null && fromFeature === null && !featureEntry(edge.to)) {
      offenses.push(
        `${shortPath(file)}:${edge.line} [feature-internal] ` +
          `imports ${shortPath(edge.to)} — outside a feature, only features/${toFeature}/index.ts(x) may be imported`,
      );
    }

    if (from === "shared" && to === "app")
      offenses.push(
        `${shortPath(file)}:${edge.line} [shared-imports-app] ` +
          `src/shared imports ${shortPath(edge.to)} — shared sits below the app shell`,
      );

    if (from === "pkg:contract" && to !== "pkg:contract")
      offenses.push(
        `${shortPath(file)}:${edge.line} [contract-imports-${to.replace(":", "-")}] ` +
          `packages/contract imports ${shortPath(edge.to)} — the contract depends on nothing of ours`,
      );

    // Barrel laundering: the module imported is innocent by zone, but its
    // re-export closure carries another feature's code into this one.
    if ((fromFeature !== null || from === "ui") && toFeature === null) {
      for (const provided of provides(edge.to)) {
        const pz = modules.get(provided).zone;
        if (pz.startsWith("feature:") && pz !== from) {
          offenses.push(
            `${shortPath(file)}:${edge.line} [barrel-laundered] ` +
              `${from === "ui" ? "components/ui" : "features/" + fromFeature} imports ` +
              `${pz.replace(":", "s/")} through a barrel: ${reexportChain(edge.to, provided)}`,
          );
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Production reachability: static value edges only, from src/main.tsx.

{
  const entry = join(WEB_SRC, "main.tsx");
  if (modules.has(entry)) {
    const prev = new Map([[entry, null]]);
    const queue = [entry];
    while (queue.length) {
      const cur = queue.shift();
      const zone = modules.get(cur).zone;
      if (zone === "pkg:mocks" || zone === "workbench") {
        const chain = [];
        for (let c = cur; c !== null; c = prev.get(c) ?? null) chain.unshift(shortPath(c));
        offenses.push(
          `${shortPath(cur)} [prod-reaches-dev] reachable from src/main.tsx over ` +
            `static imports: ${chain.join(" -> ")} — mocks and workbench are dev-only`,
        );
        continue;
      }
      for (const edge of modules.get(cur).edges) {
        if (edge.kind !== "static" || edge.to === undefined || prev.has(edge.to)) continue;
        prev.set(edge.to, cur);
        queue.push(edge.to);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cycles: Tarjan over static + type edges. Iterative — the graph is shallow
// today, but a recursion-depth crash inside the cycle detector would read as
// "no cycles".

{
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  let counter = 0;
  const sccs = [];

  for (const start of modules.keys()) {
    if (index.has(start)) continue;
    const work = [[start, 0]];
    while (work.length) {
      const frame = work[work.length - 1];
      const [node] = frame;
      if (frame[1] === 0) {
        index.set(node, counter);
        low.set(node, counter);
        counter += 1;
        stack.push(node);
        onStack.add(node);
      }
      const edges = modules
        .get(node)
        .edges.filter((e) => e.kind !== "dynamic" && e.to !== undefined);
      let advanced = false;
      while (frame[1] < edges.length) {
        const next = edges[frame[1]].to;
        frame[1] += 1;
        if (!index.has(next)) {
          work.push([next, 0]);
          advanced = true;
          break;
        }
        if (onStack.has(next)) low.set(node, Math.min(low.get(node), index.get(next)));
      }
      if (advanced) continue;
      if (low.get(node) === index.get(node)) {
        const scc = [];
        let popped;
        do {
          popped = stack.pop();
          onStack.delete(popped);
          scc.push(popped);
        } while (popped !== node);
        const selfLoop =
          scc.length === 1 &&
          modules.get(node).edges.some((e) => e.to === node && e.kind !== "dynamic");
        if (scc.length > 1 || selfLoop) sccs.push(scc);
      }
      work.pop();
      if (work.length) {
        const [parent] = work[work.length - 1];
        low.set(parent, Math.min(low.get(parent), low.get(node)));
      }
    }
  }

  for (const scc of sccs)
    offenses.push(
      `[import-cycle] ${scc.length} module(s): ` +
        scc
          .map((f) => shortPath(f))
          .sort()
          .join(" -> ") +
        " -> (back to start)",
    );
}

if (offenses.length) {
  console.error(`\n${offenses.length} import-direction violation(s):\n`);
  for (const o of offenses.sort()) console.error("  " + o);
  console.error("");
  process.exit(1);
}
console.log(`check-imports: clean (${modules.size} modules)`);
