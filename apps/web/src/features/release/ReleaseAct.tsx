import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { TextField } from "react-aria-components";
import type { CompositionResponse } from "@titlepipe/contract";
import { Alert, Button, Input, Label } from "../../components/ui";
import { notify } from "../../shared/notify";
import { CompositionJson } from "./CompositionJson";
import { releaseHold, useRelease } from "./useRelease";

/**
 * SIGN AND RELEASE — the foot of the compiler.
 *
 * ══ THE SERVER'S VERDICT IS DRAWN, NOT RECOMPUTED ══════════════════════════
 *
 * `releasable` and `blocked_reason` are printed exactly as they arrive. This
 * screen never counts open gates to decide either one.
 *
 * ══ AND THE BUTTON STAYS LIVE WHILE A GATE IS OPEN ═════════════════════════
 *
 * Deliberate. The gate refusal belongs to the server, and it answers with its
 * own sentence (409). Holding the submit on `releasable === false` would swap
 * that sentence for ours before it was ever spoken. What IS held is what the
 * client can know about itself: an unsigned act, an act in flight, and a sheet
 * already sealed.
 *
 * ══ THE GATE LINE IS A DOOR, AND THE SERVER NAMES IT ═══════════════════════
 *
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the reference's gate footer line
 * is CLICKABLE and "opens the step that is blocking release". The reference
 * chose the destination by counting open fields client-side; here the SERVER
 * names it (`CompositionResponse.blocked_door`), so the drawn affordance
 * exists without this screen re-deriving release resolution. The link is
 * drawn verbatim off the wire and only while a door is named.
 */
export function ReleaseAct(props: { readonly composed: CompositionResponse }) {
  const [signature, setSignature] = useState("");
  const release = useRelease(props.composed.order_id);
  const router = useRouter();
  /* `isPending` is a render away, and three clicks inside one tick beat it —
     measured: three requests. The latch closes on the click itself. */
  const filing = useRef(false);
  const held = releaseHold(props.composed, signature, release.isPending);
  const door = props.composed.blocked_door;

  return (
    <div data-testid="release-act" className="flex flex-col gap-8">
      {props.composed.blocked_reason !== null && (
        <Alert
          tone="halt"
          title="The release gate is closed"
          message={props.composed.blocked_reason}
          {...(door !== null
            ? {
                action: (
                  /* The server-named door — a path, not a typed route, so it
                     goes through the router's history rather than a typed
                     `Link` the wire could never satisfy. */
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="release-open-blocker"
                    onPress={() => {
                      void router.history.push(door);
                    }}
                  >
                    Open the step that is blocking release →
                  </Button>
                ),
              }
            : {})}
        />
      )}

      {release.isError && release.error !== null && (
        <div data-testid="release-refusal">
          {/* The server's words, unedited and undismissable. */}
          <Alert tone="halt" title="Refused" message={release.error.message} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Label htmlFor="release-signature">
            Sign to release — your name goes on the delivered report
          </Label>
          <TextField
            aria-label="Sign to release — your name goes on the delivered report"
            value={signature}
            onChange={setSignature}
            isDisabled={props.composed.seal_sha256 !== null}
          >
            <Input
              id="release-signature"
              data-testid="release-signature"
              placeholder="Full name, as it should appear"
            />
          </TextField>
        </div>

        <CompositionJson composed={props.composed} />

        <Button
          variant="primary"
          data-testid="release-submit"
          disabledBecause={held}
          onPress={() => {
            if (filing.current) return;
            filing.current = true;
            release.mutate(signature, {
              onSuccess: (result) => {
                setSignature("");
                notify.success(`Released — sealed ${result.seal_sha256.slice(0, 12)}.`);
              },
              onSettled: () => {
                filing.current = false;
              },
            });
          }}
        >
          {held === null ? "Sign and release" : held}
        </Button>
      </div>

      {held !== null && (
        /* Rule 9 on screen, not only on hover: the reason a control is dead. */
        <p data-testid="release-hold" className="font-sans text-meta leading-body text-ink-secondary">
          {held}
        </p>
      )}
    </div>
  );
}
