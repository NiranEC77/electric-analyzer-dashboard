import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Static output: no server, no serverless functions, no required env vars.
// Analysis runs entirely client-side against IndexedDB — see docs/architecture.md.
export default defineConfig({
  integrations: [react()],
  output: "static",
});
