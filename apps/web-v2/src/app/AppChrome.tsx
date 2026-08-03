import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { doorsFor } from "../entities/nav/doors";
import { Sidebar } from "../entities/nav/Sidebar";
import { flowFor, flowRoute, flowSectionLabel } from "../entities/nav/flow";
import type { LifecycleStage } from "../entities/nav/LifecycleRail";
import { useSession } from "../shared/session";
import { useAttention, type Attention } from "./attention";
import { chromeFor } from "./chromeFor";
import { useNavCollapsed, useTheme } from "./preferences";
import { screenOrderFor } from "./flowOrders";
import { railSections } from "./railSections";
import { SidebarBrand } from "./SidebarBrand";
import {
  orderPipelineQuery,
  orderSignoffQuery,
  orderCompletenessQuery,
  orderFieldsQuery,
  orderContextQuery,
} from "./orderQueries";
import { stageAugmentFor, reviewAugment } from "./orderLifecycle";

/**
 * The chrome — the SMART wrapper around the presentational left rail. It owns
 * the concerns entities may not touch (§6): the router, the preference fetch,
 * the acting role, the attention query and this order's lifecycle reads.
 *
 * IT RENDERS THE RAIL AND NOTHING ELSE. The account menu and the order counts
 * are `OrderStrip`'s (§11 2026-07-30 revision). Neither is nested in the other
 * and neither gates the other: `rootRoute` puts this beside the content column
 * and `OrderStrip` at the top of it, so they are cousins reading the same URL
 * and the same preference query independently. The theme read that stays here
 * is only for the document-wide `data-theme` effect below.
 *
 * IT IS ABSENT ON THE CAPTURE SEAT, structurally, not cosmetically. A typist on
 * a blind pass must not see the pipeline's world — the doors name screens that
 * tell them what the machine already thinks. ALL SEVEN QUERIES BELOW ARE GATED
 * ON THE ONE `fetches` FLAG, so an eighth cannot be added without the seat
 * refusing it; `chromeFor.test.ts` pins `{chrome:false, fetches:false}` for
 * `/blind*`, and
 * `sidebar.spec` #3 pins the missing rail. The network-layer proof (harvested
 * `blind-blindness.spec` #1 — zero /api GETs, counted in-page) IS NOT BUILT
 * here: `e2e/helpers/net.ts` is the wrapper it needs and nothing calls it.
 *
 * THE ORDER IS A PURE FUNCTION OF THE PATH (`flowOrders.ts`) — the URL's id, or
 * the flow route's — never a remembered one. The URL alone left the flow
 * screens, which carry no order in the path, drawing a grey rail.
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

  // THIS ORDER's live state — the order this screen is about, resolved exactly
  // as `OrderStrip` resolves it, from the one map. All four disabled together
  // off an order screen and on the capture seat (the zero-GET rule).
  const orderId = fetches ? screenOrderFor(pathname) : null;
  const enabled = orderId !== null;
  const { data: pipeline } = useQuery({ ...orderPipelineQuery(orderId ?? ""), enabled });
  const { data: signoff } = useQuery({ ...orderSignoffQuery(orderId ?? ""), enabled });
  const { data: completeness } = useQuery({ ...orderCompletenessQuery(orderId ?? ""), enabled });
  const { data: fields } = useQuery({ ...orderFieldsQuery(orderId ?? ""), enabled });
  // The HUMAN reference for the flow header, never the URL id: `ord_demo_4` is
  // how the app addresses an order, not what anyone calls it. Shares
  // `OrderStrip`'s queryKey, so this is a subscriber and not a fifth request.
  const { data: context } = useQuery({ ...orderContextQuery(orderId ?? ""), enabled });

  if (!chrome) return null;

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const attentionFor = (path: string): Attention =>
    path === "/escalations" ? escalationAttention : null;

  // `flowFor` OWNS BOTH RULES: the position is the index in `FLOW` taken before
  // the filter (a stage a role cannot enter never renumbers the ones after it),
  // and every stage — Review included — passes the same authz gate the doors
  // do. The order-shaped exception that used to live in this filter drew Review
  // for roles `canAccess` refuses.
  const lifecycle: LifecycleStage[] = flowFor(role).map(({ step, n }): LifecycleStage => {
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
      n,
      ...augment,
      ...(route === null ? { reachable: false } : {}),
    };
  });

  return (
    <Sidebar
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      onNavigate={(to) => void navigate({ to })}
      brand={<SidebarBrand />}
      sections={railSections({
        doors: doorsFor(role),
        lifecycle,
        flowLabel: flowSectionLabel(orderId),
        // `?? null` and not `?.order_ref`: the header waits for the real
        // reference rather than showing the URL id in the meantime.
        orderRef: context?.order_ref ?? null,
        isActive,
        attentionFor,
      })}
    />
  );
}
