import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockAdmin, overview } from "./admin-fixture";

const paths = ["/admin", "/admin/orders", "/admin/products", "/admin/coupons"];

test("anonymous visitors go to admin login and retain their destination", async ({ page }) => {
  const state = await mockAdmin(page, { role: null });
  for (const path of paths) {
    await page.goto(path);
    await expect(page).toHaveURL(`/admin/login?next=${encodeURIComponent(path)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin login");
  }
  expect(state.overviewRequests).toBe(0);
  await page.goto("/admin/orders");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.locator(".admin-order-row")).toHaveCount(6);
});

test("normal users see access denied without fetching admin data", async ({ page }) => {
  const state = await mockAdmin(page, { role: "user" });
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Access denied.");
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
  }
  expect(state.overviewRequests).toBe(0);
});

test("admin sections are linkable, refreshable and support browser history", async ({ page }) => {
  await mockAdmin(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [index, path] of paths.entries()) {
    await page.goto(path);
    await expect(page.locator(".admin-skeleton")).toHaveCount(0);
    await expect(page.locator(".admin-nav [aria-current=page]")).toContainText(["Overview", "Orders", "Products", "Coupons"][index]);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(["overview", "orders", "products", "coupons"][index]);
    await expect(page.locator(".admin-skeleton")).toHaveCount(0);
    await expect(page).toHaveTitle(/Admin/);
  }
  await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/coupons$/);
  expect(errors).toEqual([]);
});

test("overview uses rupees, paid revenue, five latest orders and meaningful empty states", async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto("/admin");
  const stats = page.locator(".admin-stats");
  await expect(stats.locator("div").filter({ has: page.locator("dt", { hasText: /^Paid revenue$/ }) }).locator("dd")).toHaveText("₹8,392");
  await expect(stats).toContainText("₹2,797.33");
  await expect(stats).toContainText("Paid orders only");
  await expect(page.locator(".admin-order-row")).toHaveCount(5);
  await expect(page.locator(".admin-order-row").first()).toContainText("order_106");
  await expect(page.locator(".admin-chart")).toContainText("Order dates are not supplied");
  state.data = {};
  await page.reload();
  await expect(page.locator(".admin-content")).toContainText("No orders yet");
  await expect(page.locator(".admin-stats dd").first()).toHaveText("0");
});

test("orders search, status, sort, keyboard expansion and filtered CSV export", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/orders");
  const rows = page.locator(".admin-order-row");
  await expect(rows).toHaveCount(6);
  const disclosure = rows.first().getByRole("button");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(rows.first().locator(".admin-order-details")).toContainText("Linen Sun Shirt");
  await expect(rows.first().locator(".admin-order-details")).toContainText("Size M · Qty 3");
  await expect(rows.first().locator(".admin-order-details")).toContainText("560001");
  await expect(rows.first().locator(".admin-order-details")).toContainText("VASTRE10");
  await page.getByLabel("Status", { exact: true }).selectOption("pending");
  await expect(rows).toHaveCount(3);
  await page.getByLabel("Sort orders").selectOption("amount-asc");
  await expect(rows.first()).toContainText("order_102");
  await page.getByLabel("Search orders").fill("pending@example");
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole("button").click();
  await expect(rows.first().locator(".admin-order-details")).toHaveText("Order details are unavailable.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('"1590.00"');
  expect(csv).toContain("pending@example.test");
  expect(csv).not.toContain("order_106");
  await page.getByLabel("Search orders").fill("no-such-order");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(6);
});

test("products are read-only, filterable, and link to their storefront page", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/products");
  await page.getByLabel("Category", { exact: true }).selectOption("Jeans");
  const table = page.getByRole("table", { name: "Store products" });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("₹2,490");
  await expect(table.getByRole("link", { name: /View Indigo/ })).toHaveAttribute("href", "/products/jeans");
  await page.getByLabel("Search products").fill("no match");
  await expect(page.getByRole("heading", { name: "No matching products." })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(3);
});

test("every admin section provides skeleton, recoverable errors and empty states", async ({ page }) => {
  let release;
  const state = await mockAdmin(page, { hold: new Promise((resolve) => { release = resolve; }) });
  await page.goto("/admin/orders");
  await expect(page.getByRole("status", { name: "Loading orders" })).toBeVisible();
  release();
  state.hold = null;
  await expect(page.locator(".admin-order-row")).toHaveCount(6);
  const emptyTitles = ["No orders yet.", "No orders yet.", "No products yet.", "No offers right now."];
  for (const [index, path] of paths.entries()) {
    state.failures = 1;
    await page.goto(path);
    await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".admin-content")).toContainText(index === 0 ? "Paid revenue" : index === 1 ? "Showing 6" : index === 2 ? "Showing 3" : "VASTRE10");
    state.data = { orders: null, products: [], coupons: [], customers: null };
    await page.reload();
    await expect(page.getByRole("heading", { name: emptyTitles[index], exact: true })).toBeVisible();
    state.data = overview;
  }
});

test("malformed optional fields never crash any admin section or render JSON as markup", async ({ page }) => {
  await mockAdmin(page, { data: { customers: {}, orders: [null, { id: {}, amount: "bad", status: {}, details: '{"address":"<img src=x onerror=alert(1)>","items":[null,{}],"coupon":{}}' }], products: [null, {}], coupons: [null, { code: {}, percent: "bad", minimum: {} }] } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator(".admin-skeleton")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Something went wrong");
  }
  await page.goto("/admin/orders");
  await page.locator(".admin-order-row button").click();
  await expect(page.locator(".admin-address")).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator(".admin-address img")).toHaveCount(0);
  expect(errors).toEqual([]);
});
