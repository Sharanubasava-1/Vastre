import { test, expect } from "@playwright/test";
import { mockAdmin } from "./admin-fixture";

test("Users routes reject anonymous and non-admin visitors before fetching user data", async ({ page }) => {
  for (const role of [null, "user", "support"]) {
    await page.unrouteAll();
    const state = await mockAdmin(page, { role });
    await page.goto("/admin/users");
    if (!role) await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fusers$/);
    else await expect(page.getByRole("heading", { name: "Access denied." })).toBeVisible();
    expect(state.usersRequests).toHaveLength(0);
  }
});

test("Users search, filters, pagination, refresh and back work with shareable URLs", async ({ page }) => {
  const users = Array.from({ length: 25 }, (_, i) => ({ id: i + 2, name: `Customer ${i}`, email: `customer-${i}@example.test`, role: i === 24 ? "customer" : "user", disabled: i === 24 ? 1 : 0, auth_provider: i === 24 ? "google" : "password", last_login_at: null }));
  const state = await mockAdmin(page, { users });
  await page.goto("/admin/users");
  await expect(page.getByText("Showing 20 of 25 users", { exact: true })).toBeVisible();
  expect(state.overviewRequests).toBe(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Showing 5 of 25 users", { exact: true })).toBeVisible();
  await page.getByLabel("Role", { exact: true }).selectOption("support");
  await expect(page.getByRole("heading", { name: "No matching users." })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Showing 5 of 25 users", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Showing 5 of 25 users", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText("Showing 20 of 25 users", { exact: true })).toBeVisible();
  await page.getByLabel("Search users", { exact: true }).fill("customer-24");
  await page.getByLabel("Role", { exact: true }).selectOption("customer");
  await page.getByLabel("Status", { exact: true }).selectOption("disabled");
  await page.getByLabel("Provider", { exact: true }).selectOption("google");
  await expect(page.getByText("Showing 1 of 1 users", { exact: true })).toBeVisible();
  expect(page.url()).toContain("search=customer-24");
  expect(page.url()).not.toContain("page=2");
  await expect(page.locator(".admin-users-table")).toContainText("Google");
  await page.getByLabel("Search users", { exact: true }).fill("nobody-matches");
  await expect(page.getByRole("heading", { name: "No matching users." })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByText("Showing 20 of 25 users", { exact: true })).toBeVisible();
});

test("Changes need confirmation, support Cancel and Escape, and send PATCH with CSRF", async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto("/admin/users");
  const role = page.getByRole("combobox", { name: "Role for customer@example.test", exact: true });
  await expect(role).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Role for admin@example.test", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Disable admin@example.test", exact: true })).toBeDisabled();
  await role.selectOption("support");
  const dialog = page.getByRole("dialog", { name: "Confirm account change", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await expect(dialog).toContainText("Change role from Customer to Support?");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.userChanges).toHaveLength(0);
  await expect(role).toHaveValue("user");
  await role.selectOption("support");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(state.userChanges).toHaveLength(0);
  await role.selectOption("support");
  await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(role).toHaveValue("support");
  expect(state.userChanges[0]).toEqual({ id: 2, data: { role: "support" }, method: "PATCH", csrf: "vastre" });
  await page.getByRole("button", { name: "Disable customer@example.test", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable customer@example.test", exact: true })).toBeVisible();
});

test("Users has independent skeleton, retry, empty and save-error states", async ({ page }) => {
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  const state = await mockAdmin(page, { userFailures: 1, usersHold: hold, userUpdateFailure: true });
  await page.goto("/admin/users");
  await expect(page.getByRole("status", { name: "Loading users" })).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Showing 4 of 4 users", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disable customer@example.test", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm account change" });
  await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("This account changed");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  state.users = [];
  await page.reload();
  await expect(page.getByRole("heading", { name: "No users yet." })).toBeVisible();
  expect(state.overviewRequests).toBe(0);
});

test("a change that removes the last filtered row returns pagination to an existing page", async ({ page }) => {
  const users = Array.from({ length: 21 }, (_, i) => ({ id: i + 2, name: `Customer ${i}`, email: `customer-${i}@example.test`, role: "user", disabled: false, auth_provider: "password" }));
  await mockAdmin(page, { users });
  await page.goto("/admin/users?status=active&page=2");
  await expect(page.getByText("Showing 1 of 21 users", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disable customer-20@example.test", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm account change" }).getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByText("Showing 20 of 20 users", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
});
