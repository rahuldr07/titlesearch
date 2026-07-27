import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

/**
 * Entry point. Deliberately bare.
 *
 * BRIEF §5 builds bottom-up: tokens → primitives → composites → screens. The
 * router, the Query client and the MSW worker mount here in Phase 5, once there
 * are screens to route to. Wiring them earlier would invite building a screen
 * before its components exist, which §3 rule 3 names as the direct cause of
 * duplicated components.
 */
const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <main className="p-8">
      <h1 className="text-3xl font-bold">TitlePipe</h1>
      <p className="mt-2 text-ink-secondary">
        web-v2 scaffold. No screens yet — see apps/web-v2/BRIEF.md §5.
      </p>
    </main>
  </StrictMode>,
);
