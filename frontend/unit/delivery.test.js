import test from "node:test";
import assert from "node:assert/strict";
import { estimateDelivery } from "../src/services/delivery.js";
test("delivery preview validates PIN and returns labelled deterministic dates", () => {
  assert.throws(() => estimateDelivery("123"), /six-digit/);
  assert.throws(() => estimateDelivery("000000"), /six-digit/);
  assert.deepEqual(
    estimateDelivery("560001", new Date("2026-10-16T00:00:00Z")),
    { from: "20 Oct", to: "23 Oct", preview: true },
  );
});
