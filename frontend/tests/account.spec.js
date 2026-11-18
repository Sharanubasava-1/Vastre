import { test, expect } from "@playwright/test";
const user = {
  id: 7,
  name: "Customer",
  email: "customer@example.com",
  role: "user",
};
const products = [
  {
    id: "shirt",
    name: "Everyday Shirt",
    category: "Shirts",
    image: "/images/mens/photo-1603252110481-7ba873bf42ab.jpg",
    price: 1590,
    compare_at: 2190,
    sizes: ["S", "M", "L"],
    description: "A relaxed everyday shirt.",
    tag: "New in",
  },
  {
    id: "jeans",
    name: "Indigo Jean",
    category: "Jeans",
    image: "/images/mens/photo-1542272604-787c3835535d.jpg",
    price: 2490,
    sizes: ["M", "L"],
    description: "Your everyday denim.",
    tag: "Bestseller",
  },
];
const orders = [
  {
    id: "order_paid",
    amount: 318000,
    status: "paid",
    created_at: "2026-10-17T08:00:00Z",
    details: JSON.stringify({
      items: [{ product_id: "shirt", size: "M", quantity: 2 }],
    }),
  },
  {
    id: "order_pending",
    amount: 249000,
    status: "pending",
    details: JSON.stringify({
      items: [{ product_id: "jeans", size: "L", quantity: 1 }],
    }),
  },
  {
    id: "order_legacy",
    amount: 100000,
    status: "pending",
    details: "invalid JSON",
  },
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
async function signIn(page) {
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}
async function fillAddress(page) {
  for (const [key, value] of Object.entries(address))
    await page.locator(`#address-${key}`).fill(value);
}
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
              : path === "/api/orders"
                ? orders
                : path === "/api/auth/logout"
                  ? { ok: true }
                  : user,
      });
    },
  );
});
test("auth tabs, validation, visibility, strength and registration payload", async ({
  page,
}, info) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Please log in." } }),
  );
  await page.goto("/login");
  await page.getByRole("tab", { name: "Log in", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Create account", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Create account", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator("#auth-name")).toBeFocused();
  await expect(page.locator("#auth-error-email")).toContainText("valid email");
  await page.getByLabel("Name", { exact: true }).fill(" Customer ");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Strong-Password!23");
  await expect(
    page.getByRole("meter", { name: "Password strength" }),
  ).toHaveAttribute("aria-valuetext", "Strong");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  if (page.viewportSize().width >= 768)
    await expect
      .poll(() =>
        page.locator(".auth-editorial img").evaluate((img) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  else await expect(page.locator(".auth-editorial")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("register-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("register-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  const request = page.waitForRequest("**/api/auth/register");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect((await request).postDataJSON()).toEqual({
    name: "Customer",
    email: user.email,
    password: "Strong-Password!23",
  });
  await expect(page).toHaveURL(/\/account$/);
});
test("inline server errors, loading and duplicate submit guard", async ({
  page,
}) => {
  await page.goto("/login");
  let calls = 0;
  await page.route("**/api/auth/login", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 401,
      json: { detail: "Incorrect email or password." },
    });
  });
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .locator(".auth-form-wrap button[type=submit]")
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(
    page.getByRole("button", { name: "Please wait…", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".auth-form-error")).toHaveText(
    "Incorrect email or password.",
  );
  expect(calls).toBe(1);
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 409,
      json: { detail: "An account with this email already exists." },
    }),
  );
  await page.getByLabel("Name", { exact: true }).fill("Customer");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator("#auth-error-email")).toContainText(
    "already exists",
  );
  await expect(page.locator("#auth-email")).toBeFocused();
});
test("protected account and header login retain the full destination", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Please log in." } }),
  );
  await page.goto("/account?tab=orders");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%3Ftab%3Dorders$/);
  await signIn(page);
  await expect(page).toHaveURL(/\/account\?tab=orders$/);
  await expect(
    page.getByRole("heading", { name: "Your orders", exact: true }),
  ).toBeVisible();
  await page.goto("/shop/Shirts?sort=price-asc");
  await page
    .locator(".header-actions")
    .getByRole("link", { name: "Login", exact: true })
    .click();
  await signIn(page);
  await expect(page).toHaveURL(/\/shop\/Shirts\?sort=price-asc$/);
});
test("account navigation, dated status cards, expandable items and legacy fallback", async ({
  page,
}, info) => {
  await page.goto("/account");
  await expect(page.locator("h1")).toHaveText("Hello, Customer.");
  await page
    .locator(".account-nav")
    .getByRole("link", { name: "Orders", exact: true })
    .click();
  await expect(page).toHaveURL(/tab=orders/);
  await expect(page.locator(".account-order")).toHaveCount(3);
  const paid = page.locator(".account-order").filter({ hasText: "order_paid" }),
    pending = page
      .locator(".account-order")
      .filter({ hasText: "order_pending" });
  await expect(paid.locator(".order-status")).toHaveText("Paid");
  await expect(paid).toContainText("17 Oct 2026");
  await expect(paid).toContainText("₹3,180");
  await expect(pending).not.toContainText("Placed");
  await expect(pending.locator(".order-status")).toHaveText("Pending");
  await paid.locator("summary").click();
  await expect(paid).toContainText("Everyday Shirt");
  await expect(paid).toContainText("Size M · Qty 2");
  const legacy = page
    .locator(".account-order")
    .filter({ hasText: "order_legacy" });
  await legacy.locator("summary").click();
  await expect(legacy).toContainText("Item details aren’t available");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("orders-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("orders-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".account-nav")
    .getByRole("link", { name: "Wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Keep your favourites close.",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Your orders", exact: true }),
  ).toBeVisible();
  await page
    .locator(".account-nav")
    .getByRole("button", { name: "Log out", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
test("orders show a retry on failure and a friendly empty collection link", async ({
  page,
}) => {
  await page.route("**/api/orders", (route) =>
    route.fulfill({ status: 503, json: { detail: "Please try again soon." } }),
  );
  await page.goto("/account?tab=orders");
  await expect(page.locator(".account-panel [role=alert]")).toContainText(
    "couldn’t load",
  );
  await page.route("**/api/orders", (route) => route.fulfill({ json: [] }));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".account-empty")).toContainText("No orders yet");
  await expect(
    page
      .locator(".account-empty")
      .getByRole("link", { name: /Explore the collection/ }),
  ).toHaveAttribute("href", "/shop");
});
test("browser address book validates, persists, edits, fills checkout and removes", async ({
  page,
}, info) => {
  const writes = [];
  page.on("request", (request) => {
    if (request.method() === "POST")
      writes.push(new URL(request.url()).pathname);
  });
  await page.goto("/account?tab=addresses");
  await page
    .getByRole("button", { name: "Add your first address", exact: true })
    .click();
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.locator("#address-fullName")).toBeFocused();
  await fillAddress(page);
  await page
    .getByLabel("Address label (optional)", { exact: true })
    .fill("Home");
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.locator(".saved-address")).toContainText("Home");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("vastre-addresses:u7")),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].pin).toBe("560001");
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.locator(".saved-address")).toContainText("Apartment 4");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator("#address-city").fill("Mysuru");
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.locator(".saved-address")).toContainText("Mysuru");
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("addresses.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() =>
    localStorage.setItem(
      "vastre-cart:u7",
      JSON.stringify([{ product_id: "shirt", size: "M", quantity: 1 }]),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Use at checkout" }).click();
  await expect(page).toHaveURL(/\/cart\?step=address#delivery-address$/);
  await expect(page.locator("#address-city")).toHaveValue("Mysuru");
  await page.goto("/account?tab=addresses");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".account-empty")).toContainText(
    "No saved addresses yet",
  );
});
test("addresses are account scoped and blocked storage still works for the visit", async ({
  page,
}) => {
  await page.addInitScript(
    (address) =>
      localStorage.setItem(
        "vastre-addresses:7",
        JSON.stringify([{ ...address, id: "home", label: "Home" }]),
      ),
    address,
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { ...user, id: 8, email: "other@example.com" } }),
  );
  await page.goto("/account?tab=addresses");
  await expect(page.locator(".saved-address")).toHaveCount(0);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw Error("blocked");
    };
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Add your first address", exact: true })
    .click();
  await fillAddress(page);
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.locator(".saved-address")).toContainText("Customer");
  await expect(page.locator(".toast-info")).toContainText("this visit only");
  await page
    .locator(".account-nav")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page
    .locator(".account-nav")
    .getByRole("link", { name: "Addresses", exact: true })
    .click();
  await expect(page.locator(".saved-address")).toHaveCount(1);
});
test("dedicated wishlist moves a chosen size to bag and persists remaining hearts", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("vastre-wishlist:u7"))
      localStorage.setItem(
        "vastre-wishlist:u7",
        JSON.stringify(["shirt", "jeans"]),
      );
  });
  await page.goto("/wishlist");
  await expect(page).toHaveTitle("Your wishlist | Vastré");
  await expect(page.locator("main .product-card")).toHaveCount(2);
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("wishlist.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Move Everyday Shirt to bag", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Choose your size",
    exact: true,
  });
  await expect(picker).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("vastre-cart:u7"))),
  ).toEqual([]);
  await picker
    .getByRole("button", { name: "Add Everyday Shirt, size L", exact: true })
    .click();
  const bag = page.getByRole("dialog", { name: "Your bag", exact: true });
  await expect(bag).toBeVisible();
  await expect(bag).toContainText("Size L");
  await page
    .getByRole("button", { name: "Close your bag", exact: true })
    .click();
  await expect(page.locator("main .product-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Wishlist (1)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("main .product-card")).toHaveCount(1);
  await expect(page.locator("main .product-card")).toContainText("Indigo Jean");
  await page.getByRole("button", { name: "Wishlist (1)", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Your wishlist", exact: true })
    .getByRole("link", { name: "View wishlist", exact: true })
    .click();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(
    page.getByRole("dialog", { name: "Your wishlist", exact: true }),
  ).not.toBeVisible();
});

test("initial session loading blocks checkout and a late session response cannot undo login", async ({
  page,
}) => {
  const pending = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      "vastre-cart",
      JSON.stringify([{ product_id: "shirt", size: "M", quantity: 1 }]),
    ),
  );
  await page.route("**/api/auth/me", (route) => {
    pending.push(route);
  });
  await page.goto("/cart");
  await expect(
    page.getByRole("button", { name: "Checking your session…", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".header-actions")
    .getByRole("link", { name: "Login", exact: true })
    .click();
  await signIn(page);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(
    page.getByRole("button", { name: "Pay with Razorpay", exact: true }),
  ).toBeEnabled();
  for (const route of pending) await route.fulfill({ json: null });
  await expect(
    page
      .locator(".header-actions")
      .getByRole("link", { name: /^Account(?: for .+)?$/, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay with Razorpay", exact: true }),
  ).toBeEnabled();
});
