// Order amounts arrive in paise; catalogue and coupon prices arrive in rupees.
export function nonNegativeNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export const paiseToRupees = (value) => nonNegativeNumber(value) / 100;
export const text = (value, fallback = "—") =>
  (typeof value === "string" && value.trim()) ||
  (typeof value === "number" && Number.isFinite(value))
    ? String(value)
    : fallback;
const record = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const records = (value) => (Array.isArray(value) ? value.filter(record) : []);

export function normalizeOverview(value) {
  return {
    customers: nonNegativeNumber(value?.customers),
    orders: records(value?.orders),
    products: records(value?.products),
    coupons: records(value?.coupons),
  };
}

export function parseOrderDetails(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  if (!record(parsed))
    return { items: [], coupon: "", address: "", unavailable: true };
  return {
    items: records(parsed.items).map((item) => ({
      product_id: text(item.product_id),
      name: text(item.name, ""),
      size: text(item.size),
      quantity: nonNegativeNumber(item.quantity),
    })),
    coupon: text(parsed.coupon, ""),
    address: text(parsed.address, ""),
    unavailable: false,
  };
}

export function orderStatus(order) {
  const status = text(order?.status, "unknown").trim().toLowerCase();
  return ["paid", "pending"].includes(status) ? status : "unknown";
}

export function revenueSummary(orders) {
  const rows = records(orders);
  const groups = ["paid", "pending", "unknown"].map((status) => ({
    status,
    count: rows.filter((order) => orderStatus(order) === status).length,
    amount: rows
      .filter((order) => orderStatus(order) === status)
      .reduce((sum, order) => sum + paiseToRupees(order.amount), 0),
  }));
  return {
    total: rows.length,
    paidRevenue: groups[0].amount,
    pending: groups[1].count,
    averageOrderValue: groups[0].count ? groups[0].amount / groups[0].count : 0,
    groups,
  };
}

export function filterOrders(
  orders,
  { search = "", status = "all", sort = "recent" } = {},
) {
  const query = search.trim().toLowerCase();
  const result = records(orders).filter(
    (order) =>
      (status === "all" || orderStatus(order) === status) &&
      `${text(order.id, "")} ${text(order.email, "")}`
        .toLowerCase()
        .includes(query),
  );
  if (sort === "amount-desc")
    result.sort(
      (a, b) => nonNegativeNumber(b.amount) - nonNegativeNumber(a.amount),
    );
  if (sort === "amount-asc")
    result.sort(
      (a, b) => nonNegativeNumber(a.amount) - nonNegativeNumber(b.amount),
    );
  if (sort === "id")
    result.sort((a, b) => text(a.id).localeCompare(text(b.id)));
  // The endpoint already supplies newest first, including orders with no date field.
  if (sort === "oldest") result.reverse();
  return result;
}

export function csvCell(value) {
  let cell = text(value, "");
  // Quoting alone does not stop spreadsheet formula execution.
  if (/^[\s]*[=+\-@\t\r\n]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function ordersCsv(orders) {
  const rows = records(orders).map((order) => {
    const details = parseOrderDetails(order.details);
    return [
      text(order.id),
      text(order.email),
      paiseToRupees(order.amount).toFixed(2),
      orderStatus(order),
      details.coupon,
      details.address,
      details.items
        .map(
          (item) =>
            `${item.name || item.product_id} / ${item.size} / Qty ${item.quantity}`,
        )
        .join("; "),
    ];
  });
  return [
    [
      "Order ID",
      "Customer email",
      "Amount (INR)",
      "Status",
      "Coupon",
      "Delivery address",
      "Items",
    ],
    ...rows,
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
