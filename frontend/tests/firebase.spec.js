import { test, expect } from "@playwright/test";

test("Firebase initializes once without a Google request or changing password login", async ({ page }) => {
  const errors = [];
  const googleRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/https:\/\/.*(googleapis\.com|firebaseapp\.com|accounts\.google\.com)\//, (route) => {
    googleRequests.push("unexpected-auth-request");
    return route.abort();
  });
  await page.route((url) => url.pathname.startsWith("/api/"), (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === "/api/auth/me" ? null : [] });
  });
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "Log in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
  const initialized = await page.evaluate(async () => {
    const first = await import("/src/firebase.js");
    const repeated = await import("/src/firebase.js?initialization-check");
    if (first.auth) await first.auth.authStateReady();
    return {
      configured: first.firebaseConfigured,
      hasAuth: first.auth !== null,
      sameInstance: first.auth === repeated.auth,
      noUser: !first.auth || first.auth.currentUser === null,
      googleProvider: first.provider.providerId === "google.com",
      selectAccount: first.provider.customParameters.prompt === "select_account",
      noStoredUser: [localStorage, sessionStorage].every((storage) =>
        !Object.keys(storage).some((key) => key.startsWith("firebase:authUser:"))),
    };
  });
  expect(initialized.hasAuth).toBe(initialized.configured);
  expect(initialized.sameInstance).toBe(true);
  expect(initialized.noUser).toBe(true);
  expect(initialized.googleProvider).toBe(true);
  expect(initialized.selectAccount).toBe(true);
  expect(initialized.noStoredUser).toBe(true);
  expect(googleRequests).toEqual([]);
  expect(errors).toEqual([]);
});
