import test from "node:test";
import assert from "node:assert/strict";
import { pageMetadata } from "../src/utils/metadata.js";
import { imageUrl, responsiveImage } from "../src/utils/images.js";
import { money } from "../src/utils/store.js";
test("cached currency formatting preserves existing Indian number formatting", () => {
  for (const value of [0, 990, 1890.5, 100000, -2100, NaN, Infinity])
    assert.equal(money(value), `₹${value.toLocaleString("en-IN")}`);
});
const origin = "https://shop.example.test";
test("known local photographs get WebP candidates; unknown files are preserved", () => {
  const photo = "/images/mens/photo-1603252110481-7ba873bf42ab.jpg";
  assert.equal(
    imageUrl(photo, "detail"),
    "/images/mens/optimized/photo-1603252110481-7ba873bf42ab-1200.webp",
  );
  const props = responsiveImage(photo, "100vw");
  assert.match(props.srcSet, /160w, .*600w, .*1200w$/);
  assert.equal(props.sizes, "100vw");
  assert.deepEqual(responsiveImage("/unknown.jpg"), { src: "/unknown.jpg" });
  assert.match(
    responsiveImage("https://images.unsplash.com/photo-x").srcSet,
    /1200w$/,
  );
});
const product = {
  id: "linen",
  name: "Linen shirt",
  category: "Shirts",
  image: "/linen.jpg",
  images: ["/linen.jpg", "/back.jpg"],
  price: 1890,
  description: "Airy everyday linen.",
  sizes: ["M"],
};
test("Unsplash variants rewrite only w and preserve other hosts and local images", () => {
  for (const [variant, width] of [
    ["card", 600],
    ["detail", 1200],
    ["thumbnail", 160],
  ]) {
    const url = new URL(
      imageUrl(
        "https://images.unsplash.com/photo-x?w=999&q=70&fit=crop",
        variant,
      ),
    );
    assert.equal(url.searchParams.get("w"), String(width));
    assert.equal(url.searchParams.get("q"), "70");
  }
  for (const source of [
    "/local.jpg",
    "bad url",
    "https://images.unsplash.com.evil.test/a?w=90",
    "http://images.unsplash.com/a",
    null,
  ])
    assert.equal(imageUrl(source), source);
});
test("Product metadata uses INR, explicit availability, absolute images and ordered breadcrumbs", () => {
  const meta = pageMetadata("/products/linen", "", [product], false, origin);
  assert.equal(meta.noindex, false);
  assert.equal(meta.canonical, origin + "/products/linen");
  const [schema, crumbs] = meta.data;
  assert.equal(schema.offers.price, 1890);
  assert.equal(schema.offers.priceCurrency, "INR");
  assert.equal(schema.offers.availability, "https://schema.org/InStock");
  assert.deepEqual(schema.image, [origin + "/linen.jpg", origin + "/back.jpg"]);
  assert.deepEqual(
    crumbs.itemListElement.map((i) => i.name),
    ["Home", "Shop", "Shirts", "Linen shirt"],
  );
  assert.equal(
    pageMetadata(
      "/products/linen",
      "",
      [{ ...product, sizes: [] }],
      false,
      origin,
    ).data[0].offers.availability,
    "https://schema.org/OutOfStock",
  );
});
test("Private routes, account tabs and not-found pages never become indexable", () => {
  for (const path of [
    "/login",
    "/admin/login",
    "/account",
    "/cart",
    "/wishlist",
    "/admin/users",
    "/verify-email",
    "/access-denied",
    "/unknown",
  ])
    assert.equal(pageMetadata(path, "", [], false, origin).noindex, true, path);
  assert.match(
    pageMetadata("/account", "?tab=security", [], false, origin).title,
    /Security/,
  );
  assert.equal(
    pageMetadata("/shop", "?q=linen", [], false, origin).noindex,
    true,
  );
});
test("Shop canonical excludes filters and malformed route escapes remain safe", () => {
  const meta = pageMetadata(
    "/shop/T-shirts",
    "?sort=price-asc&size=M",
    [],
    false,
    origin,
  );
  assert.equal(meta.canonical, origin + "/shop/T-shirts");
  assert.equal(meta.data[0].itemListElement.at(-1).name, "T-shirts");
  assert.doesNotThrow(() =>
    pageMetadata("/shop/%E0%A4%A", "", [], false, origin),
  );
});
