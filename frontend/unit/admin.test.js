import test from "node:test";
import assert from "node:assert/strict";
import {
  paiseToRupees,
  revenueSummary,
  parseOrderDetails,
  ordersCsv,
  csvCell,
  normalizeOverview,
  filterOrders,
} from "../src/utils/admin.js";

test("admin revenue converts paise once and averages paid orders only", () => {
  const summary = revenueSummary([
    { amount: 123450, status: "paid" },
    { amount: "60000", status: "paid" },
    { amount: 99900, status: "pending" },
  ]);
  assert.equal(summary.paidRevenue, 1834.5);
  assert.equal(summary.averageOrderValue, 917.25);
  assert.equal(summary.pending, 1);
  assert.equal(summary.total, 3);
  assert.deepEqual(
    revenueSummary(null).groups.map((group) => group.amount),
    [0, 0, 0],
  );
  for (const bad of [null, undefined, {}, -1, Infinity, "bad"])
    assert.equal(paiseToRupees(bad), 0);
});

test("admin details tolerate bad JSON, primitives and malformed items", () => {
  for (const bad of ["{broken", "null", "[]", "1", null]) {
    assert.deepEqual(parseOrderDetails(bad), {
      items: [],
      coupon: "",
      address: "",
      unavailable: true,
    });
  }
  const details = parseOrderDetails(
    JSON.stringify({
      items: [
        null,
        "bad",
        { product_id: 4, size: "M", quantity: 2 },
        { size: {}, quantity: "oops" },
      ],
      coupon: {},
      address: "One\nTwo",
    }),
  );
  assert.equal(details.items.length, 2);
  assert.equal(details.items[0].product_id, "4");
  assert.equal(details.items[1].quantity, 0);
  assert.equal(details.items[1].size, "—");
  assert.equal(details.coupon, "");
  assert.equal(details.address, "One\nTwo");
});

test("CSV escapes quotes, commas, newlines and spreadsheet formulas", () => {
  assert.equal(csvCell('A, "B"\nC'), '"A, ""B""\nC"');
  for (const formula of [
    "=1+1",
    "+SUM(A1)",
    "-1+2",
    "@SUM(A1)",
    "  =1",
    "\t=1",
  ])
    assert.ok(csvCell(formula).startsWith("\"'"));
  const csv = ordersCsv([
    {
      id: "order_1",
      email: "=HYPERLINK()",
      amount: 123450,
      status: "paid",
      details: '{"address":"A, B\\nC","coupon":"SAVE"}',
    },
  ]);
  assert.ok(csv.includes('"1234.50"'));
  assert.ok(csv.includes('"\'=HYPERLINK()"'));
  assert.ok(csv.includes('"A, B\nC"'));
  assert.equal(ordersCsv(null).split("\r\n").length, 1);
});

test("overview and order filtering are defensive and preserve server chronology", () => {
  assert.deepEqual(
    normalizeOverview({
      customers: {},
      orders: [null, {}, "bad"],
      products: null,
    }),
    { customers: 0, orders: [{}], products: [], coupons: [] },
  );
  const orders = [
    { id: "new", email: "A@example.test", amount: 200, status: "paid" },
    { id: "old", amount: 100, status: "pending" },
  ];
  assert.equal(
    filterOrders(orders, { search: "EXAMPLE", status: "paid" })[0].id,
    "new",
  );
  assert.equal(filterOrders(orders, { sort: "oldest" })[0].id, "old");
  assert.equal(filterOrders(orders, { sort: "amount-asc" })[0].id, "old");
  assert.equal(orders[0].id, "new");
});
