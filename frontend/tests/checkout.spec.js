import { test, expect } from "@playwright/test";
const product = {
  id: "shirt",
  name: "Everyday Shirt",
  category: "Shirts",
  image: "/images/mens/photo-1603252110481-7ba873bf42ab.jpg",
  price: 1590,
  compare_at: 2190,
  sizes: ["S", "M", "L"],
  tag: "New in",
  description: "An everyday shirt.",
};
const offers = [
  { code: "VASTRE10", percent: 10, minimum: 0 },
  { code: "BIG20", percent: 20, minimum: 4499 },
];
const address = {
  fullName: "Customer",
  phone: "9876543210",
  line1: "12 Main Road",
  line2: "Apartment 4",
  city: "Bengaluru",
  state: "Karnataka",
  pin: "560001",
};
async function fillAddress(page) {
  for (const [key, value] of Object.entries(address))
    await page.locator(`#address-${key}`).fill(value);
}
async function installPayment(page, mode = "hold") {
  await page.addInitScript((mode) => {
    window.paymentOptions = null;
    window.paymentOpenCount = 0;
    window.Razorpay = class {
      constructor(options) {
        this.options = options;
        window.paymentOptions = options;
        window.paymentInstance = this;
      }
      on(event, handler) {
        this.failed = handler;
      }
      open() {
        window.paymentOpenCount++;
        if (mode === "success")
          this.options.handler({
            razorpay_order_id: "order_phase6",
            razorpay_payment_id: "payment_test",
            razorpay_signature: "signature_test",
          });
      }
      close() {}
    };
  }, mode);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "vastre-cart",
      JSON.stringify([{ product_id: "shirt", size: "M", quantity: 1 }]),
    ),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      let json =
        path === "/api/products"
          ? [product]
          : path === "/api/coupons"
            ? offers
            : path === "/api/auth/me"
              ? {
                  id: 7,
                  name: "Customer",
                  email: "customer@example.com",
                  role: "user",
                }
              : path === "/api/orders"
                ? []
                : path === "/api/payments/order"
                  ? {
                      key_id: "test_key",
                      order_id: "order_phase6",
                      amount: 159000,
                      currency: "INR",
                    }
                  : path === "/api/payments/verify"
                    ? { status: "paid", order_id: "order_phase6" }
                    : {};
      if (path === "/api/checkout/quote") {
        const body = route.request().postDataJSON(),
          subtotal = body.items.reduce(
            (n, item) => n + item.quantity * 1590,
            0,
          ),
          code = body.coupon.trim().toUpperCase();
        if (code === "BAD")
          return route.fulfill({
            status: 400,
            json: { detail: "This coupon is not available." },
          });
        const discount = code ? Math.floor(subtotal * 0.1) : 0;
        json = { subtotal, discount, total: subtotal - discount, coupon: code };
      }
      return route.fulfill({ json });
    },
  );
});
test("drawer free delivery, steppers, two destinations and category empty state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Bag (1)", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Your bag", exact: true });
  await expect(drawer).toContainText("Free delivery on every order");
  await expect(drawer.getByRole("progressbar")).toHaveCount(0);
  await drawer
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await expect(drawer).toContainText("Free delivery on every order");
  await expect(drawer.getByRole("spinbutton")).toHaveValue("2");
  await expect(
    drawer.getByRole("link", { name: "View bag", exact: true }),
  ).toHaveAttribute("href", "/cart");
  await drawer.getByRole("link", { name: "Checkout", exact: true }).click();
  await expect(page).toHaveURL(/\/cart\?step=address#delivery-address$/);
  await expect(page.locator(".checkout-steps [aria-current=step]")).toHaveText(
    "2Address",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator("main .empty-bag")).toContainText(
    "Your bag is empty",
  );
  await expect(page.locator("main .empty-bag-categories a")).toHaveCount(6);
});
test("cart moves to wishlist, applies and removes live coupons, invalidates stale totals", async ({
  page,
}) => {
  await page.goto("/cart");
  await page.getByRole("button", { name: /Apply VASTRE10/ }).click();
  await expect(page.locator(".applied-coupon")).toContainText(
    "VASTRE10 applied",
  );
  await expect(page.locator(".summary-total")).toContainText("₹1,431");
  await expect(
    page.getByRole("button", { name: /Apply BIG20/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Remove coupon", exact: true })
    .click();
  await expect(page.getByLabel("Coupon code", { exact: true })).toHaveValue("");
  await expect(page.locator(".summary-total")).toContainText("₹1,590");
  await page.getByLabel("Coupon code", { exact: true }).fill("BAD");
  await page.getByRole("button", { name: "Apply coupon", exact: true }).click();
  await expect(page.locator("#coupon-error")).toHaveText(
    "This coupon is not available.",
  );
  await page.getByRole("button", { name: /Apply VASTRE10/ }).click();
  await expect(page.locator(".applied-coupon")).toBeVisible();
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await expect(page.locator(".applied-coupon")).toHaveCount(0);
  await expect(page.locator(".summary-total")).toContainText("₹3,180");
  await page
    .getByRole("button", { name: "Move to wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Wishlist (1)", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main .empty-bag")).toBeVisible();
});
test("structured fields validate inline and preserve exact order payload through confirmation", async ({
  page,
}, info) => {
  await installPayment(page, "success");
  await page.goto("/cart");
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect(page.locator("#address-fullName")).toBeFocused();
  await expect(page.locator("#error-phone")).toContainText("10-digit");
  await expect(page.locator("#error-pin")).toContainText("six-digit");
  await fillAddress(page);
  await page.locator("#address-phone").fill("123");
  await page.locator("#address-pin").fill("000000");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe("address-phone");
  await fillAddress(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(
    page.locator(".checkout-steps [aria-current=step]"),
  ).toContainText("Payment");
  await page.screenshot({
    path: info.outputPath("checkout-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: info.outputPath("checkout-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  const request = page.waitForRequest("**/api/payments/order");
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  expect((await request).postDataJSON()).toEqual({
    items: [{ product_id: "shirt", size: "M", quantity: 1 }],
    coupon: "",
    address:
      "Customer, 9876543210, 12 Main Road, Apartment 4, Bengaluru, Karnataka, 560001",
  });
  await expect(page.locator("h1")).toHaveText("Order confirmed.");
  await expect(page).toHaveTitle("Order confirmed | Vastré");
  await expect(page.locator(".confirmation-id")).toContainText("order_phase6");
  await expect(page.locator(".confirmation-summary")).toContainText(
    "Everyday Shirt",
  );
  await expect(
    page.getByRole("button", { name: "Bag (0)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue shopping", exact: true }),
  ).toHaveAttribute("href", "/shop");
  await expect(
    page.getByRole("link", { name: "View my orders", exact: true }),
  ).toHaveAttribute("href", "/account?tab=orders");
  await page.screenshot({
    path: info.outputPath("confirmation.png"),
    fullPage: true,
    animations: "disabled",
  });
});
test("payment stays locked until dismissal and failed payments retain bag", async ({
  page,
}) => {
  await installPayment(page);
  await page.goto("/cart");
  await fillAddress(page);
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Complete payment in Razorpay",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.paymentOpenCount)).toBe(1);
  await page.evaluate(() => window.paymentOptions.modal.ondismiss());
  await expect(
    page.getByRole("button", { name: "Pay with Razorpay", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.paymentOpenCount)).toBe(2);
  await page.evaluate(() =>
    window.paymentInstance.failed({
      error: { description: "Your bank declined this attempt." },
    }),
  );
  await expect(page.locator(".toast-error")).toContainText(
    "Your bank declined",
  );
  await expect(
    page.getByRole("button", { name: "Pay with Razorpay", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".cart-item")).toHaveCount(1);
});
test("SDK load failure is friendly, keeps bag and permits retry", async ({
  page,
}) => {
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.abort("failed"),
  );
  let orders = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/payments/order")) orders++;
  });
  await page.goto("/cart");
  await fillAddress(page);
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect(page.locator(".toast-error")).toContainText(
    "We couldn’t load secure checkout",
  );
  await expect(
    page.getByRole("button", { name: "Pay with Razorpay", exact: true }),
  ).toBeEnabled();
  expect(orders).toBe(0);
  await installPayment(page);
  await page.reload();
  await fillAddress(page);
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Complete payment in Razorpay",
      exact: true,
    }),
  ).toBeDisabled();
});
test("verification failure never confirms or empties bag, duplicate callback verifies once", async ({
  page,
}) => {
  await installPayment(page);
  let verifications = 0;
  await page.route("**/api/payments/verify", async (route) => {
    verifications++;
    await route.fulfill({
      status: 409,
      json: { detail: "Payment is awaiting capture." },
    });
  });
  await page.goto("/cart");
  await fillAddress(page);
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.paymentOpenCount)).toBe(1);
  await page.evaluate(() => {
    const result = {
      razorpay_order_id: "order_phase6",
      razorpay_payment_id: "payment_test",
      razorpay_signature: "signature_test",
    };
    window.paymentOptions.handler(result);
    window.paymentOptions.handler(result);
  });
  await expect(page.locator(".verification-help")).toContainText(
    "order_phase6",
  );
  await expect(page.locator("h1")).toHaveText("Your bag.");
  await expect(page.locator(".cart-item")).toHaveCount(1);
  expect(verifications).toBe(1);
  await expect(
    page
      .locator(".verification-help")
      .getByRole("link", { name: "View my orders", exact: true }),
  ).toBeVisible();
});
test("offer tickets copy codes and validate apply-in-bag action", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.copiedCode = text;
        },
      },
    }),
  );
  await page.goto("/coupons");
  await expect(page.locator(".offer-ticket")).toHaveCount(2);
  await page.screenshot({
    path: info.outputPath("offers.png"),
    fullPage: true,
    animations: "disabled",
  });
  const ticket = page.locator(".offer-ticket").first();
  await ticket.getByRole("button", { name: "Copy code", exact: true }).click();
  expect(await page.evaluate(() => window.copiedCode)).toBe("VASTRE10");
  await expect(page.locator(".toast-success")).toContainText("VASTRE10 copied");
  await ticket.getByRole("button", { name: "Apply in bag" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator(".applied-coupon")).toContainText(
    "VASTRE10 applied",
  );
});

