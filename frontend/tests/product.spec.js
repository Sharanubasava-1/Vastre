import { test, expect } from "@playwright/test";
import { imageUrl } from "../src/utils/images.js";
test("optional product facts render without becoming an order colour choice", async ({
  page,
}) => {
  await page.route("**/api/products", (route) =>
    route.fulfill({
      json: [
        {
          ...products[0],
          fabric: "Cotton jersey",
          fit: "Relaxed",
          colors: [{ name: "Ink", hex: "#1f2523" }],
          rating: 4.2,
          review_count: 17,
        },
      ],
    }),
  );
  await page.goto("/products/p0");
  await expect(page.locator(".pdp-rating")).toHaveText(
    "Rated 4.2 / 5 (17 reviews)",
  );
  await expect(page.locator(".pdp-fit")).toContainText("Relaxed");
  await expect(page.locator(".pdp-colors")).toContainText("Ink");
  await expect(page.locator(".pdp-colors button")).toHaveCount(0);
  await expect(page.locator(".pdp-colors")).toContainText(
    "not selected or saved",
  );
  await page.getByText("Fabric & care", { exact: true }).click();
  await expect(page.locator(".pdp-accordions")).toContainText("Cotton jersey");
});
const image = "/images/mens/photo-1603252110481-7ba873bf42ab.jpg";
const second = "/images/mens/photo-1602810318383-e386cc2a3ccf.jpg";
const products = Array.from({ length: 7 }, (_, i) => ({
  id: `p${i}`,
  name: `Linen Shirt ${i}`,
  category: i === 6 ? "Jeans" : "Shirts",
  image,
  images: [image, second],
  alt: "Men’s shirt",
  price: 1890,
  compare_at: 2490,
  sizes: ["S", "M", "L", "XL"],
  tag: "New in",
  description: "A relaxed everyday shirt.",
}));
test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) =>
      route.fulfill({
        json:
          new URL(route.request().url()).pathname === "/api/products"
            ? products
            : [],
      }),
  );
});
test("gallery, lightbox keyboard, thumbnails, swipe and next image preload", async ({
  page,
}) => {
  await page.goto("/products/p0");
  await expect(page.locator("link[rel=preload][as=image]")).toHaveAttribute(
    "href",
    imageUrl(image),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) =>
            entry.name.includes("photo-1602810318383-e386cc2a3ccf-1200.webp"),
          ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "View Linen Shirt 0 image 2", exact: true })
    .click();
  await expect(page.locator(".gallery-open > img")).toHaveAttribute(
    "src",
    imageUrl(second),
  );
  await page.locator(".gallery-open").click();
  const modal = page.getByRole("dialog", { name: "Linen Shirt 0 gallery" });
  await expect(modal).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(modal.locator(".lightbox-stage img")).toHaveAttribute(
    "src",
    imageUrl(image, "detail"),
  );
  await modal.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(modal.locator(".lightbox-stage")).toHaveClass(/is-zoomed/);
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(page.locator(".gallery-open")).toBeFocused();
  await page.locator(".gallery-stage").dispatchEvent("touchstart", {
    touches: [{ identifier: 0, clientX: 250, clientY: 100 }],
  });
  await page.locator(".gallery-stage").dispatchEvent("touchend", {
    changedTouches: [{ identifier: 0, clientX: 100, clientY: 105 }],
  });
  await expect(page.locator(".gallery-open > img")).toHaveAttribute(
    "src",
    imageUrl(second),
  );
});
test("explicit size, guide tables, quantity, wishlisting, WhatsApp and add interaction", async ({
  page,
}) => {
  await page.goto("/products/p0");
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText("Select a size");
  await expect(
    page
      .getByRole("group", { name: "Choose your size" })
      .getByRole("button", { name: "S", exact: true }),
  ).toBeFocused();
  await page
    .locator(".pdp-info")
    .getByRole("button", { name: "Size guide", exact: true })
    .click();
  const guide = page.getByRole("dialog", { name: "Size guide", exact: true });
  await expect(guide).toContainText("Illustrative measurements only");
  await expect(
    guide.getByRole("columnheader", { name: "Chest", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("group", { name: "Choose your size" })
    .getByRole("button", { name: "L", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Quantity", exact: true }),
  ).toHaveValue("2");
  await expect(
    page.getByRole("link", { name: "Enquire on WhatsApp" }),
  ).toHaveAttribute("href", /size%20L/);
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to wishlist", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await expect(
    page
      .locator(".pdp-purchase")
      .getByRole("button", { name: "Adding…", exact: true }),
  ).toHaveAttribute("aria-busy", "true");
  await expect(
    page
      .locator(".pdp-purchase")
      .getByRole("button", { name: "Added", exact: true }),
  ).toBeVisible();
  const bag = page.getByRole("dialog", { name: "Your bag", exact: true });
  await expect(bag).toBeVisible();
  await expect(bag.getByRole("spinbutton")).toHaveValue("2");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("vastre-cart:guest")),
    ),
  ).toEqual([{ product_id: "p0", size: "L", quantity: 2 }]);
  await page.getByRole("button", { name: "Close your bag" }).click();
  await page.goto("/products/p6");
  await page
    .locator(".pdp-info")
    .getByRole("button", { name: "Size guide", exact: true })
    .click();
  await expect(
    guide.getByRole("columnheader", { name: "Inseam", exact: true }),
  ).toBeVisible();
  await expect(
    guide.getByRole("columnheader", { name: "Chest", exact: true }),
  ).toHaveCount(0);
});
test("delivery preview, accordions, related, recently viewed and route metadata", async ({
  page,
}) => {
  await page.goto("/products/p1");
  await expect(page.locator("h1")).toHaveText("Linen Shirt 1");
  await page.goto("/products/p0");
  await expect(page).toHaveTitle("Linen Shirt 0 | Vastré");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "product",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(image),
  );
  await expect(page.locator(".pdp-saving")).toHaveText("You save ₹600");
  const related = page
    .locator(".pdp-recommendations")
    .filter({ has: page.getByRole("heading", { name: "You may also like" }) });
  await expect(related.locator(".product-card")).toHaveCount(4);
  await expect(related.locator(".product-name")).not.toContainText([
    "Linen Shirt 0",
  ]);
  await expect(
    page
      .locator(".pdp-recommendations")
      .filter({ has: page.getByRole("heading", { name: "Recently viewed" }) }),
  ).toContainText("Linen Shirt 1");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("#delivery-feedback")).toContainText(
    "valid six-digit",
  );
  await page.getByLabel("Delivery estimate").fill("560001");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("#delivery-feedback")).toContainText(
    "Demo estimate:",
  );
  await expect(page.locator("#delivery-feedback")).toContainText(
    "Serviceability and delivery dates have not been checked",
  );
  await page.getByText("Fabric & care", { exact: true }).click();
  await expect(
    page.getByText("Fabric composition is not available", { exact: false }),
  ).toBeVisible();
  await page.getByText("Shipping & returns", { exact: true }).click();
  await expect(page.locator(".pdp-accordions")).toContainText(
    "Easy 7-day returns",
  );
  await page.goto("/cart");
  await expect(page).toHaveTitle("Your bag | Vastré");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "website",
  );
});
test("product layout, modal and sticky mobile bar", async ({ page }, info) => {
  await page.goto("/products/p0");
  await expect(page.locator(".gallery-open img")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".gallery-open img").evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("product-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: info.outputPath("product-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  if (page.viewportSize().width < 768) {
    await expect(page.locator(".mobile-product-bar")).not.toBeVisible();
    await page.locator(".pdp-purchase").evaluate((el) =>
      window.scrollTo({
        top: el.getBoundingClientRect().bottom + scrollY + 32,
        behavior: "instant",
      }),
    );
    await expect(page.locator(".mobile-product-bar")).toBeVisible();
    await page
      .locator(".mobile-product-bar")
      .getByRole("button", { name: "Add to bag", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveText("Select a size");
    await expect(page.locator(".pdp-sizes button").first()).toBeFocused();
  }
  await page.locator(".gallery-open").click();
  await page.screenshot({
    path: info.outputPath("lightbox.png"),
    animations: "disabled",
  });
  const modal = page.getByRole("dialog", { name: "Linen Shirt 0 gallery" });
  expect(
    await modal.locator(".lightbox-stage").evaluate((el) => el.clientHeight),
  ).toBeGreaterThan(100);
});

test("variant limit and unavailable storage preserve purchase validation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "vastre-cart",
      JSON.stringify([{ product_id: "p0", size: "M", quantity: 9 }]),
    );
    localStorage.setItem("vastre-recently-viewed", "invalid json");
  });
  await page.goto("/products/p0");
  await page
    .getByRole("group", { name: "Choose your size" })
    .getByRole("button", { name: "M", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Maximum 10 per size");
  await expect(
    page.getByRole("button", { name: "Bag (9)", exact: true }),
  ).toBeVisible();
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Linen Shirt 0");
  await page
    .getByRole("group", { name: "Choose your size" })
    .getByRole("button", { name: "S", exact: true })
    .click();
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your bag", exact: true }),
  ).toBeVisible();
});
