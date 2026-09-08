/**
 * The `rules-allow:` escape hatch, pinned on both sides. A marker reaches its
 * own line and at most ALLOW_REACH lines above it — the trailing-comment
 * position prettier leaves it in when it explodes a construct (e9a0ab6
 * orphaned nine markers exactly this way). The negative cases are the point:
 * a marker one line past the reach, or above the violation, suppresses
 * nothing. A hatch with only its suppressing case pinned has no ceiling.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const checker = join(scriptsDir, "check-rules.mjs");

/** The duplicate-token block reads the real tokens.css via the script's own
 *  path, so it runs against the repo here; only `src/` comes from the tmp root. */
function run(files: Record<string, string>): { status: number; output: string } {
  const root = mkdtempSync(join(tmpdir(), "check-rules-"));
  for (const [rel, content] of Object.entries(files)) {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const res = spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: res.status ?? -1, output: res.stdout + res.stderr };
}

const widget = "src/components/ui/widget.tsx";

describe("check-rules rules-allow reach", () => {
  it("passes a clean file", () => {
    const res = run({
      [widget]: `export const Widget = () => <div className="p-4" />;\n`,
    });
    expect(res.output).toContain("check-rules: clean");
    expect(res.status).toBe(0);
  });

  it("suppresses on the marker's own line, the pre-formatter position", () => {
    const res = run({
      [widget]: [
        `const s = { style: { width: w } }; /* rules-allow: a continuous percentage has no class form */`,
        `export const Widget = () => <div {...s} />;`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("check-rules: clean");
    expect(res.status).toBe(0);
  });

  it("suppresses from the trailing line prettier leaves it on, at full reach", () => {
    // The exact shape of tableRow.tsx:96 after e9a0ab6: opener, three
    // properties, marker on the closer — four lines above the marker.
    const res = run({
      [widget]: [
        `export const Widget = () => (`,
        `  <div`,
        `    style={{`,
        `      gridTemplateColumns: template,`,
        `      height: rowHeight,`,
        `      transform: shift,`,
        `    }} /* rules-allow: the offset comes from the virtualizer per frame; no class can express it */`,
        `  />`,
        `);`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("check-rules: clean");
    expect(res.status).toBe(0);
  });

  it("does not suppress one line past the reach", () => {
    const res = run({
      [widget]: [
        `export const Widget = () => (`,
        `  <div`,
        `    style={{`,
        `      gridTemplateColumns: template,`,
        `      height: rowHeight,`,
        `      transform: shift,`,
        `      opacity: fade,`,
        `    }} /* rules-allow: five lines up is past the ceiling, so this must not apply */`,
        `  />`,
        `);`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("[inline-style]");
    expect(res.status).not.toBe(0);
  });

  it("does not reach downward past its own line", () => {
    const res = run({
      [widget]: [
        `const a = 1; /* rules-allow: attached to this line, not to what follows it */`,
        `const s = { style: { width: a } };`,
        `export const Widget = () => <div {...s} />;`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("[inline-style]");
    expect(res.status).not.toBe(0);
  });

  it("still rejects a marker with no reason, in the trailing position too", () => {
    const res = run({
      [widget]: [
        `export const Widget = () => (`,
        `  <div`,
        `    style={{`,
        `      width: w,`,
        `    }} /* rules-allow: */`,
        `  />`,
        `);`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("[unjustified-exemption]");
    expect(res.status).not.toBe(0);
  });

  it("reaches a split date constructor through the whole-file check", () => {
    const res = run({
      ["src/shared/clock.ts"]: [
        `export const when = new Date(`,
        `  2026,`,
        `  8,`,
        `  8,`,
        `); /* rules-allow: fixture pinning that the whole-file date check honours the reach */`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("check-rules: clean");
    expect(res.status).toBe(0);
  });

  it("does not reach a date constructor past the ceiling", () => {
    const res = run({
      ["src/shared/clock.ts"]: [
        `export const when = new Date(`,
        `  2026,`,
        `  8,`,
        `  8,`,
        `  12,`,
        `); /* rules-allow: the constructor opens five lines up, past the ceiling */`,
        ``,
      ].join("\n"),
    });
    expect(res.output).toContain("[raw-date]");
    expect(res.status).not.toBe(0);
  });
});
