import { AlphaScreen } from "../features/alpha";
import { Button } from "@/components/ui/button";

export function routeTree(t: unknown): unknown {
  return [AlphaScreen, Button, t];
}
