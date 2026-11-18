import test from "node:test";
import assert from "node:assert/strict";
import {
  readListing,
  writeListing,
  filterProducts,
  clearListing,
  invalidPrice,
} from "../src/utils/listing.js";
const products = [
  {
    id: "shirt",
    name: "Linen Shirt",
    category: "Shirts",
    price: 1800,
    sizes: ["S", "M"],
    tag: "New in",
  },
  {
    id: "tee",
    name: "Cotton Tee",
    category: "T-shirts",
    price: 900,
    sizes: ["M", "L"],
    tag: "Everyday essential",
  },
  {
    id: "jeans",
    name: "Indigo Jeans",
    category: "Jeans",
    price: 2400,
    sizes: ["L"],
    tag: "Bestseller",
  },
  {
    id: "shirt2",
    name: "Relaxed Shirt",
    category: "Shirts",
    price: 2000,
    sizes: ["L"],
    tag: "Restocked",
  },
];
const state = (query) => readListing(new URLSearchParams(query));
test("inclusive price range combines with OR selections within a group and AND across groups", () => {
  assert.deepEqual(
    filterProducts(
      products,
      state("category=Shirts&category=Jeans&size=L&min=2000&max=2400"),
    ).map((p) => p.id),
    ["jeans", "shirt2"],
  );
});
test("tag and search restrictions use the actual catalogue fields", () => {
  assert.deepEqual(
    filterProducts(products, state("tag=New+in&tag=Restocked&q=shirts")).map(
      (p) => p.id,
    ),
    ["shirt", "shirt2"],
  );
  assert.equal(filterProducts(products, state("q=trousers")).length, 0);
});
test("sorting preserves featured order and never mutates the source catalogue", () => {
  assert.deepEqual(
    filterProducts(products, state("sort=price-asc")).map((p) => p.id),
    ["tee", "shirt", "shirt2", "jeans"],
  );
  assert.deepEqual(
    filterProducts(products, state("sort=price-desc")).map((p) => p.id),
    ["jeans", "shirt2", "shirt", "tee"],
  );
  assert.deepEqual(
    filterProducts(products, state("sort=name-asc")).map((p) => p.id),
    ["tee", "jeans", "shirt", "shirt2"],
  );
  assert.deepEqual(
    filterProducts(products, state("sort=new-in")).map((p) => p.id),
    ["shirt", "tee", "jeans", "shirt2"],
  );
  assert.deepEqual(
    products.map((p) => p.id),
    ["shirt", "tee", "jeans", "shirt2"],
  );
});
test("category routes remain intact while query selections can move to all clothing", () => {
  const initial = readListing(new URLSearchParams("sort=price-desc"), "Shirts");
  assert.equal(
    writeListing(initial, new URLSearchParams(), "Shirts").pathname,
    "/shop/Shirts",
  );
  const mixed = { ...initial, categories: ["Shirts", "Jeans"] };
  const target = writeListing(
    mixed,
    new URLSearchParams("utm_source=edit"),
    "Shirts",
  );
  assert.equal(target.pathname, "/shop");
  assert.deepEqual(readListing(new URLSearchParams(target.search)).categories, [
    "Shirts",
    "Jeans",
  ]);
  assert.equal(new URLSearchParams(target.search).get("utm_source"), "edit");
});
test("all selections round-trip through a shareable query string", () => {
  const original = state(
    "category=Jeans&category=Shirts&size=L&tag=Restocked&min=1000&max=2500&q=shirt&sort=price-desc&columns=4&limit=24",
  );
  const target = writeListing(original, new URLSearchParams());
  assert.deepEqual(readListing(new URLSearchParams(target.search)), original);
});
test("malformed values have safe defaults and clear resets pagination", () => {
  const malformed = state("sort=unknown&columns=7&min=-1&max=NaN&limit=-3");
  assert.equal(malformed.sort, "featured");
  assert.equal(malformed.columns, 3);
  assert.equal(malformed.min, "");
  assert.equal(malformed.max, "");
  assert.equal(malformed.limit, 12);
  const cleared = clearListing(
    state("category=Shirts&q=shirt&sort=price-desc&columns=4&limit=48"),
  );
  assert.deepEqual(cleared.categories, []);
  assert.equal(cleared.q, "");
  assert.equal(cleared.sort, "featured");
  assert.equal(cleared.columns, 4);
  assert.equal(cleared.limit, 12);
  assert.equal(invalidPrice({ ...cleared, min: "2000", max: "1000" }), true);
});
