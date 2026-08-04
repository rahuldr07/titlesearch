import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PreferencesResponse,
  type Preferences,
  type UpdatePreferencesRequest,
} from "@titlepipe/contract";
import { get, patch } from "../shared/api";

const preferencesQuery = queryOptions({
  queryKey: ["me", "preferences"],
  queryFn: () => get("/api/me/preferences", PreferencesResponse),
});

/**
 * UI PREFERENCES LIVE ON THE SERVER — decision C16, and the reason nothing in
 * this app touches browser storage (§9.11, and `check-rules` rejects it).
 *
 * The practical argument beats the rule anyway: a preference kept in one
 * browser silently resets on the machine somebody actually works on, and a
 * folded navigator that unfolds every morning is worse than one that never
 * folded. The server is the only place a preference survives being a person
 * rather than a browser profile.
 *
 * The collapse is OPTIMISTIC here, and this is the one place that is right.
 * Constraint 10 forbids optimistic updates on FIELD DECISIONS, where the
 * server's answer is the truth and painting it early shows a decision that
 * never happened. A fold is not a decision — it is a view, the local one is
 * already correct, and waiting a round trip to move a panel is just latency.
 */
export function useNavCollapsed(
  enabled: boolean,
  /*
   * The value shown while the preference is UNRESOLVED — before it has loaded,
   * and after it loads as `null`. The Review screen passes `true` so the rail
   * starts collapsed there (that screen needs every pixel, §11).
   *
   * A NULL PREFERENCE IS THE "NEVER CHOSEN" CASE THIS DEFAULT EXISTS FOR
   * (2026-07-30, Wave 2). While `nav_collapsed` was a plain boolean it could
   * not say "untouched": the served `false` resolved and immediately beat the
   * route default, so "Review starts collapsed" was unreachable however the
   * sidebar was written. Three states express the two rules — folded, unfolded,
   * and never asked — and an explicit toggle still wins from then on, because
   * a toggle writes a boolean and a boolean is no longer null.
   */
  routeDefault = false,
): [boolean, () => void] {
  const client = useQueryClient();
  /*
   * DISABLED ON THE CAPTURE SEAT. The rule: the typist screen issues ZERO /api
   * GETs — the only call it may make is the submit POST. There is no navigator
   * there to fold, so there is no preference to read, and structural blindness
   * is about what the wire carries, not only what the screen draws. Its
   * network-layer proof (`blind-blindness.spec` #1) IS NOT BUILT here; what
   * enforces it is the caller passing `chromeFor(pathname).fetches`, which
   * `chromeFor.test.ts` pins false for `/blind*`.
   */
  const { data } = useQuery({ ...preferencesQuery, enabled });
  const collapsed = data?.preferences.nav_collapsed ?? routeDefault;

  const save = useMutation({
    mutationFn: (body: UpdatePreferencesRequest) =>
      patch("/api/me/preferences", PreferencesResponse, body),
    onMutate: (body) => {
      const previous = client.getQueryData(preferencesQuery.queryKey);
      if (previous !== undefined) {
        // `exactOptionalPropertyTypes`: spreading a partial would widen every
        // field to `| undefined`. Only the fields actually sent are replaced.
        //
        // `=== undefined`, NOT `??`: `null` is a legal value for
        // `nav_collapsed` now, and `??` would read a deliberately sent null as
        // an omission and quietly keep the old boolean — the one merge bug that
        // makes "never chosen" unwritable.
        client.setQueryData(preferencesQuery.queryKey, {
          preferences: {
            nav_collapsed:
              body.nav_collapsed === undefined
                ? previous.preferences.nav_collapsed
                : body.nav_collapsed,
            reduced_motion: body.reduced_motion ?? previous.preferences.reduced_motion,
            default_zoom: body.default_zoom ?? previous.preferences.default_zoom,
            theme: body.theme ?? previous.preferences.theme,
          },
        });
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      // The server refused, so the view goes back. A fold that stuck after a
      // failed save would be a preference that looks saved and is not.
      if (context?.previous !== undefined) {
        client.setQueryData(preferencesQuery.queryKey, context.previous);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: preferencesQuery.queryKey }),
  });

  return [collapsed, () => save.mutate({ nav_collapsed: !collapsed })];
}

/**
 * THE THEME PREFERENCE — same server-side rule as the collapse (C16, §9.11),
 * same optimistic justification: which of two token blocks paints is a VIEW,
 * not a field decision, so there is no "decision that never happened" to show
 * early. `enabled` mirrors `useNavCollapsed`'s: the capture seat gets no theme
 * fetch either, because the zero-GET rule doesn't carve out an exception for
 * preferences that happen to be cosmetic. Same enforcement as above, and the
 * same gap — the harvested network-layer spec IS NOT BUILT.
 */
export function useTheme(enabled: boolean): [Preferences["theme"], () => void] {
  const client = useQueryClient();
  const { data } = useQuery({ ...preferencesQuery, enabled });
  const theme = data?.preferences.theme ?? "titlepipe";

  const save = useMutation({
    mutationFn: (body: UpdatePreferencesRequest) =>
      patch("/api/me/preferences", PreferencesResponse, body),
    onMutate: (body) => {
      const previous = client.getQueryData(preferencesQuery.queryKey);
      if (previous !== undefined) {
        client.setQueryData(preferencesQuery.queryKey, {
          preferences: {
            // Same `=== undefined` rule as `useNavCollapsed` above, and for the
            // same reason: this merge also carries `nav_collapsed` through.
            nav_collapsed:
              body.nav_collapsed === undefined
                ? previous.preferences.nav_collapsed
                : body.nav_collapsed,
            reduced_motion: body.reduced_motion ?? previous.preferences.reduced_motion,
            default_zoom: body.default_zoom ?? previous.preferences.default_zoom,
            theme: body.theme ?? previous.preferences.theme,
          },
        });
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(preferencesQuery.queryKey, context.previous);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: preferencesQuery.queryKey }),
  });

  return [
    theme,
    () => save.mutate({ theme: theme === "titlepipe" ? "mocha" : "titlepipe" }),
  ];
}
