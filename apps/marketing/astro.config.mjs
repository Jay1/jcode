import { defineConfig } from "astro/config";

export default defineConfig({
  build: {
    inlineStylesheets: "always",
  },
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
