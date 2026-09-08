import { thing } from "../../entities/thing";
import { util } from "../../shared/util";
import { useAlpha } from "./useAlpha";

export function AlphaScreen(): string {
  return util(thing) + useAlpha();
}
