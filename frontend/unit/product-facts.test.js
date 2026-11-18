import test from "node:test";
import assert from "node:assert/strict";
import { productFacts } from "../src/utils/productFacts.js";

test("absent or malformed optional specifications never invent ratings or colours", () => {
  assert.deepEqual(productFacts(), {
    fit: "",
    colors: [],
    rating: null,
    reviews: null,
  });
  const facts = productFacts({
    fit: 42,
    colors: [
      null,
      { name: "Ink", hex: "url(evil)" },
      { name: "", hex: "#123456" },
    ],
    rating: 8,
    review_count: -1,
  });
  assert.equal(facts.rating, null);
  assert.equal(facts.reviews, null);
  assert.deepEqual(facts.colors, []);
});
test("valid optional facts retain labels and display-only palette values", () => {
  const facts = productFacts({
    fit: " Athletic ",
    colors: [{ name: " Ink ", hex: "#1f2523" }],
    rating: 4.2,
    review_count: 17,
  });
  assert.deepEqual(facts, {
    fit: "Athletic",
    colors: [{ name: "Ink", hex: "#1f2523" }],
    rating: 4.2,
    reviews: 17,
  });
});
