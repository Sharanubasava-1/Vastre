import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const original = JSON.parse(
  readFileSync(
    new URL(
      "../../backend/fixtures/original_catalogue_ids.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("Sportswear flows through home, navigation, filters, sitemap, detail and admin", async ({
  page,
  request,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security|refused to/i.test(message.text())
    )
      errors.push(message.text());
  });
  await page.goto("/");
  const tile = page.locator(".home-category").filter({
    has: page.getByRole("heading", { name: "Sportswear", exact: true }),
  });
  await expect(tile).toContainText("10 products");
  await tile.click();
  await expect(page).toHaveURL(/\/shop\/Sportswear$/);
  await expect(page.locator(".result-count")).toHaveText("10 results");
  await expect(page.locator(".product-card")).toHaveCount(10);
  if (page.viewportSize().width < 1024) {
    await page.getByRole("button", { name: /Open menu/ }).click();
    await expect(
      page
        .locator(".mobile-nav")
        .getByRole("link", { name: "Sportswear", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Filter & Sort/ }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Filter & Sort", exact: true })
        .getByRole("checkbox", { name: /Sportswear/ }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
  } else
    await expect(
      page
        .locator(".collection-nav")
        .getByRole("link", { name: "Sportswear", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  expect(await (await request.get("/sitemap.xml")).text()).toContain(
    "/shop/Sportswear",
  );
  await page.goto("/products/performance-tee");
  await expect(page.locator("h1")).toHaveText("Performance Training Tee");
  await expect(page.locator(".pdp-fit")).toContainText("Athletic");
  await expect(page.locator(".pdp-colors")).toContainText(
    "not selected or saved",
  );
  await expect(page.locator(".pdp-colors button")).toHaveCount(0);
  await expect(page.locator(".pdp-rating")).toHaveCount(0);
  await expect(page.locator(".pdp-image-note")).toContainText(
    "Styling reference",
  );
  const image = page.locator(".gallery-open > img");
  await expect(image).toHaveAttribute("fetchpriority", "high");
  await expect(image).not.toHaveAttribute("loading", "lazy");
  await expect(image).toHaveAttribute("srcset", /160w.*600w.*1200w/);
  await image.evaluate((img) => img.decode());
  await expect(page.locator(".pdp-thumbnails button")).toHaveCount(3);
  await expect(
    page.locator(".pdp-recommendations").first().locator(".product-card"),
  ).toHaveCount(4);
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
  expect(violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath("sportswear.png") });
  const login = await page.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:5182", "X-Requested-With": "vastre" },
    data: {
      email: "admin-smoke@example.test",
      password: "Public-admin-smoke-23",
    },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/admin/products");
  await page.getByLabel("Category", { exact: true }).selectOption("Sportswear");
  await expect(page.locator(".admin-results")).toContainText(
    "Showing 10 of 60",
  );
  await expect(page.locator(".admin-products-table tbody tr")).toHaveCount(10);
  await expect(
    page.getByRole("link", { name: /^View .+ in store$/ }),
  ).toHaveCount(10);
  expect(errors).toEqual([]);
});

test("old unscoped saved cart migrates with existing ids and current catalogue prices", async ({
  page,
}) => {
  const old = [0, 5, 10, 20, 30, 40].map((index) => original[index]);
  await page.addInitScript((items) => {
    if (!sessionStorage.getItem("seeded-old-cart")) {
      localStorage.setItem(
        "vastre-cart",
        JSON.stringify(
          items.map((p) => ({ product_id: p.id, size: "M", quantity: 1 })),
        ),
      );
      sessionStorage.setItem("seeded-old-cart", "1");
    }
  }, old);
  await page.goto("/cart");
  await expect(page.locator(".cart-item")).toHaveCount(old.length);
  for (const item of old)
    await expect(
      page.locator(".cart-item-name").filter({ hasText: item.name }),
    ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("vastre-cart")))
    .toBe(null);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vastre-cart:guest")),
  );
  expect(saved.map((item) => item.product_id)).toEqual(
    old.map((item) => item.id),
  );
  await page.reload();
  await expect(page.locator(".cart-item")).toHaveCount(old.length);
});
