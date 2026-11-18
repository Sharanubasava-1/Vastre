import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicPages = [
  "/",
  "/shop",
  "/shop/Shirts",
  "/products/linen-sun-shirt",
  "/cart",
  "/coupons",
  "/login",
  "/admin/login",
  "/wishlist",
  "/verify-email",
  "/access-denied",
  "/missing-page",
];
const accountPages = [
  "/account",
  ...["profile", "security", "orders", "wishlist", "addresses"].map(
    (tab) => `/account?tab=${tab}`,
  ),
];
const adminPages = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/coupons",
  "/admin/users",
];
async function login(page, role) {
  await page.context().clearCookies();
  const result = await page.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:5182", "X-Requested-With": "vastre" },
    data: {
      email:
        role === "admin"
          ? "admin-smoke@example.test"
          : "user-smoke@example.test",
      password: "Public-admin-smoke-23",
    },
  });
  expect(result.ok()).toBeTruthy();
}
async function audit(page, info, paths, role) {
  const errors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/401.*Unauthorized/i.test(message.text())
    )
      consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.__violations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      }),
    );
  });
  const axe =
    info.project.name === "375-light" || info.project.name === "1280-dark";
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response.headers()["content-security-policy"]).toContain(
      "script-src 'self'",
    );
    await expect(page.locator("h1")).toBeVisible();
    await expect(
      page.locator(".admin-skeleton, .account-skeleton, .shop-skeleton"),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(page.locator("main#main-content")).toHaveCount(1);
    expect
      .soft(await page.evaluate(() => window.__violations), path)
      .toEqual([]);
    const broken = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.getAttribute("src")),
      );
    expect.soft(broken, path).toEqual([]);
    if (axe) {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect
        .soft(
          results.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          })),
          path,
        )
        .toEqual([]);
    }
    if (
      [
        "/",
        "/products/linen-sun-shirt",
        "/account?tab=security",
        "/admin/users",
      ].includes(path)
    )
      await page.screenshot({
        path: info.outputPath(
          `${role}-${path.replace(/[^a-z0-9]/gi, "-") || "home"}.png`,
        ),
        animations: "disabled",
      });
  }
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
}
test("public pages: accessibility, responsive layout, metadata and enforcing CSP", async ({
  page,
}, info) => {
  await audit(page, info, publicPages, "public");
  await page.goto("/products/linen-sun-shirt");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "product",
  );
  await expect
    .poll(() => page.locator('script[type="application/ld+json"]').count())
    .toBe(1);
  const data = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(data).map((item) => item["@type"])).toEqual([
    "Product",
    "BreadcrumbList",
  ]);
  await page.goto("/cart");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
});
test("all Account tabs and customer access-denied state", async ({
  page,
}, info) => {
  await login(page, "customer");
  await audit(page, info, [...accountPages, "/admin"], "customer");
});
test("all admin sections: responsive, keyboard regions, contrast and CSP", async ({
  page,
}, info) => {
  await login(page, "admin");
  await audit(page, info, adminPages, "admin");
});
test("modal focus/return, linked errors, cart live region and overlay clearance", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "375-light" && info.project.name !== "1280-dark",
    "Interaction pass in both themes; existing suites cover behaviors in detail",
  );
  await page.goto("/products/linen-sun-shirt");
  for (const [trigger, title] of [
    [page.getByRole("button", { name: "Search", exact: true }), "Search"],
    [page.getByRole("button", { name: "Bag (0)", exact: true }), "Your bag"],
    [
      page
        .locator(".pdp-info")
        .getByRole("button", { name: "Size guide", exact: true }),
      "Size guide",
    ],
    [page.getByRole("button", { name: /Enlarge .* image 1/ }), "gallery"],
  ]) {
    await trigger.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await expect(page.locator(".whatsapp-float")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await expect(page.locator("p[data-cart-announcement]")).toHaveText(
    "1 item in your bag.",
  );
  await expect(page.locator("dialog.bag-drawer[open]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".pdp-accordions").scrollIntoViewIfNeeded();
  if (info.project.use.viewport.width < 768) {
    const belowCta = await page
      .locator(".pdp-purchase")
      .evaluate(
        (element) =>
          element.getBoundingClientRect().bottom + window.scrollY + 4,
      );
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      belowCta,
    );
    await expect(page.locator(".mobile-product-bar")).toBeVisible();
    const [floating, bar] = await Promise.all([
      page.locator(".whatsapp-float").boundingBox(),
      page.locator(".mobile-product-bar").boundingBox(),
    ]);
    expect(floating.y + floating.height).toBeLessThanOrEqual(bar.y);
  }
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator("#auth-email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(
    await page
      .locator("#auth-email")
      .evaluate(
        (input) =>
          !!document.getElementById(input.getAttribute("aria-describedby"))
            ?.textContent,
      ),
  ).toBe(true);
});

test("mobile menu, filter sheet, admin confirmation and reduced motion", async ({
  page,
}, info) => {
  test.skip(
    !["375-light", "1280-dark"].includes(info.project.name),
    "Keyboard/state checks once in each theme",
  );
  async function trap(trigger) {
    await trigger.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 15; index++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await page.goto("/shop");
  if (info.project.use.viewport.width < 768) {
    await trap(page.getByRole("button", { name: "Open menu", exact: true }));
    await trap(page.locator(".mobile-filters-trigger"));
  }
  await login(page, "admin");
  await page.goto("/admin/users");
  await trap(
    page.getByRole("button", {
      name: "Disable user-smoke@example.test",
      exact: true,
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".home-hero-image")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".home-hero-image").evaluate((element) => ({
        animation: getComputedStyle(element).animationName,
        scroll: getComputedStyle(document.documentElement).scrollBehavior,
      })),
    )
    .toEqual({ animation: "none", scroll: "auto" });
});
