export const SORT_OPTIONS = [
  ["featured", "Featured"],
  ["new-in", "New in"],
  ["price-asc", "Price low to high"],
  ["price-desc", "Price high to low"],
  ["name-asc", "Name A–Z"],
];
export const FILTER_TAGS = [
  "New in",
  "Bestseller",
  "Restocked",
  "Everyday essential",
];
const list = (params, key) => [...new Set(params.getAll(key).filter(Boolean))];
const price = (value) =>
  value !== null &&
  value.trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
    ? value
    : "";
export function readListing(params, routeCategory = "") {
  return {
    categories: params.has("category")
      ? list(params, "category")
      : routeCategory
        ? [routeCategory]
        : [],
    sizes: list(params, "size"),
    tags: list(params, "tag"),
    min: price(params.get("min")),
    max: price(params.get("max")),
    q: params.get("q") || "",
    sort: SORT_OPTIONS.some(([value]) => value === params.get("sort"))
      ? params.get("sort")
      : "featured",
    columns: ["2", "3", "4"].includes(params.get("columns"))
      ? Number(params.get("columns"))
      : 3,
    limit: Math.min(
      1000,
      Math.max(12, Number.parseInt(params.get("limit"), 10) || 12),
    ),
  };
}
export function writeListing(state, current, routeCategory = "") {
  const params = new URLSearchParams(current);
  for (const key of [
    "category",
    "size",
    "tag",
    "min",
    "max",
    "q",
    "sort",
    "columns",
    "limit",
  ])
    params.delete(key);
  // Keep the established category URL until the category selection itself changes.
  const keepRoute =
    routeCategory &&
    state.categories.length === 1 &&
    state.categories[0] === routeCategory;
  if (!keepRoute)
    state.categories.forEach((value) => params.append("category", value));
  state.sizes.forEach((value) => params.append("size", value));
  state.tags.forEach((value) => params.append("tag", value));
  for (const key of ["min", "max", "q"])
    if (state[key] !== "") params.set(key, state[key]);
  if (state.sort !== "featured") params.set("sort", state.sort);
  if (state.columns !== 3) params.set("columns", state.columns);
  if (state.limit > 12) params.set("limit", state.limit);
  return {
    pathname: keepRoute
      ? `/shop/${encodeURIComponent(routeCategory)}`
      : "/shop",
    search: params.toString() ? `?${params}` : "",
  };
}
export function matchesSearch(product, query) {
  return `${product.name} ${product.category}`
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}
export function filterProducts(products, state) {
  const matching = products.filter(
    (product) =>
      (!state.categories.length ||
        state.categories.includes(product.category)) &&
      (!state.sizes.length ||
        state.sizes.some((size) => product.sizes?.includes(size))) &&
      (!state.tags.length ||
        state.tags.some(
          (tag) => tag.toLowerCase() === product.tag?.toLowerCase(),
        )) &&
      (state.min === "" || product.price >= Number(state.min)) &&
      (state.max === "" || product.price <= Number(state.max)) &&
      matchesSearch(product, state.q),
  );
  return matching.sort((a, b) =>
    state.sort === "price-asc"
      ? a.price - b.price
      : state.sort === "price-desc"
        ? b.price - a.price
        : state.sort === "name-asc"
          ? a.name.localeCompare(b.name, "en")
          : state.sort === "new-in"
            ? Number(b.tag?.toLowerCase() === "new in") -
              Number(a.tag?.toLowerCase() === "new in")
            : 0,
  );
}
export const clearListing = (state) => ({
  ...state,
  categories: [],
  sizes: [],
  tags: [],
  min: "",
  max: "",
  q: "",
  sort: "featured",
  limit: 12,
});
export const invalidPrice = (state) =>
  state.min !== "" && state.max !== "" && Number(state.min) > Number(state.max);
