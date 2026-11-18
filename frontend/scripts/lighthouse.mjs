import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = fileURLToPath(new URL("../../", import.meta.url));
const base = "http://127.0.0.1:5182";
const out = new URL("../test-results-phase9/lighthouse/", import.meta.url);
await mkdir(out, { recursive: true });
const occupied = await new Promise((resolve) => {
  const socket = net.connect(5182, "127.0.0.1");
  socket.on("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.on("error", () => resolve(false));
});
if (occupied)
  throw Error(
    "Port 5182 is occupied. Stop the isolated preview first; never audit a development/customer database.",
  );
const server = spawn(
  fileURLToPath(new URL("../../.venv/Scripts/python.exe", import.meta.url)),
  ["-m", "backend.smoke_server"],
  {
    cwd: root,
    env: {
      ...process.env,
      VASTRE_SMOKE_FIXTURE: "1",
      VASTRE_ADMIN_SMOKE_FIXTURE: "1",
      CSP_MODE: "enforce",
    },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  },
);
// Fixture console emails may contain disposable verification links. Never echo
// server output into a report. Login uses only the public fixture accounts.
server.stderr.resume();
let chrome, browser;
const results = [];
// Diagnostics must never retain provider query parameters (including public
// Firebase configuration), cookies or authorization headers.
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key === "url" && typeof item === "string" && /^https?:/.test(item)) {
        const url = new URL(item);
        return [key, url.origin + url.pathname];
      }
      return [key, redact(item)];
    }),
  );
}
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw Error("Disposable audit server failed to start.");
    try {
      if ((await fetch(base + "/api/products")).ok) break;
    } catch {}
    if (attempt === 99)
      throw Error("Disposable audit server did not become ready.");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  chrome = await launch({
    chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    chromeFlags: ["--headless=new", "--no-first-run"],
    logLevel: "silent",
  });
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  const context = browser.contexts()[0];
  const control = await context.newPage();
  const cdp = await context.newCDPSession(control);
  const groups = [
    [
      "public",
      [
        "/",
        "/shop",
        "/products/linen-sun-shirt",
        "/cart",
        "/login",
        "/coupons",
        "/wishlist",
        "/admin/login",
        "/access-denied",
        "/verify-email",
      ],
    ],
    [
      "customer",
      [
        "/account",
        ...["profile", "security", "orders", "wishlist", "addresses"].map(
          (tab) => `/account?tab=${tab}`,
        ),
        "/admin",
      ],
    ],
    [
      "admin",
      [
        "/admin",
        "/admin/orders",
        "/admin/products",
        "/admin/coupons",
        "/admin/users",
      ],
    ],
  ];
  const coreOnly = process.argv.includes("--core");
  const contentOnly = process.argv.includes("--content");
  for (const [role, routes] of groups) {
    await context.clearCookies();
    if (role !== "public") {
      const login = await context.request.post(base + "/api/auth/login", {
        headers: { Origin: base, "X-Requested-With": "vastre" },
        data: {
          email:
            role === "admin"
              ? "admin-smoke@example.test"
              : "user-smoke@example.test",
          password: "Public-admin-smoke-23",
        },
      });
      if (!login.ok()) throw Error("Disposable fixture login failed.");
    }
    for (const path of contentOnly
      ? role === "public"
        ? ["/shop", "/products/performance-tee"]
        : []
      : coreOnly
        ? role === "public"
          ? routes.slice(0, 5)
          : []
        : routes) {
      // Keep fixture cookies; clear HTTP cache before every navigation.
      await cdp.send("Network.clearBrowserCache");
      const { lhr } = await lighthouse(base + path, {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        disableStorageReset: true,
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
      });
      const result = {
        role,
        path,
        version: lhr.lighthouseVersion,
        userAgent: lhr.userAgent,
        mode: "mobile / simulated throttling / cold navigation",
        scores: Object.fromEntries(
          Object.entries(lhr.categories).map(([key, value]) => [
            key,
            Math.round(value.score * 100),
          ]),
        ),
        metrics: Object.fromEntries(
          [
            "first-contentful-paint",
            "largest-contentful-paint",
            "total-blocking-time",
            "cumulative-layout-shift",
          ].map((key) => [key, lhr.audits[key]?.numericValue]),
        ),
        failures: Object.values(lhr.audits)
          .filter((audit) => audit.score !== null && audit.score < 1)
          .map((audit) => ({
            id: audit.id,
            title: audit.title,
            score: audit.score,
            displayValue: audit.displayValue,
            description: audit.description,
            items: audit.details?.items
              ?.map((item) => ({
                node: item.node?.selector,
                explanation: item.node?.explanation,
                url: item.url,
                statusCode: item.statusCode,
              }))
              .filter((item) => Object.values(item).some(Boolean)),
          })),
        warnings: lhr.runWarnings,
        diagnostics: Object.fromEntries(
          [
            "lcp-breakdown-insight",
            "lcp-discovery-insight",
            "largest-contentful-paint-element",
            "bootup-time",
            "mainthread-work-breakdown",
            "third-party-summary",
          ].map((key) => [key, lhr.audits[key]?.details]),
        ),
      };
      results.push(redact(result));
      console.log(JSON.stringify({ role, path, scores: result.scores }));
      // Store scores/diagnostics only; no raw network headers, cookies or traces.
      await writeFile(
        new URL("results.json", out),
        JSON.stringify(results, null, 2),
      );
    }
  }
} finally {
  await browser?.close();
  await chrome?.kill();
  if (server.exitCode === null) server.kill();
}
