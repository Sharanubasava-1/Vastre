import { defineConfig } from "@playwright/test";
import security from "./playwright.security.config.js";
const sizes = [
  [320, 900],
  [375, 900],
  [768, 900],
  [1280, 900],
  [844, 390],
  [1920, 1080],
];
export default defineConfig({
  ...security,
  testDir: "./phase9",
  outputDir: "./test-results-phase9/browser",
  timeout: 180000,
  webServer: {
    ...security.webServer,
    env: {
      ...security.webServer.env,
      CSP_MODE: "enforce",
      VASTRE_ADMIN_SMOKE_FIXTURE: "1",
      LOGIN_RATE_PER_MIN: "100",
    },
  },
  projects: sizes.flatMap(([width, height]) =>
    ["light", "dark"].map((colorScheme) => ({
      name: `${width}-${colorScheme}`,
      use: { viewport: { width, height }, colorScheme },
    })),
  ),
});
