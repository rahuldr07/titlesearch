import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  /*
   * `@/` mirrors tsconfig.app.json's path alias. It exists for the shadcn
   * registry, whose files import `@/lib/utils` and cannot be told to emit
   * relative paths. App code keeps writing relative imports, so the import
   * style itself says whether a file is vendored or ours.
   */
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5174 },
  preview: { port: 4274 },
});
