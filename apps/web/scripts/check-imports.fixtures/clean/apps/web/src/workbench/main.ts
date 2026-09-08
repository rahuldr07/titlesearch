// The dev-only entry MAY import mocks statically; only src/main.tsx may not.
import { worker } from "@titlepipe/mocks/browser";

worker.start();
