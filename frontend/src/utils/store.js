const rupeeNumbers = new Intl.NumberFormat("en-IN");
// Reuse the formatter across card grids; display only, never payment arithmetic.
export const money = (n) =>
  `₹${typeof n === "number" ? rupeeNumbers.format(n) : n.toLocaleString("en-IN")}`;
export const cats = [
  "Shirts",
  "T-shirts",
  "Trousers",
  "Jeans",
  "Hoodies",
  "Sportswear",
];
export const wa = (t) =>
  "https://wa.me/917019023964?text=" + encodeURIComponent(t);
