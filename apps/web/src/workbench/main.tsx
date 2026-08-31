/**
 * The workbench. Dev-only, not routed, not shipped. Storybook shows one
 * component at a time; this page puts every primitive on one surface so the
 * things that only exist between components can be checked — press
 * feedback, whether hover feels like one system, the tab order in one pass,
 * the focus ring on every composite, and whether the accent really is spent
 * once. Nothing here is a fixture for the app: every value is obviously
 * synthetic, because a convincing mock is how invented data escapes into a
 * screen.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Workbench } from "./Workbench";
import "../styles.css";

const el = document.getElementById("workbench");
if (el !== null) {
  createRoot(el).render(
    <StrictMode>
      <Workbench />
    </StrictMode>,
  );
}
