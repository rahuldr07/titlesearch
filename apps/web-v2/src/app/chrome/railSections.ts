import { doorGlyph, doorTitle, type Door } from "../../entities/nav/doors";
import type { LifecycleStage } from "../../entities/nav/LifecycleRail";
import type { SidebarDoorItem, SidebarSection } from "../../entities/nav/Sidebar";
import type { Attention } from "../attention";

/**
 * THE RAIL'S SECTION LIST — four headers in a fixed order, assembled once.
 *
 * Split out of `AppChrome`, which is the SMART component: it owns the router,
 * the role, the preference and five order reads. Deciding which groups exist,
 * what each is called and which one falls to the foot is none of those things —
 * it is a pure function of a door set and a flow, and it was the only part of
 * that component nothing could test without mounting a router.
 *
 * THE ORDER IS THE INVARIANT (Task 12): WORK · THIS ORDER · ADMIN · REFERENCE.
 * It is one array built top to bottom rather than four branches, so a group
 * cannot quietly move; an EMPTY group is absent rather than a bare header, which
 * is what a role holding no admin doors must see.
 */
export interface RailInputs {
  doors: readonly Door[];
  lifecycle: readonly LifecycleStage[];
  /** `THE FLOW` off an order, `THIS ORDER` on one — `flowSectionLabel` decides. */
  flowLabel: string;
  /**
   * The order's HUMAN reference, or null until it arrives. Never the URL id: an
   * id is how the app addresses an order, not what anyone calls it, and a header
   * that named the order wrongly for one paint is worse than one that waits.
   */
  orderRef: string | null;
  isActive: (to: string) => boolean;
  attentionFor: (path: string) => Attention;
}

export function railSections({
  doors,
  lifecycle,
  flowLabel,
  orderRef,
  isActive,
  attentionFor,
}: RailInputs): SidebarSection[] {
  const toItem = (door: Door): SidebarDoorItem => ({
    to: door.path,
    label: door.label,
    icon: doorGlyph(door),
    title: doorTitle(door),
    active: isActive(door.path),
    attention: attentionFor(door.path),
  });
  const group = (name: Door["group"]) =>
    doors.filter((d) => d.group === name).map(toItem);

  const sections: SidebarSection[] = [];
  const work = group("work");
  if (work.length > 0) sections.push({ kind: "doors", label: "WORK", doors: work });

  if (lifecycle.length > 0) {
    sections.push({
      kind: "lifecycle",
      label: flowLabel,
      ...(orderRef === null ? {} : { note: orderRef }),
      stages: lifecycle,
    });
  }

  /*
   * ADMIN AND EVERYTHING AFTER IT FALL TO THE FOOT (the mockup's
   * `margin-top:auto`). The rail then reads as two statements separated by air:
   * the work this seat does, and the tools it administers.
   *
   * `foot` is set on the FIRST of the two only. `mt-auto` on a later sibling
   * would consume the free space a second time and close the gap the first one
   * opened — which is why REFERENCE claims it only when ADMIN is absent.
   */
  const admin = group("admin");
  if (admin.length > 0)
    sections.push({ kind: "doors", label: "ADMIN", doors: admin, foot: true });

  const reference = group("reference");
  if (reference.length > 0) {
    sections.push({
      kind: "doors",
      label: "REFERENCE",
      doors: reference,
      foot: admin.length === 0,
    });
  }
  return sections;
}
