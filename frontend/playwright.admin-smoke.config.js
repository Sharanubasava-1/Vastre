import { defineConfig } from "@playwright/test";
import smoke from "./playwright.smoke.config.js";

export default defineConfig({
  ...smoke,
  testDir: "./admin-smoke",
  outputDir: "./test-results-admin-smoke",
  webServer: { ...smoke.webServer, env: { ...smoke.webServer.env, VASTRE_ADMIN_SMOKE_FIXTURE: "1" } },
});
