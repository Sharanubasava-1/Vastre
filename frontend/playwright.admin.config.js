import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testMatch: "admin.visual.spec.js",
  testIgnore: [],
  outputDir: "./test-results-admin",
  projects: [375, 768, 1280].flatMap((width) => ["light", "dark"].map((colorScheme) => ({
    name: `${width}-${colorScheme}`,
    use: { viewport: { width, height: 900 }, colorScheme },
  }))),
});
