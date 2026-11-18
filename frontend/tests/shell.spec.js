import { test, expect } from "@playwright/test";
const images = [
  "photo-1603252110481-7ba873bf42ab",
  "photo-1521572163474-6864f9cf17ab",
  "photo-1624378439575-d8705ad7ae80",
  "photo-1542272604-787c3835535d",
  "photo-1556821840-3a63f95609a7",
];
const products = ["Shirts", "T-shirts", "Trousers", "Jeans", "Hoodies"].map(
  (category, index) => ({
    id: `item-${index}`,
    name: `Everyday ${category}`,
    category,
    image: `/images/mens/${images[index]}.jpg`,
    images: [`/images/mens/${images[index]}.jpg`],
    alt: `Men’s ${category}`,
    price: 1200,
    compare_at: 1500,
    sizes: ["S", "M", "L"],
    tag: "New",
    description: "An everyday essential.",
  }),
);
test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      return route.fulfill({
        json:
          endpoint === "/api/products"
            ? products
            : endpoint === "/api/coupons"
              ? []
              : null,
      });
    },
  );
});
test("theme follows system, persists overrides, and shell fits the viewport", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("shell-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.screenshot({
    path: testInfo.outputPath("shell-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.evaluate(() => localStorage.removeItem("vastre-theme"));
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});
test("announcement dismissal persists and sticky header shrinks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Store announcement")).toContainText(
    "Free delivery on every order",
  );
  const height = await page
    .locator(".site-header")
    .evaluate((el) => el.getBoundingClientRect().height);
  await page.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
  await expect(page.locator(".site-header")).toHaveClass(/is-scrolled/);
  await expect
    .poll(() =>
      page
        .locator(".site-header")
        .evaluate((el) => el.getBoundingClientRect().top),
    )
    .toBe(0);
  await expect
    .poll(() =>
      page
        .locator(".site-header")
        .evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBeLessThan(height);
  await page.getByRole("button", { name: "Dismiss announcement" }).click();
  await page.reload();
  await expect(page.getByLabel("Store announcement")).toHaveCount(0);
});
test("drawers contain focus, close on Escape and restore trigger focus", async ({
  page,
}, testInfo) => {
  await page.goto("/shop/Shirts");
  const mobile = page.viewportSize().width < 1024;
  const trigger = mobile
    ? page.getByRole("button", { name: "Open menu" })
    : page.getByRole("button", { name: "Bag (0)", exact: true });
  await trigger.click();
  const drawer = page.getByRole("dialog", {
    name: mobile ? "Menu" : "Your bag",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  if (mobile) {
    await expect(
      drawer.getByRole("link", { name: "Shirts", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(drawer).toHaveCSS("transform", "none");
    await page.screenshot({
      path: testInfo.outputPath("mobile-menu.png"),
      animations: "disabled",
    });
  } else
    await expect(
      page
        .locator(".collection-nav")
        .getByRole("link", { name: "Shirts", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  await drawer
    .getByRole("button", {
      name: mobile ? "Close menu" : "Close your bag",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() => drawer.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press("Tab");
  await expect
    .poll(() => drawer.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("");
});
test("bag drawer edits quantities, wishlist counts persist, search opens", async ({
  page,
}) => {
  await page.goto("/shop");
  await page
    .getByRole("button", { name: "Save Everyday Shirts to wishlist" })
    .click();
  await expect(
    page.getByRole("button", { name: "Wishlist (1)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Wishlist (1)", exact: true }).click();
  const wishlist = page.getByRole("dialog", {
    name: "Your wishlist",
    exact: true,
  });
  await expect(
    wishlist.getByRole("link", { name: "Everyday Shirts" }),
  ).toBeVisible();
  await wishlist.getByRole("button", { name: "Remove from wishlist" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByLabel("Search the collection")).toBeEnabled();
  await page.keyboard.press("Escape");
  await page.goto("/products/item-0");
  await page
    .getByRole("group", { name: "Choose your size" })
    .getByRole("button", { name: "M", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to bag", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your bag", exact: true }),
  ).toBeVisible();
  const bag = page.getByRole("dialog", { name: "Your bag", exact: true });
  await bag.getByRole("spinbutton").fill("3");
  await expect(bag).toContainText("₹3,600");
  await bag.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(bag).toContainText("Your bag is empty.");
});
test("toasts stack, can close individually and expire after four seconds", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/coupons");
  for (let i = 0; i < 2; i++) {
    await page
      .locator("footer")
      .getByLabel("Email address", { exact: true })
      .fill("preview@example.com");
    await page
      .locator("footer")
      .getByRole("button", { name: "Join newsletter", exact: true })
      .click();
  }
  await expect(page.locator(".toast-success")).toHaveCount(2);
  await page.getByLabel("Dismiss notification").first().click();
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 5500 });
});
test("newsletter is UI only, help is reachable, back to top and reduced motion work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".page-transition")).toHaveCSS(
    "animation-name",
    "none",
  );
  let newsletterRequest = false;
  page.on("request", (req) => {
    if (req.method() === "POST") newsletterRequest = true;
  });
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("reader@example.com");
  await page.getByRole("button", { name: "Join newsletter" }).click();
  await expect(page.getByRole("status")).toContainText(
    "your email has not been saved",
  );
  expect(newsletterRequest).toBe(false);
  await page.getByRole("button", { name: "Size guide", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Size guide", exact: true }),
  ).toContainText("measurements and fit advice");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
test("blocked storage remains usable and form loading/error states render", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto("/login");
  await page.getByRole("button", { name: /Switch to .* mode/ }).click();
  await page.route("**/api/auth/login", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 401,
      json: { detail: "Incorrect email or password." },
    });
  });
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Please wait/ }),
  ).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".spinner")).toBeVisible();
  await expect(page.locator(".toast-error")).toContainText(
    "Incorrect email or password.",
  );
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeEnabled();
});

test("small mobile shell has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(
    page.getByRole("dialog", { name: "Menu", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});
