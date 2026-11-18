// Discard damaged or obsolete persisted rows before they reach the global header.
export function normalizeStoredCart(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((item) => {
    if (
      !item ||
      !(
        (typeof item.product_id === "string" && item.product_id.trim()) ||
        (typeof item.product_id === "number" &&
          Number.isFinite(item.product_id))
      ) ||
      typeof item.size !== "string" ||
      !item.size.trim() ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    )
      return [];
    const key = JSON.stringify([item.product_id, item.size]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      { product_id: item.product_id, size: item.size, quantity: item.quantity },
    ];
  });
}
