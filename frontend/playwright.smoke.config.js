import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./smoke",
  workers: 1,
  timeout: 60000,
  outputDir: "./test-results-smoke",
  use: { baseURL: "http://127.0.0.1:5182", channel: "chrome" },
  webServer: {
    command: `"${fileURLToPath(new URL("../.venv/Scripts/python.exe", import.meta.url))}" -m backend.smoke_server`,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: "http://127.0.0.1:5182/api/products",
    reuseExistingServer: false,
    env: { VASTRE_SMOKE_FIXTURE: "1" },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
