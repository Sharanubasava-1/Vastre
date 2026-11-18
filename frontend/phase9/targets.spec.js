import { test, expect } from "@playwright/test";
test("enabled touch targets provide at least a 44px hit area", async ({
  page,
}, info) => {
  test.skip(
    !["375-light", "1280-dark"].includes(info.project.name),
    "Target geometry in both themes",
  );
  const failures = [];
  const publicPages = [
    "/",
    "/shop",
    "/products/linen-sun-shirt",
    "/cart",
    "/coupons",
    "/login",
    "/wishlist",
  ];
  const groups = [
    [null, publicPages],
    [
      "customer",
      [
        "/cart",
        ...[
          "overview",
          "profile",
          "security",
          "orders",
          "wishlist",
          "addresses",
        ].map((tab) => "/account?tab=" + tab),
      ],
    ],
    [
      "admin",
      [
        "/admin",
        "/admin/orders",
        "/admin/products",
        "/admin/coupons",
        "/admin/users",
      ],
    ],
  ];
  for (const [role, paths] of groups) {
    if (role) {
      await page.context().clearCookies();
      const result = await page.request.post("/api/auth/login", {
        headers: {
          Origin: "http://127.0.0.1:5182",
          "X-Requested-With": "vastre",
        },
        data: {
          email:
            role === "admin"
              ? "admin-smoke@example.test"
              : "user-smoke@example.test",
          password: "Public-admin-smoke-23",
        },
      });
      expect(result.ok()).toBe(true);
    }
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const small = await page
        .locator(
          "a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),summary",
        )
        .evaluateAll((elements) =>
          elements.flatMap((element) => {
            const style = getComputedStyle(element),
              rect = element.getBoundingClientRect();
            if (
              !element.getClientRects().length ||
              style.visibility === "hidden" ||
              style.display === "none" ||
              style.pointerEvents === "none"
            )
              return [];
            // A link wrapping a block image has its child's full clickable area;
            // checkbox labels extend the control's touch target.
            let area = rect;
            if (element.matches("a") && element.firstElementChild) {
              const child = element.firstElementChild.getBoundingClientRect();
              if (child.width * child.height > area.width * area.height)
                area = child;
            }
            if (element.matches("input[type=checkbox]"))
              area = element.closest("label")?.getBoundingClientRect() || area;
            if (area.width >= 43.5 && area.height >= 43.5) return [];
            return [
              {
                selector:
                  element.tagName.toLowerCase() + "." + element.className,
                label:
                  element.getAttribute("aria-label") ||
                  element.textContent?.trim().slice(0, 45),
                width: Math.round(area.width),
                height: Math.round(area.height),
              },
            ];
          }),
        );
      if (small.length) failures.push({ path, small });
    }
  }
  expect(failures).toEqual([]);
});
