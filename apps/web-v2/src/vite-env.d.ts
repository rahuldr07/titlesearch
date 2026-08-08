/**
 * The build-time environment this app reads, declared rather than inferred.
 *
 * `vite/client` types every unlisted `VITE_*` key through an index signature
 * whose value type is the one BRIEF §6 bans — so reading an undeclared variable
 * launders that type into the app with no cast, no assertion and nothing for
 * eslint to see. Declaring the key is what makes the read checked.
 *
 * Typed as a plain string, not the `"mock" | "live"` union it should hold: this
 * value arrives from a shell, and a type that promised the union would make
 * `main.tsx`'s refusal look like dead code and invite its removal. The narrowing
 * belongs at the boundary, which is where the app already puts every other one.
 */
interface ImportMetaEnv {
  readonly VITE_API_MODE?: string;
}
