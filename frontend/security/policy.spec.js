import { test, expect } from "@playwright/test";
import { mockAdmin } from "../tests/admin-fixture";

const mode = process.env.CSP_MODE || "enforce";
const header = mode === "enforce" ? "content-security-policy" : "content-security-policy-report-only";

test("all pages under the deployed CSP, including unverified account banner", async ({ page }, info) => {
  const violations = [], errors = [];
  await page.addInitScript(() => {
    window.__policyViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.__policyViolations.push({
      directive: event.effectiveDirective, blocked: event.blockedURI, disposition: event.disposition,
    }));
  });
  page.on("console", message => { if (/content security policy|violates.*directive/i.test(message.text())) violations.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  const email = `policy-${info.project.name}-${Date.now()}@example.test`;
  const registered = await page.request.post("/api/auth/register", {
    data: { email, password: "Policy-fixture-password-23", name: "Policy customer" },
    headers: { Origin: "http://127.0.0.1:5182", "X-Requested-With": "vastre" },
  });
  expect(registered.ok()).toBe(true);
  for (const path of ["/", "/shop", "/shop/Shirts", "/products/linen-sun-shirt", "/cart", "/coupons", "/login", "/admin/login", "/account", "/account?tab=profile", "/account?tab=security", "/wishlist", "/verify-email", "/missing-page", "/admin", "/admin/orders", "/admin/products", "/admin/coupons"]) {
    const response = await page.goto(path);
    expect(response.headers()[header]).toContain("script-src 'self'");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("color-scheme", info.project.use.colorScheme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => window.__policyViolations)).toEqual([]);
    if (path === "/account") {
      await expect(page.getByRole("button", { name: "Resend verification email" })).toBeVisible();
      await page.screenshot({ path: info.outputPath("verification-banner.png"), animations: "disabled", fullPage: true });
    }
  }
  // Exercise the actual admin pages too, with the existing read-only data fixture.
  await mockAdmin(page);
  for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/coupons", "/admin/users"]) {
    await page.goto(path);
    await expect(page.locator(".admin-skeleton")).toHaveCount(0);
    expect(await page.evaluate(() => window.__policyViolations)).toEqual([]);
  }
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("external SDK, fonts, images and Google popup domain compatibility", async ({ page }, info) => {
  test.skip(info.project.name !== "1280-light", "External-resource probe once per policy mode");
  await page.goto("/");
  await page.evaluate(() => {
    window.__policyViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.__policyViolations.push(event.effectiveDirective + ':' + event.blockedURI));
  });
  // Live public dependencies: no credential or payment is sent.
  await page.addScriptTag({ url: "https://checkout.razorpay.com/v1/checkout.js" });
  expect(await page.evaluate(() => typeof window.Razorpay)).toBe("function");
  await page.addScriptTag({ url: "https://apis.google.com/js/api.js" });
  await page.evaluate(async () => {
    const css = document.createElement("link"); css.rel = "stylesheet";
    css.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap";
    await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    await document.fonts.load('16px "Roboto"');
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?w=100&q=50"; });
  });
  // Deterministic auth-domain transport probes; these do not impersonate a Google login.
  await page.context().route("https://**/*csp-probe*", route => route.fulfill({
    contentType: route.request().resourceType() === "script" ? "application/javascript" : "text/html",
    headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:5182" },
    body: route.request().resourceType() === "script" ? "window.__firebaseDomainLoaded=true" : "<title>Authentication domain probe</title><p>Domain transport test</p>",
  }));
  await page.addScriptTag({ url: "https://policy-project.firebaseapp.com/csp-probe.js" });
  await page.evaluate(async () => {
    for (const url of ["https://identitytoolkit.googleapis.com/csp-probe", "https://securetoken.googleapis.com/csp-probe", "https://api.razorpay.com/csp-probe"]) {
      if (!(await fetch(url)).ok) throw Error("Allowed domain transport failed");
    }
    for (const url of ["https://policy-project.firebaseapp.com/__/auth/iframe?csp-probe=1", "https://accounts.google.com/csp-probe", "https://api.razorpay.com/csp-probe"]) {
      const frame = document.createElement("iframe"); frame.src = url;
      await new Promise(resolve => { frame.onload = resolve; document.body.append(frame); });
    }
  });
  const popupEvent = page.waitForEvent("popup");
  await page.evaluate(() => window.open("https://accounts.google.com/csp-probe-popup", "auth-probe", "width=500,height=600"));
  const popup = await popupEvent;
  await expect(popup).toHaveTitle("Authentication domain probe");
  await popup.close();
  expect(await page.evaluate(() => window.__policyViolations)).toEqual([]);
  // Negative control: Report-Only reports this, enforcement actually blocks it.
  let blocked = false;
  try { await page.addScriptTag({ url: "https://blocked.example/csp-probe.js" }); }
  catch { blocked = true; }
  expect(blocked).toBe(mode === "enforce");
  await expect.poll(() => page.evaluate(() => window.__policyViolations.length)).toBeGreaterThan(0);
});
