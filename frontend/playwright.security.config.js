import { defineConfig } from "@playwright/test";
import smoke from "./playwright.smoke.config.js";

export default defineConfig({
  ...smoke,
  testDir: "./security",
  outputDir: "./test-results-security",
  timeout: 120000,
  webServer: {
    ...smoke.webServer,
    env: {
      ...smoke.webServer.env,
      CSP_MODE: process.env.CSP_MODE || "enforce",
      // Compatibility tests create a fresh account per viewport; limit behavior is
      // tested separately against the real defaults in backend/test_hardening.py.
      REGISTER_RATE_PER_HOUR: "100",
    },
  },
  projects: [375, 768, 1280].flatMap((width) => ["light", "dark"].map((colorScheme) => ({
    name: `${width}-${colorScheme}`,
    use: { viewport: { width, height: 900 }, colorScheme },
  }))),
});
