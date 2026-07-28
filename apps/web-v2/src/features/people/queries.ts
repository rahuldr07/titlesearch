import { queryOptions } from "@tanstack/react-query";
import { PeopleResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The roster, and the compliance figure beside it.
 *
 * `privileged_without_mfa` IS THE SERVER'S NUMBER, never a filter over the rows
 * this screen happens to have. The roster is role-scoped and the gate is not: a
 * count that falls as your permissions narrow is a gate that looks satisfied
 * when it is not. Whether it BLOCKS is open ruling Q16 and is not settled here,
 * which is exactly why the client must not start deciding it.
 *
 * Nothing on this screen measures a person. The payload carries authorisation
 * facts only — no orders reviewed, no correction rate, no last-active ranking —
 * because measuring people here would turn a register into a scoreboard.
 */
export const peopleQuery = queryOptions({
  queryKey: ["people"],
  queryFn: () => get("/api/people", PeopleResponse),
});
