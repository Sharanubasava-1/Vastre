export function productFacts(product = {}) {
  const clean = (value) => (typeof value === "string" ? value.trim() : "");
  return {
    fit: clean(product.fit),
    colors: Array.isArray(product.colors)
      ? product.colors
          .filter(
            (color) =>
              color && clean(color.name) && /^#[\da-f]{6}$/i.test(color.hex),
          )
          .map((color) => ({ name: clean(color.name), hex: color.hex }))
      : [],
    rating:
      Number.isFinite(product.rating) &&
      product.rating >= 0 &&
      product.rating <= 5
        ? product.rating
        : null,
    reviews:
      Number.isInteger(product.review_count) && product.review_count >= 0
        ? product.review_count
        : null,
  };
}
