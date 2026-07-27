import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeaderboardResponse, RoutingResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

const AckResponse: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

export const leaderboardQuery = queryOptions({
  queryKey: ["engines", "leaderboard"],
  queryFn: () => get("/api/engines/leaderboard", LeaderboardResponse),
});

export const routingQuery = queryOptions({
  queryKey: ["engines", "routing"],
  queryFn: () => get("/api/engines/routing", RoutingResponse),
});

/**
 * A SEAT CHANGE IS REFUSED WITHOUT EVIDENCE (`leaderboard.spec` #3). The server
 * requires `evidence_url` to be non-empty and records who approved it and when.
 *
 * There is no auto-promotion here and never will be. A cell winning on one
 * jurisdiction's golden set is not grounds to move it into production
 * everywhere — that is a person's decision, made on a bench run they can point
 * at afterwards.
 */
export function useFlipSeat() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      jurisdiction: string;
      section: string;
      seat: string;
      engine_id: string;
      evidence_url: string;
    }) => post("/api/engines/routing", AckResponse, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["engines", "routing"] }),
  });
}
