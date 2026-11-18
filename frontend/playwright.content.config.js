import { defineConfig } from "@playwright/test";
import quality from "./playwright.phase9.config.js";
export default defineConfig({
  ...quality,
  testDir: "./content",
  outputDir: "./test-results-stage2/browser",
  projects: quality.projects.filter((project) =>
    /^(375|768|1280)-/.test(project.name),
  ),
});
