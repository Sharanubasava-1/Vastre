import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("filled bag/address forms and security dialog have accessible labels and errors", async ({
  page,
}, info) => {
  test.skip(
    !["375-light", "1280-dark"].includes(info.project.name),
    "Form states in both themes",
  );
  const login = await page.request.post("/api/auth/login", {
    headers: { Origin: "http://127.0.0.1:5182", "X-Requested-With": "vastre" },
    data: {
      email: "user-smoke@example.test",
      password: "Public-admin-smoke-23",
    },
  });
  expect(login.ok()).toBe(true);
  const user = await login.json();
  await page.addInitScript(
    (id) =>
      localStorage.setItem(
        `vastre-cart:u${id}`,
        JSON.stringify([
          { product_id: "linen-sun-shirt", size: "M", quantity: 1 },
        ]),
      ),
    user.id,
  );
  for (const path of [
    "/cart",
    "/account?tab=addresses",
    "/account?tab=security",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    if (path.includes("addresses"))
      await page
        .getByRole("button", { name: "Add address", exact: true })
        .click();
    if (path.includes("security"))
      await page
        .getByRole("button", { name: "Change password", exact: true })
        .click();
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      report.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      path,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (path.includes("security")) {
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Change password", exact: true }),
      ).toBeFocused();
    }
  }
});
