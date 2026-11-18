import { test, expect } from "@playwright/test";

test("production serves sized photos, WOFF2 and compressed public startup without private chunks", async ({
  page,
  request,
}, info) => {
  test.skip(
    !["375-light", "375-dark", "1280-light", "1280-dark"].includes(
      info.project.name,
    ),
    "Representative mobile/desktop in both themes",
  );
  for (const route of ["/", "/products/linen-sun-shirt"]) {
    await page.goto(route);
    const image = page.locator(
      route === "/" ? ".home-hero-image" : ".gallery-open > img",
    );
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("fetchpriority", "high");
    await expect(image).not.toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("srcset", /600w.*1200w/);
    await expect
      .poll(() =>
        image.evaluate(
          (img) =>
            img.complete &&
            img.naturalWidth > 0 &&
            img.currentSrc.endsWith(".webp"),
        ),
      )
      .toBe(true);
    await page.evaluate(() => document.fonts.ready);
    const resources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(
      resources
        .filter((url) => /\/fonts\//.test(url))
        .every((url) => url.endsWith(".woff2")),
    ).toBe(true);
    expect(
      resources.some((url) =>
        /\/assets\/(firebase|Account|Admin|Users)-/.test(url),
      ),
    ).toBe(false);
    const scripts = await page
      .locator('script[type="module"][src]')
      .evaluateAll((nodes) => nodes.map((node) => node.src));
    const response = await request.get(scripts[0], {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(response.headers()["content-encoding"]).toBe("gzip");
    await page.screenshot({
      path: info.outputPath(route === "/" ? "home.png" : "product.png"),
      fullPage: false,
    });
  }
  await page.goto("/shop");
  const card = page.locator(".product-primary").first();
  await expect(card).toHaveAttribute("srcset", /160w.*600w.*1200w/);
  await expect(card).toHaveAttribute("sizes", /50vw/);
  await expect(card).toHaveAttribute("width", "800");
  await expect(card).toHaveAttribute("height", "1000");
});
