import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./auth-tests",
  workers: 1,
  outputDir: "./test-results-auth",
  use: { baseURL: "http://localhost:5173", channel: "chrome" },
  webServer: { command: "node node_modules/vite/bin/vite.js --host localhost --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: !process.env.CI },
  projects: [375, 768, 1280].flatMap((width) => ["light", "dark"].map((colorScheme) => ({ name: `${width}-${colorScheme}`, use: { viewport: { width, height: 900 }, colorScheme } }))),
});
