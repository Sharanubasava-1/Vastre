import { test, expect } from "@playwright/test";

test("real admin Users changes revoke sessions and order ownership stays enforced", async ({ page, playwright }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fusers$/);
  await page.getByLabel("Email", { exact: true }).fill("admin-smoke@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Public-admin-smoke-23");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByText("Showing 3 of 3 users", { exact: true })).toBeVisible();
  const response = await page.request.get("/api/admin/users");
  const data = await response.json();
  const target = data.users.find(person => person.email === "user-smoke@example.test");
  const self = data.users.find(person => person.email === "admin-smoke@example.test");
  expect(data.users.every(person => !("password" in person) && !("salt" in person))).toBe(true);
  const headers = { Origin: "http://127.0.0.1:5182", "X-Requested-With": "vastre" };
  // Reset only this temporary fixture account for the second viewport run.
  expect((await page.request.patch(`/api/admin/users/${target.id}`, { headers, data: { role: "user", disabled: false } })).ok()).toBe(true);
  await page.reload();
  const customer = await playwright.request.newContext({ baseURL: "http://127.0.0.1:5182", extraHTTPHeaders: headers });
  try {
    expect((await customer.post("/api/auth/login", { data: { email: target.email, password: "Public-admin-smoke-23" } })).ok()).toBe(true);
    expect((await customer.get("/api/orders/order_admin_smoke_owned")).status()).toBe(200);
    expect((await page.request.get("/api/orders/order_admin_smoke_owned")).status()).toBe(404);
    expect((await customer.get("/api/admin/users")).status()).toBe(403);
    await page.getByRole("combobox", { name: `Role for ${target.email}`, exact: true }).selectOption("support");
    const dialog = page.getByRole("dialog", { name: "Confirm account change" });
    await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.getByRole("combobox", { name: `Role for ${target.email}`, exact: true })).toHaveValue("support");
    expect((await customer.get("/api/auth/me")).status()).toBe(401);
    expect((await customer.post("/api/auth/login", { data: { email: target.email, password: "Public-admin-smoke-23" } })).ok()).toBe(true);
    expect((await customer.get("/api/auth/me")).ok()).toBe(true);
    await page.getByRole("button", { name: `Disable ${target.email}`, exact: true }).click();
    await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.getByRole("button", { name: `Enable ${target.email}`, exact: true })).toBeVisible();
    expect((await customer.get("/api/auth/me")).status()).toBe(401);
    const denied = await page.request.patch(`/api/admin/users/${self.id}`, { headers, data: { disabled: true } });
    expect(denied.status()).toBe(409);
    await page.getByRole("button", { name: `Enable ${target.email}`, exact: true }).click();
    await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.getByRole("button", { name: `Disable ${target.email}`, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: `Role for ${target.email}`, exact: true })).toHaveValue("support");
    expect(errors).toEqual([]);
  } finally { await customer.dispose(); }
});
