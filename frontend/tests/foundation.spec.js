import { test, expect } from "@playwright/test";
const product = {
  id: 1,
  name: "Everyday Shirt",
  category: "Shirts",
  image: "/shirt.jpg",
  images: ["/shirt.jpg", "/shirt-back.jpg"],
  alt: "Cotton shirt",
  price: 1200,
  compare_at: 1500,
  tag: "New",
  sizes: ["S", "M", "L"],
  description: "An everyday essential.",
};
test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      const data =
        endpoint === "/api/products"
          ? [product]
          : endpoint === "/api/coupons"
            ? [{ code: "VASTRE10", percent: 10, minimum: 0 }]
            : endpoint === "/api/auth/me"
              ? null
              : endpoint === "/api/auth/login" ||
                  endpoint === "/api/auth/register"
                ? {
                    id: 7,
                    name: "Customer",
                    email: "customer@example.com",
                    role: "user",
                  }
                : endpoint === "/api/orders"
                  ? []
                  : endpoint === "/api/checkout/quote"
                    ? { coupon: "VASTRE10", discount: 120, total: 1080 }
                    : {};
      await route.fulfill({ json: data });
    },
  );
});
test("routes, history, category URLs, missing products and scroll", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Everyday.");
  await expect(page.locator(".wordmark").first())
    .toHaveCSS("font-size", "38px")
    .catch(async () =>
      expect(page.locator(".wordmark").first()).toHaveCSS("font-size", "33px"),
    );
  if (page.viewportSize().width < 1024) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("dialog", { name: "Menu", exact: true })
      .getByRole("link", { name: "Shirts", exact: true })
      .click();
  } else {
    await page
      .locator(".collection-nav")
      .getByRole("link", { name: "Shirts", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/\/shop\/Shirts$/);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.locator(".product-name").click();
  await expect(page.locator("h1")).toHaveText("Everyday Shirt");
  await page.goBack();
  await expect(page.locator("h1")).toHaveText("Shirts.");
  await page.goForward();
  await expect(page.locator("h1")).toHaveText("Everyday Shirt");
  for (const path of [
    "/shop",
    "/shop/T-shirts",
    "/cart",
    "/coupons",
    "/login",
    "/admin/login",
    "/account",
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/products/missing");
  await expect(page.locator("h1")).toHaveText("Page not found");
  await page.goto("/does-not-exist");
  await expect(page.locator("h1")).toHaveText("Page not found");
  await page.goto("/");
  await page.evaluate(() => scrollTo(0, 700));
  await page
    .locator(".header-actions")
    .getByRole("link", { name: "Login", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(errors).toEqual([]);
});
test("cart variants, quantity limits, persistence and coupon handoff", async ({
  page,
}) => {
  await page.goto("/products/1");
  await page
    .getByRole("group", { name: "Choose your size" })
    .getByRole("button", { name: "M", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to bag", exact: true })
    .first()
    .click();
  await expect(page.locator(".toast-success")).toContainText(
    "Added to your bag.",
  );
  await page.getByLabel("Dismiss notification").click();
  await expect(
    page.getByRole("dialog", { name: "Your bag", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close your bag" }).click();
  await page
    .getByRole("group", { name: /Choose your size/ })
    .getByRole("button", { name: "L", exact: true })
    .click();
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await openBagPage(page);
  await expect(page.locator(".cart-item")).toHaveCount(2);
  await page.getByRole("spinbutton").first().fill("10");
  await expect(
    page.getByRole("button", { name: "Bag (11)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("spinbutton").first()).toHaveValue("10");
  await page.goto("/coupons");
  await page.getByRole("button", { name: /Apply in bag/ }).click();
  await expect(page.getByLabel("Coupon code")).toHaveValue("VASTRE10");
  const quote = page.waitForRequest("**/api/checkout/quote");
  await page.getByRole("button", { name: "Apply coupon" }).click();
  expect((await quote).postDataJSON()).toEqual({
    items: [
      { product_id: 1, size: "M", quantity: 10 },
      { product_id: 1, size: "L", quantity: 1 },
    ],
    coupon: "VASTRE10",
  });
  await expect(page.locator(".checkout-panel")).toContainText("1,080");
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  await expect(page.locator(".checkout-panel")).not.toContainText("Discount");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator("main")).toContainText("Your bag is empty.");
});
test("login, registration and logout keep API contracts", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Customer");
  await page.getByLabel("Email", { exact: true }).fill("customer@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  const registration = page.waitForRequest("**/api/auth/register");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect((await registration).postDataJSON()).toEqual({
    name: "Customer",
    email: "customer@example.com",
    password: "password123",
  });
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator("h1")).toHaveText("Hello, Customer.");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("customer@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});
test("checkout preserves order and verification payloads", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: { id: 7, name: "Customer", email: "customer@example.com", role: "user" },
    }),
  );
  await page.route("**/api/payments/order", (route) =>
    route.fulfill({
      json: {
        key_id: "test-key",
        order_id: "test-order",
        amount: 120000,
        currency: "INR",
      },
    }),
  );
  await page.addInitScript(() => {
    window.Razorpay = class {
      constructor(options) {
        this.options = options;
      }
      open() {
        this.options.handler({
          razorpay_order_id: "test-order",
          razorpay_payment_id: "test-payment",
          razorpay_signature: "test-signature",
        });
      }
    };
  });
  await page.goto("/products/1");
  await page
    .getByRole("group", { name: "Choose your size" })
    .getByRole("button", { name: "M", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to bag", exact: true })
    .first()
    .click();
  await openBagPage(page);
  await page.getByLabel("Full name", { exact: true }).fill("Customer");
  await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
  await page.getByLabel("Address line 1", { exact: true }).fill("12 Main Road");
  await page.getByLabel("City", { exact: true }).fill("Bengaluru");
  await page.getByLabel("State", { exact: true }).fill("Karnataka");
  await page.getByLabel("PIN code", { exact: true }).fill("560001");
  const order = page.waitForRequest("**/api/payments/order"),
    verify = page.waitForRequest("**/api/payments/verify");
  await page.getByRole("button", { name: /Pay with Razorpay/ }).click();
  expect((await order).postDataJSON()).toEqual({
    items: [{ product_id: 1, size: "M", quantity: 1 }],
    coupon: "",
    address: "Customer, 9876543210, 12 Main Road, Bengaluru, Karnataka, 560001",
  });
  expect((await verify).postDataJSON()).toEqual({
    razorpay_order_id: "test-order",
    razorpay_payment_id: "test-payment",
    razorpay_signature: "test-signature",
  });
  await expect(page.locator("h1")).toHaveText("Order confirmed.");
  await expect(
    page.getByRole("link", { name: "View my orders", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bag (0)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Payment confirmed." }),
  ).toBeVisible();
});
test("admin overview and global error recovery", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: { name: "Admin", email: "admin@example.com", role: "admin" },
    }),
  );
  await page.route("**/api/admin/overview", (route) =>
    route.fulfill({
      json: { customers: 3, orders: [], products: [product], coupons: [] },
    }),
  );
  await page.goto("/admin");
  await expect(page.locator(".admin-stats > div").filter({ hasText: "Customers" }).locator("dd")).toHaveText("3");
  await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Products", exact: true }).click();
  await expect(page.locator(".admin-products-table tbody tr")).toHaveCount(1);
  await page.route("**/api/products", (route) =>
    route.fulfill({ json: { invalid: true } }),
  );
  await page.goto("/shop");
  await expect(page.getByRole("alert")).toContainText("Something went wrong.");
  await expect(page.getByRole("button", { name: "Reload page" })).toBeVisible();
});

async function openBagPage(page) {
  await expect(
    page.getByRole("dialog", { name: "Your bag", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Your bag", exact: true })
    .getByRole("link", { name: "View bag", exact: true })
    .click();
}

test("damaged saved bag recovers valid variants without breaking navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "vastre-cart",
      JSON.stringify([
        null,
        {},
        { product_id: 1, size: "M", quantity: 2 },
        { product_id: 1, size: "M", quantity: 10 },
        { product_id: 1, size: "L", quantity: -1 },
      ]),
    ),
  );
  await page.goto("/shop");
  await expect(page.locator("h1")).toHaveText("All clothing.");
  await expect(page.locator("h1 .orange")).toHaveCSS(
    "color",
    "rgb(240, 90, 40)",
  );
  await expect(
    page.getByRole("button", { name: "Bag (2)", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("vastre-cart:guest"))),
  ).toEqual([{ product_id: 1, size: "M", quantity: 2 }]);
  expect(errors).toEqual([]);
});

test("stale product references can be removed from the bag page and drawer", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "vastre-cart",
      JSON.stringify([
        { product_id: 1, size: "M", quantity: 2 },
        { product_id: "no-longer-listed", size: "M", quantity: 1 },
      ]),
    ),
  );
  await page.goto("/cart");
  await expect(page.locator("main .cart-unavailable")).toContainText(
    "1 saved item isn’t in the loaded collection.",
  );
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await page
    .locator("main")
    .getByRole("button", { name: "Remove unavailable items", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bag (2)", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main .cart-unavailable")).toHaveCount(0);
  await page.getByRole("button", { name: "Bag (2)", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Your bag", exact: true });
  await drawer.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(drawer).toContainText("Your bag is empty.");
});
