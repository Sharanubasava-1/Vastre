import { test, expect } from "@playwright/test";

async function fixture(page, verified = false) {
  const user = { id: 7, name: "Customer", email: "customer@example.test", role: "user", auth_provider: "password", email_verified: verified ? 1 : 0 };
  await page.route(url => url.pathname.startsWith("/api/"), route => route.fulfill({
    json: new URL(route.request().url()).pathname === "/api/auth/me" ? user : [],
  }));
  return user;
}

test("unverified account can resend email and verified account hides the banner", async ({ page }) => {
  const user = await fixture(page);
  let calls = 0;
  await page.route("**/api/auth/send-verification", async route => {
    calls++;
    expect(route.request().headers()["x-requested-with"]).toBe("vastre");
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/account");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.locator(".toast")).toContainText("Verification email requested");
  expect(calls).toBe(1);
  user.email_verified = 1;
  await page.reload();
  await expect(page.locator(".account-heading")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend verification email" })).toHaveCount(0);
});

test("verification link submits its fragment token and handles an expired link", async ({ page }) => {
  await fixture(page);
  let attempts = 0;
  await page.route("**/api/auth/verify-email", async route => {
    attempts++;
    expect(route.request().postDataJSON()).toEqual({ token: "public-verification-fixture" });
    expect(route.request().headers()["x-requested-with"]).toBe("vastre");
    await route.fulfill(attempts === 1
      ? { status: 400, json: { detail: "This verification link is invalid or expired. Request another email." } }
      : { json: { ok: true } });
  });
  await page.goto("/verify-email#token=public-verification-fixture");
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("invalid or expired");
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your email is verified" })).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email$/);
});
