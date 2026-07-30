import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { doorsFor, doorGlyph, doorTitle, type Door } from "../entities/nav/doors";
import { Sidebar, type SidebarDoorItem, type SidebarSection } from "../entities/nav/Sidebar";
import { FLOW, flowRoute, flowSectionLabel } from "../entities/nav/flow";
import type { LifecycleStage } from "../entities/nav/LifecycleRail";
import { useSession } from "../shared/session";
import { useAttention, type Attention } from "./attention";
import { chromeFor } from "./chromeFor";
import { useNavCollapsed, useTheme } from "./preferences";
import { orderFromPath } from "./orderFromPath";
import { SidebarBrand } from "./SidebarBrand";
import {
  orderPipelineQuery,
  orderSignoffQuery,
  orderCompletenessQuery,
  orderFieldsQuery,
  stageAugmentFor,
  reviewAugment,
} from "./orderLifecycle";

/**
 * The chrome — the SMART wrapper around the presentational left rail. It owns
 * the concerns entities may not touch (§6): the router, the preference fetch,
 * the acting role and the attention query. It hands the rail a plain door set
 * and the persisted collapse.
 *
 * THE ACCOUNT MENU AND THE ORDER COUNTS LIVE IN `OrderStrip` NOW, not here —
 * the full-width top bar the design draws on every screen (§11 2026-07-30
 * revision). `AppChrome` keeps the theme fetch and the `data-theme` effect
 * (still needed for the whole document, capture seat aside) but no longer
 * renders `AccountMenu`; `OrderStrip` is `AppChrome`'s sibling in `rootRoute`,
 * not its child, and reads the same URL and the same preference independently.
 *
 * IT IS ABSENT ON THE CAPTURE SEAT, structurally, not cosmetically. A typist on
 * a blind pass must not see the pipeline's world — the doors name screens that
 * tell them what the machine already thinks. The preference fetch and the
 * attention query are BOTH disabled there, so the seat issues zero /api GETs
 * (`blind-blindness.spec`); removing the rail is the same rule that kills the
 * keyboard layer on `/blind/*`.
 *
 * THE ORDER COMES FROM THE URL, never a remembered "current order" — two tabs
 * on two orders is a normal way to work.
 */
export function AppChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const role = useSession((s) => s.role);
  // `chromeFor` owns which surfaces draw chrome and which may fetch. They are
  // separate claims: gating on `/blind` alone drew the whole rail — every ADMIN
  // door, and an identity chip — on `/signin`, to somebody not signed in.
  const { chrome, fetches } = chromeFor(pathname);
  const onReview = /^\/orders\/[^/]+\/review/.test(pathname);
  // Review starts collapsed UNTIL SOMEBODY CHOOSES OTHERWISE, not merely on the
  // first paint — `nav_collapsed` is null until a press writes one (§preferences).
  const [collapsed, toggleCollapsed] = useNavCollapsed(fetches, onReview);
  // Same zero-GET rule as the collapse. Only the VALUE is needed here now (the
  // toggle moved to `OrderStrip` with `AccountMenu`) — this call still owns the
  // `data-theme` effect below.
  const [theme] = useTheme(fetches);
  // `:root` IS TitlePipe; `[data-theme="mocha"]` is the only value that means
  // anything else, so the attribute is set only for the non-default theme
  // rather than toggled between two literal values (`tokens.css` §8).
  useEffect(() => {
    if (theme === "mocha") {
      document.documentElement.dataset.theme = "mocha";
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [theme]);
  // One escalations query, disabled on the capture seat (the zero-GET rule).
  const escalationAttention = useAttention(fetches ? "/escalations" : "");

  // THIS ORDER's live state — the URL order, same as `OrderStrip` (Task 11's
  // principle). All four disabled together off an order screen and on the
  // capture seat, so neither adds a GET the zero-GET rule forbids.
  const orderId = fetches ? orderFromPath(pathname) : null;
  const enabled = orderId !== null;
  const { data: pipeline } = useQuery({ ...orderPipelineQuery(orderId ?? ""), enabled });
  const { data: signoff } = useQuery({ ...orderSignoffQuery(orderId ?? ""), enabled });
  const { data: completeness } = useQuery({ ...orderCompletenessQuery(orderId ?? ""), enabled });
  const { data: fields } = useQuery({ ...orderFieldsQuery(orderId ?? ""), enabled });

  if (!chrome) return null;

  const heldDoors = doorsFor(role);
  const held = new Set(heldDoors.map((door) => door.path));
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const attentionFor = (path: string): Attention =>
    path === "/escalations" ? escalationAttention : null;

  // THE POSITION IS THE INDEX IN `FLOW`, taken before any filter, so a door a
  // role does not hold can never renumber the stages that follow it — and
  // Review, whose route needs an order, still counts as five whether or not
  // one is in view (`entities/nav/flow.ts`).
  const lifecycle: LifecycleStage[] = FLOW.map((step, i): LifecycleStage => {
    const route = flowRoute(step, orderId);
    const to = route ?? step.path;
    // `done`/`badge` are ORDER data: off an order screen they are false/null
    // rather than fabricated progress for an order nobody is looking at.
    const augment =
      orderId === null || route === null
        ? { done: false, badge: null }
        : step.orderScoped
          ? reviewAugment({ pipeline, fields })
          : stageAugmentFor(step.path, { pipeline, signoff, completeness });
    return {
      to,
      label: step.label,
      active: isActive(to),
      attention: attentionFor(to),
      n: i + 1,
      ...augment,
      ...(route === null ? { reachable: false } : {}),
    };
  }).filter(
    (stage) => stage.reachable === false || stage.to.startsWith("/orders/") || held.has(stage.to),
  );

  const toItem = (door: Door): SidebarDoorItem => ({
    to: door.path,
    label: door.label,
    icon: doorGlyph(door),
    title: doorTitle(door),
    active: isActive(door.path),
    attention: attentionFor(door.path),
  });
  const sections: SidebarSection[] = [];
  const work = heldDoors.filter((d) => d.group === "work").map(toItem);
  if (work.length > 0) sections.push({ kind: "doors", label: "WORK", doors: work });
  if (lifecycle.length > 0)
    sections.push({ kind: "lifecycle", label: flowSectionLabel(orderId), stages: lifecycle });
  const admin = heldDoors.filter((d) => d.group === "admin").map(toItem);
  if (admin.length > 0) sections.push({ kind: "doors", label: "ADMIN", doors: admin });
  const reference = heldDoors.filter((d) => d.group === "reference").map(toItem);
  if (reference.length > 0) sections.push({ kind: "doors", label: "REFERENCE", doors: reference });

  return (
    <Sidebar
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      onNavigate={(to) => void navigate({ to })}
      brand={<SidebarBrand />}
      sections={sections}
    />
  );
}