test("checkout login returns to address with private guest fields cleared", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Please log in." } }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      json: {
        id: 7,
        name: "Customer",
        email: "customer@example.com",
        role: "user",
      },
    }),
  );
  await page.goto("/cart");
  await fillAddress(page);
  await page
    .getByRole("button", { name: "Log in to checkout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill("customer@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/cart\?step=address#delivery-address$/);
  await expect(page.locator("#address-line1")).toHaveValue("");
  await expect(page.locator("#address-phone")).toHaveValue("");
});
test("a coupon response for an earlier bag cannot overwrite updated totals", async ({
  page,
}) => {
  let pending;
  await page.route("**/api/checkout/quote", (route) => {
    pending = route;
  });
  await page.goto("/cart");
  await page.getByRole("button", { name: /Apply VASTRE10/ }).click();
  await expect.poll(() => !!pending).toBe(true);
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await expect(page.locator(".summary-total")).toContainText("₹3,180");
  await pending.fulfill({
    json: { subtotal: 1590, discount: 159, total: 1431, coupon: "VASTRE10" },
  });
  await expect(
    page.getByRole("button", { name: "Apply coupon", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".applied-coupon")).toHaveCount(0);
  await expect(page.locator(".summary-total")).toContainText("₹3,180");
});

test("items added while payment is open survive successful checkout", async ({
  page,
}) => {
  await installPayment(page);
  await page.goto("/cart");
  await fillAddress(page);
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.paymentOpenCount)).toBe(1);
  await page.getByRole("button", { name: "Bag (1)", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Your bag", exact: true });
  await drawer
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close your bag", exact: true })
    .click();
  await page.evaluate(() =>
    window.paymentOptions.handler({
      razorpay_order_id: "order_phase6",
      razorpay_payment_id: "payment_test",
      razorpay_signature: "signature_test",
    }),
  );
  await expect(page.locator("h1")).toHaveText("Order confirmed.");
  await expect(
    page.getByRole("button", { name: "Bag (1)", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-summary")).toContainText("Qty 1");
});
