import { describe, expect, test } from "vitest";
import { initialsOf } from "./identity";

/**
 * The avatar is the only thing in the chrome that says whose session this is,
 * so the cases that matter are the ones where a name is not two plain words.
 */
describe("initialsOf", () => {
  test("a dotted initial is one letter, not a stray period", () => {
    // The demo actor. `split(" ")` would give "L." and yield "L." or "L.V".
    expect(initialsOf("L. Vance")).toBe("LV");
    expect(initialsOf("R. Delacroix")).toBe("RD");
  });

  test("two plain words give both initials", () => {
    expect(initialsOf("Marlowe Quenby")).toBe("MQ");
  });

  test("more than two words still gives two letters", () => {
    // A mark wider than the circle drawn for it is a broken circle.
    expect(initialsOf("Tessa R. Quenby Jr")).toBe("TR");
  });

  test("one word gives one letter rather than throwing", () => {
    expect(initialsOf("Vance")).toBe("V");
  });

  test("a name the session does not carry gives an empty mark", () => {
    // NOT "undefined", and not a crash. The chrome renders on every screen,
    // including before a session resolves.
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });

  test("the mark is upper case whatever the name is", () => {
    expect(initialsOf("l. vance")).toBe("LV");
  });
});
