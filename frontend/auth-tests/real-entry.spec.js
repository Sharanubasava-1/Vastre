import { test, expect } from "@playwright/test";

test("real Google popup entry on localhost (no identity submitted)", async ({ page }, info) => {
  test.setTimeout(90000);
  test.skip(process.env.VASTRE_REAL_GOOGLE_ENTRY !== "1" || info.project.name !== "375-light", "Opt-in network check; never supplies Google credentials.");
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => route.fulfill({ json: new URL(route.request().url()).pathname === "/api/auth/me" ? null : [] }));
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible({ timeout: 45000 });
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForURL((url) => url.hostname === "accounts.google.com", { timeout: 30000 });
  expect(new URL(popup.url()).hostname).toBe("accounts.google.com");
  await popup.close();
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
});
