import { beforeEach, expect, test } from "vitest";
import { useOverlays } from "./overlays";

/**
 * The history overlay's subject — set by the caller, forgotten on close.
 * The dangerous case is a name that outlives its overlay: opened on a table
 * row, closed, reopened on a different order's route, the stale name would
 * win over the route. These pin that it cannot.
 */
beforeEach(() => {
  useOverlays.setState({ stack: [], historySubject: null });
});

test("openOrderHistory names the order and pushes exactly one layer", () => {
  useOverlays.getState().openOrderHistory("ord_demo_7");
  expect(useOverlays.getState().stack).toEqual(["order-history"]);
  expect(useOverlays.getState().historySubject).toBe("ord_demo_7");

  useOverlays.getState().openOrderHistory("ord_demo_9");
  expect(useOverlays.getState().stack).toEqual(["order-history"]);
  expect(useOverlays.getState().historySubject).toBe("ord_demo_9");
});

test("closing forgets the subject, however it is closed", () => {
  for (const shut of [
    () => useOverlays.getState().close("order-history"),
    () => useOverlays.getState().toggle("order-history"),
    () => useOverlays.getState().popOne(),
  ]) {
    useOverlays.getState().openOrderHistory("ord_demo_7");
    shut();
    expect(useOverlays.getState().stack).toEqual([]);
    expect(useOverlays.getState().historySubject).toBeNull();
  }
});

test("closing another layer leaves the subject alone", () => {
  useOverlays.getState().openOrderHistory("ord_demo_7");
  useOverlays.getState().open("key-map");
  expect(useOverlays.getState().popOne()).toBe(true);
  expect(useOverlays.getState().stack).toEqual(["order-history"]);
  expect(useOverlays.getState().historySubject).toBe("ord_demo_7");
});
