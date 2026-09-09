export { handlers } from "./handlers.js";
export {
  SAMPLE_PACKAGE_BYTES,
  registerPackageForTest,
  sampleBundle,
  type Bundle,
} from "./packages.js";
export {
  demoFields,
  demoOrder,
  demoOrder2,
  demoPages,
  demoRules,
  /* Readings payloads that are NOT a two-engine pair. Not members of
     `demoFields` on purpose — see their docstring in data.ts. */
  threeReadingField,
  lineFragmentField,
} from "./data.js";
