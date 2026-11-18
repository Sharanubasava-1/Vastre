import { test, expect } from "@playwright/test";
const image = (name) => `/images/mens/${name}.jpg`;
const base = {
  compare_at: 2490,
  price: 1890,
  sizes: ["S", "M", "L"],
  description: "An everyday essential.",
};
const products = [
  {
    id: "linen-sun-shirt",
    name: "Linen Sun Shirt",
    category: "Shirts",
    tag: "New in",
    image: image("photo-1603252110481-7ba873bf42ab"),
  },
  {
    id: "midnight-overshirt",
    name: "Midnight Overshirt",
    category: "Shirts",
    tag: "Restocked",
    image: image("photo-1607345366928-199ea26cfe3e"),
  },
  {
    id: "essential-tee",
    name: "Essential Cotton Tee",
    category: "T-shirts",
    tag: "Everyday essential",
    image: image("photo-1521572163474-6864f9cf17ab"),
  },
  {
    id: "studio-trouser",
    name: "Studio Tailored Trouser",
    category: "Trousers",
    tag: "New in",
    image: image("photo-1624378439575-d8705ad7ae80"),
  },
  {
    id: "indigo-jean",
    name: "Indigo Straight Jean",
    category: "Jeans",
    tag: "Bestseller",
    image: image("photo-1542272604-787c3835535d"),
  },
  {
    id: "everyday-hoodie",
    name: "Everyday Fleece Hoodie",
    category: "Hoodies",
    tag: "New in",
    image: image("photo-1556821840-3a63f95609a7"),
  },
].map((p) => ({ ...base, ...p, alt: p.name, images: [p.image] }));
const offers = [
  { code: "VASTRE10", percent: 10, minimum: 4499 },
  { code: "WELCOME5", percent: 5, minimum: 0 },
];
async function mock(page, catalogue = products, coupons = offers) {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      return route.fulfill({
        json:
          endpoint === "/api/products"
            ? catalogue
            : endpoint === "/api/coupons"
              ? coupons
              : null,
      });
    },
  );
}
test("editorial sections, catalogue tags, category counts and product destinations", async ({
  page,
}, testInfo) => {
  await mock(page);
  await page.goto("/");
  await expect(page.locator(".home-page > section")).toHaveCount(9);
  expect(
    await page
      .locator(".home-page > section")
      .evaluateAll((nodes) => nodes.map((n) => n.className.split(" ")[0])),
  ).toEqual([
    "home-hero",
    "home-trust",
    "home-section",
    "home-section",
    "home-section",
    "home-story",
    "home-offers",
    "home-section",
    "home-newsletter",
  ]);
  await expect(
    page.getByRole("link", { name: /Shop the collection/ }),
  ).toHaveAttribute("href", "/shop");
  await expect(page.getByRole("link", { name: /Shop new in/ })).toHaveAttribute(
    "href",
    "#new-in",
  );
  await expect(page.locator(".home-trust")).toContainText("Easy 7-day returns");
  await expect(page.locator(".home-trust svg")).toHaveCount(4);
  await expect(page.locator(".home-category")).toHaveCount(6);
  await expect(page.locator(".home-category").first()).toContainText(
    "2 products",
  );
  expect(
    await page.locator(".carousel-track .product-name").allTextContents(),
  ).toEqual([
    "Linen Sun Shirt",
    "Studio Tailored Trouser",
    "Everyday Fleece Hoodie",
  ]);
  expect(
    await page.locator(".bestseller-products .product-name").allTextContents(),
  ).toEqual(["Indigo Straight Jean"]);
  await expect(page.locator(".lookbook-strip > a")).toHaveCount(6);
  await expect(page.locator(".lookbook-strip > a").first()).toHaveAttribute(
    "href",
    "/products/linen-sun-shirt",
  );
  await expect(page.locator(".story-copy .button")).toHaveAttribute(
    "href",
    "/coupons",
  );
  await expect(page.locator(".home-offer").first()).toContainText("VASTRE10");
  await expect(page.locator(".home-offer").first()).toContainText("₹4,499");
  await page.locator(".home-page img").evaluateAll((images) =>
    images.forEach((image) => {
      image.loading = "eager";
    }),
  );
  await expect
    .poll(() =>
      page
        .locator(".home-page img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("home-light.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.screenshot({
    path: testInfo.outputPath("home-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
});
test("375px hero keeps the subject visible, CTAs usable and motion optional", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mock(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(page.locator(".home-hero-image")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(
    page.getByRole("link", { name: /Shop the collection/ }),
  ).toBeInViewport();
  await expect(
    page.getByRole("link", { name: /Shop new in/ }),
  ).toBeInViewport();
  await expect(page.locator(".home-hero-image")).toHaveCSS(
    "object-position",
    "50% 0px",
  );
  const action = await page
    .getByRole("link", { name: /Shop new in/ })
    .boundingBox();
  const support = await page.locator(".whatsapp-float").boundingBox();
  expect(action.y + action.height).toBeLessThanOrEqual(support.y);
  await page.screenshot({
    path: testInfo.outputPath("hero-375.png"),
    animations: "disabled",
  });
  await page.getByRole("link", { name: /Shop new in/ }).click();
  await expect(page).toHaveURL(/#new-in$/);
  await expect(page.locator("#new-in h2")).toBeInViewport();
});
test("new-in carousel scrolls in both directions and supports keyboard navigation", async ({
  page,
}) => {
  const newItems = Array.from({ length: 8 }, (_, index) => ({
    ...products[0],
    id: `new-${index}`,
    name: `New shirt ${index}`,
  }));
  await mock(page, newItems);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const track = page.getByRole("region", { name: "New arrivals", exact: true });
  await expect(track).toHaveCSS("scroll-snap-type", "x mandatory");
  if (page.viewportSize().width >= 641) {
    await expect(
      page.getByRole("button", { name: "Previous new arrivals" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Next new arrivals" }).click();
    await expect
      .poll(() => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Previous new arrivals" }).click();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBe(0);
  } else {
    await expect(
      page.getByRole("button", { name: "Next new arrivals" }),
    ).not.toBeVisible();
    await track.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await track.evaluate((element) =>
      element.scrollTo({ left: 0, behavior: "instant" }),
    );
    await expect
      .poll(() => track.evaluate((element) => element.scrollLeft))
      .toBe(0);
    await track.scrollIntoViewIfNeeded();
    const bounds = await track.boundingBox(),
      session = await page.context().newCDPSession(page);
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    const y = Math.round(bounds.y + 80),
      start = Math.min(
        page.viewportSize().width - 30,
        Math.round(bounds.x + bounds.width - 30),
      );
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start, y }],
    });
    for (let step = 1; step <= 8; step++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start - step * 28, y }],
      });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => track.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await session.detach();
  }
});
test("loading skeletons resolve independently for products and live coupons", async ({
  page,
}) => {
  let productsReady, offersReady;
  const pendingProducts = new Promise((resolve) => (productsReady = resolve)),
    pendingOffers = new Promise((resolve) => (offersReady = resolve));
  await mock(page);
  await page.route("**/api/products", async (route) => {
    await pendingProducts;
    await route.fulfill({ json: products });
  });
  await page.route("**/api/coupons", async (route) => {
    await pendingOffers;
    await route.fulfill({
      json: [{ code: "LIVE23", percent: 23, minimum: 3000 }],
    });
  });
  await page.goto("/");
  await expect(page.locator(".home-categories")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(
    page.locator(".home-skeletons-categories .home-skeleton"),
  ).toHaveCount(6);
  await expect(page.locator(".home-category img")).toHaveCount(0);
  productsReady();
  await expect(page.locator(".home-categories")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".home-category img")).toHaveCount(6);
  await expect(page.locator(".home-offers")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  offersReady();
  await expect(page.locator(".home-offer")).toContainText("23% off");
  await expect(page.locator(".home-offer")).toContainText("LIVE23");
  await expect(page.locator(".home-offer")).toContainText("₹3,000");
});
test("empty catalogue and missing tags never produce broken images or fake products", async ({
  page,
}) => {
  await mock(page, [], []);
  await page.goto("/");
  await expect(page.locator(".home-category")).toHaveCount(6);
  await expect(page.locator(".category-caption > span")).toHaveText(
    Array(6).fill("0 products"),
  );
  // Lazy images below the viewport need to become visible before they load.
  // Checking every image at once depends on Chrome's lazy-load distance.
  for (const image of await page.locator(".home-category img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
  await expect(page.locator(".home-new")).toContainText(
    "New arrivals are on their way.",
  );
  await expect(page.locator(".home-offers")).toContainText("no active offers");
  await expect(page.locator(".home-lookbook")).toContainText(
    "Our next edit is coming soon.",
  );
  await expect(page.locator(".home-page .product-card")).toHaveCount(0);
  await page.route("**/api/products", (route) =>
    route.fulfill({ json: [products[2]] }),
  );
  await page.reload();
  await expect(page.locator(".home-new .product-card")).toHaveCount(0);
  await expect(page.locator(".bestseller-products .product-card")).toHaveCount(
    0,
  );
  await expect(page.locator(".lookbook-strip > a")).toHaveCount(1);
});
test("home newsletter uses local UI only and category links work", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/");
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page
    .getByRole("textbox", { name: "Your email", exact: true })
    .fill("reader@example.com");
  await page.getByRole("button", { name: "Sign me up", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "your email has not been saved",
  );
  expect(posts).toEqual([]);
  await page
    .locator(".home-category")
    .filter({
      has: page.getByRole("heading", { name: "T-shirts", exact: true }),
    })
    .click();
  await expect(page).toHaveURL(/\/shop\/T-shirts$/);
});
