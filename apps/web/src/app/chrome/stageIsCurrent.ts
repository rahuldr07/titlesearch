/**
 * Is this stage the one the current route shows? Pathname is the only input.
 * Lives beside StageLink (its destinations are the other half of the same
 * table): a stage is "current" exactly when the door StageLink opens for it
 * is the one already on screen.
 */
export function stageIsCurrent(id: string, pathname: string): boolean {
  if (id === "processing") return /\/orders\/[^/]+\/extraction$/.test(pathname);
  if (id === "review") return /\/orders\/[^/]+\/review$/.test(pathname);
  if (id === "composer") return /\/orders\/[^/]+\/release$/.test(pathname);
  if (id === "delivered") return pathname.startsWith("/delivery");
  return false;
}
