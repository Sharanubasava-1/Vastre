import { test, expect } from "@playwright/test";
import { mockAdmin } from "./admin-fixture";

test("admin browser check at requested width and theme", async ({ page }, testInfo) => {
  await mockAdmin(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const width = page.viewportSize().width;
  for (const [path, section] of [["/admin", "overview"], ["/admin/orders", "orders"], ["/admin/products", "products"], ["/admin/coupons", "coupons"], ["/admin/users", "users"]]) {
    await page.goto(path);
    await expect(page.locator(".admin-skeleton")).toHaveCount(0);
    await expect(page.locator("html")).toHaveCSS("color-scheme", testInfo.project.use.colorScheme);
    await expect(page.locator(".whatsapp-float")).toHaveCount(0);
    await expect(page.locator(".admin-nav [aria-current=page]")).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (section === "orders") {
      await page.locator(".admin-order-row button").first().click();
      await expect(page.locator(".admin-address").first()).toContainText("560001");
      await expect(page.locator(".admin-mobile-label").first())[width <= 600 ? "toBeVisible" : "toBeHidden"]();
    }
    if (section === "products") {
      const region = page.getByRole("region", { name: /Product catalogue/ });
      await region.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
      await expect(page.getByRole("link", { name: /View Linen Sun Shirt/ })).toBeInViewport();
      await region.evaluate((element) => { element.scrollLeft = 0; });
    }
    if (section === "users") {
      await expect(page.getByRole("button", { name: "Disable customer@example.test", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Disable customer@example.test", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Confirm account change" });
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await dialog.screenshot({ path: testInfo.outputPath("user-confirmation.png"), animations: "disabled" });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo({ top: 0, behavior: "instant" }); });
    if (section === "users") await page.screenshot({ path: testInfo.outputPath(`${section}.png`), animations: "disabled", fullPage: true });
    else await page.locator(".admin-page").screenshot({ path: testInfo.outputPath(`${section}.png`), animations: "disabled" });
    const nav = page.getByRole("navigation", { name: "Admin sections" });
    await nav.getByRole("link", { name: "Coupons", exact: true }).focus();
    await expect(nav.getByRole("link", { name: "Coupons", exact: true })).toBeFocused();
    if (width < 1024) await expect(nav).toHaveCSS("overflow-x", "auto");
    else await expect(nav).toHaveCSS("position", "sticky");
  }
  expect(errors).toEqual([]);
});
