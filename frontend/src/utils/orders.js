export function orderItems(order) {
  if (Array.isArray(order.items)) return order.items;
  try {
    const payload =
      typeof (order.payload ?? order.details) === "string"
        ? JSON.parse(order.payload ?? order.details)
        : (order.payload ?? order.details);
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    return [];
  }
}
export function orderDate(order) {
  const value = order.created_at ?? order.createdAt ?? order.date;
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(
    typeof value === "number" && value < 1e12 ? value * 1000 : value,
  );
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(date);
}
