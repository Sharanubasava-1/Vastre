import { test, expect } from "@playwright/test";
const cats = ["Shirts", "T-shirts", "Trousers", "Jeans", "Hoodies"],
  tags = ["New in", "Bestseller", "Restocked", "Everyday essential"];
const photos = [
  "photo-1603252110481-7ba873bf42ab",
  "photo-1521572163474-6864f9cf17ab",
  "photo-1624378439575-d8705ad7ae80",
  "photo-1542272604-787c3835535d",
  "photo-1556821840-3a63f95609a7",
];
const products = Array.from({ length: 50 }, (_, i) => ({
  id: `item-${i}`,
  name:
    i === 0
      ? "Alpha Linen Shirt"
      : i === 1
        ? "Zulu Cotton Tee"
        : `Everyday ${String(i).padStart(2, "0")} ${cats[i % 5]}`,
  category: cats[i % 5],
  price: 1000 + i * 100,
  compare_at: 1600 + i * 100,
  tag: tags[i % 4],
  sizes: i % 3 === 0 ? ["S", "M"] : ["L", "XL"],
  image: `/images/mens/${photos[i % 5]}.jpg`,
  images: [
    `/images/mens/${photos[i % 5]}.jpg`,
    ...(i === 0 ? ["/images/mens/photo-1607345366928-199ea26cfe3e.jpg"] : []),
  ],
  alt: `Men’s ${cats[i % 5]}`,
  description: "An everyday essential.",
}));
test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        json:
          path === "/api/products"
            ? products
            : path === "/api/coupons"
              ? []
              : null,
      });
    },
  );
});
const mobile = (page) => page.viewportSize().width < 1024;
async function controls(page) {
  if (mobile(page)) {
    await page.getByRole("button", { name: /^Filter & Sort/ }).click();
    return page.getByRole("dialog", { name: "Filter & Sort", exact: true });
  }
  return page.getByRole("complementary", { name: "Product filters" });
}
async function apply(page) {
  if (mobile(page))
    await page
      .getByRole("dialog", { name: "Filter & Sort", exact: true })
      .getByRole("button", { name: "Apply", exact: true })
      .click();
}
async function sort(page, value) {
  if (mobile(page)) {
    const panel = await controls(page);
    await panel.getByRole("combobox", { name: "Sort by" }).selectOption(value);
    await apply(page);
  } else
    await page
      .locator(".desktop-sort")
      .getByRole("combobox", { name: "Sort by" })
      .selectOption(value);
}
test("listing shows 12 of 50, sorts, loads more, and restores URL history", async ({
  page,
}, info) => {
  await page.goto("/shop");
  await expect(page.locator(".result-count")).toHaveText("50 results");
  await expect(page.locator(".listing-grid .product-card")).toHaveCount(12);
  await expect(page.locator(".load-more")).toContainText("Showing 12 of 50");
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.locator(".listing-grid .product-card")).toHaveCount(24);
  await expect(page).toHaveURL(/limit=24/);
  await page.reload();
  await expect(page.locator(".listing-grid .product-card")).toHaveCount(24);
  await sort(page, "price-desc");
  await expect(page.locator(".product-name").first()).toHaveText(
    products[49].name,
  );
  await expect(page.locator(".listing-grid .product-card")).toHaveCount(12);
  await expect(page).toHaveURL(/sort=price-desc/);
  await sort(page, "name-asc");
  await expect(page.locator(".product-name").first()).toHaveText(
    "Alpha Linen Shirt",
  );
  await expect(page).toHaveURL(/sort=name-asc/);
  await page.goBack();
  await expect(page).toHaveURL(/sort=price-desc/);
  await expect(page.locator(".product-name").first()).toHaveText(
    products[49].name,
  );
  await sort(page, "new-in");
  await expect(page.locator(".listing-grid .product-tag")).toHaveText(
    Array(12).fill("New in"),
  );
  await page.goto("/shop");
  await expect(page.locator(".listing-grid .product-card")).toHaveCount(12);
  await page
    .locator(".listing-grid img")
    .evaluateAll((images) =>
      images.forEach((image) => (image.loading = "eager")),
    );
  await expect
    .poll(() =>
      page
        .locator(".listing-grid .product-primary")
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("listing-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: info.outputPath("listing-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
});
test("category, price, size and tag filters combine and have removable URL chips", async ({
  page,
}, info) => {
  await page.goto("/shop");
  let panel = await controls(page);
  await panel.getByRole("checkbox", { name: /Shirts/ }).check();
  if (mobile(page)) {
    await expect(page).toHaveURL(/\/shop$/);
    await page.screenshot({
      path: info.outputPath("filters-sheet.png"),
      animations: "disabled",
    });
  }
  await apply(page);
  await expect(page.locator(".result-count")).toHaveText("10 results");
  await expect(page).toHaveURL(/category=Shirts/);
  panel = await controls(page);
  await panel.getByLabel("Minimum", { exact: true }).fill("1500");
  await panel.getByLabel("Maximum", { exact: true }).fill("4000");
  await panel.getByRole("button", { name: "M", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Restocked", exact: true }).check();
  await apply(page);
  await expect(page.locator(".result-count")).toHaveText("1 result");
  await expect(page.locator(".product-name")).toHaveText(products[30].name);
  await expect(
    page.getByRole("button", { name: "Remove Size M", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".result-count")).toHaveText("1 result");
  await page
    .getByRole("button", { name: "Remove Size M", exact: true })
    .click();
  await expect(page.locator(".result-count")).toHaveText("2 results");
  await expect(page).not.toHaveURL(/size=M/);
  await page.goBack();
  await expect(page).toHaveURL(/size=M/);
  await expect(page.locator(".result-count")).toHaveText("1 result");
  await page
    .getByRole("button", { name: "Remove Shirts", exact: true })
    .click();
  await expect(page).not.toHaveURL(/category=/);
});
test("category routes, breadcrumbs, empty state and clear filters work", async ({
  page,
}) => {
  await page.goto("/shop/Jeans");
  await expect(
    page.getByRole("heading", { name: "Jeans.", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
    "HomeShopJeans",
  );
  await expect(page.locator(".result-count")).toHaveText("10 results");
  await page.goto("/shop/Jeans?min=999999");
  await expect(
    page.getByRole("heading", { name: "No pieces found." }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "An empty clothing rack" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator(".result-count")).toHaveText("50 results");
  await page.goto("/shop?q=linen");
  await expect(page.locator(".result-count")).toHaveText("1 result");
  await page
    .getByRole("button", { name: "Remove Search: linen", exact: true })
    .click();
  await expect(page.locator(".result-count")).toHaveText("50 results");
});
test("desktop density and mobile draft cancellation, clearing and price validation", async ({
  page,
}) => {
  await page.goto("/shop");
  if (!mobile(page)) {
    for (const columns of [2, 4, 3]) {
      await page
        .getByRole("button", { name: `${columns} columns`, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: `${columns} columns`, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const count = await page
        .locator(".listing-grid > .product-grid")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        );
      expect(count).toBe(columns);
    }
    await page.reload();
    await expect(
      page.getByRole("button", { name: "3 columns" }),
    ).toHaveAttribute("aria-pressed", "true");
  } else {
    let panel = await controls(page);
    await panel.getByRole("checkbox", { name: /Hoodies/ }).check();
    await page.keyboard.press("Escape");
    await expect(page.locator(".result-count")).toHaveText("50 results");
    panel = await controls(page);
    await expect(
      panel.getByRole("checkbox", { name: /Hoodies/ }),
    ).not.toBeChecked();
    await panel.getByLabel("Minimum", { exact: true }).fill("5000");
    await panel.getByLabel("Maximum", { exact: true }).fill("1000");
    await expect(
      panel.getByRole("button", { name: "Apply", exact: true }),
    ).toBeDisabled();
    await expect(
      panel.getByText("Minimum price must not exceed maximum price."),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Clear all", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "Apply", exact: true }),
    ).toBeEnabled();
    await apply(page);
    await expect(page.locator(".result-count")).toHaveText("50 results");
  }
});
test("search shortcuts, debounce, keyboard results, category search and Escape", async ({
  page,
}, info) => {
  await page.goto("/shop");
  await expect(page.locator(".result-count")).toHaveText("50 results");
  await page.keyboard.press("/");
  let search = page.getByRole("dialog", { name: "Search", exact: true }),
    input = search.getByRole("combobox", { name: "Search the collection" });
  await expect(input).toBeFocused();
  await input.fill("linen");
  await expect(search.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expect(search.getByRole("option").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\/item-0$/);
  await expect(search).not.toBeVisible();
  await page.keyboard.press("Control+k");
  search = page.getByRole("dialog", { name: "Search", exact: true });
  input = search.getByRole("combobox");
  await input.fill("hoodies");
  await expect(search.getByRole("option")).toHaveCount(8);
  await expect(
    search.getByRole("link", { name: "View all 10 results" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("search-results.png"),
    animations: "disabled",
  });
  await search.getByRole("link", { name: "View all 10 results" }).click();
  await expect(page).toHaveURL(/\/shop\?q=hoodies$/);
  await expect(page.locator(".result-count")).toHaveText("10 results");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await search.getByRole("combobox").fill("not-in-the-catalogue");
  await expect(search).toContainText("No pieces found.");
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeFocused();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("reader");
  await page.keyboard.press("/");
  await expect(
    page.getByRole("dialog", { name: "Search", exact: true }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "reader/",
  );
});
test("cards show correct discount, stable media, hover image, wishlist and size quick-add", async ({
  page,
}, info) => {
  await page.goto("/shop");
  const card = page.locator(".product-card").first();
  await expect(card.getByLabel("38% off")).toHaveText("−38%");
  await expect(card.locator(".product-primary")).toHaveAttribute(
    "loading",
    "lazy",
  );
  await expect(card.locator(".product-primary")).toHaveAttribute(
    "width",
    "800",
  );
  await expect(card.locator(".product-primary")).toHaveAttribute(
    "height",
    "1000",
  );
  await expect(card.locator(".product-image")).toHaveCSS(
    "aspect-ratio",
    "4 / 5",
  );
  if (!mobile(page)) {
    await card.hover();
    await expect(card.locator(".product-secondary")).toHaveCSS("opacity", "1");
  }
  await card
    .getByRole("button", { name: "Save Alpha Linen Shirt to wishlist" })
    .click();
  await expect(
    page.getByRole("button", { name: "Wishlist (1)", exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Quick add Alpha Linen Shirt", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Choose your size",
    exact: true,
  });
  await expect(picker).toBeVisible();
  await page.screenshot({
    path: info.outputPath("quick-add.png"),
    animations: "disabled",
  });
  await picker
    .getByRole("button", { name: "Add Alpha Linen Shirt, size M", exact: true })
    .click();
  await expect(picker).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bag (1)", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("vastre-cart:guest"))),
  ).toEqual([{ product_id: "item-0", size: "M", quantity: 1 }]);
});
test("loading grid and empty catalogue stay usable", async ({ page }) => {
  let ready;
  const pending = new Promise((resolve) => (ready = resolve));
  await page.route("**/api/products", async (route) => {
    await pending;
    await route.fulfill({ json: [] });
  });
  await page.goto("/shop");
  await expect(page.locator(".listing-grid")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(
    page.locator(".listing-skeleton-grid .home-skeleton"),
  ).toHaveCount(12);
  ready();
  await expect(
    page.getByRole("heading", { name: "No pieces found." }),
  ).toBeVisible();
  await expect(page.locator(".load-more")).toHaveCount(0);
});
