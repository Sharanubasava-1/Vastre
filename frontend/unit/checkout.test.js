import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_ADDRESS,
  validateAddress,
  formatAddress,
} from "../src/utils/checkout.js";
const address = {
  fullName: " Customer ",
  phone: "9876543210",
  line1: "12 Main Road",
  line2: "",
  city: "Bengaluru",
  state: "Karnataka",
  pin: "560001",
};
test("structured address requires every mandatory field with valid mobile and PIN", () => {
  assert.deepEqual(
    Object.keys(validateAddress(EMPTY_ADDRESS)).sort(),
    ["fullName", "phone", "line1", "city", "state", "pin"].sort(),
  );
  assert.deepEqual(validateAddress(address), {});
  assert.match(
    validateAddress({ ...address, phone: "123", pin: "000000" }).phone,
    /10-digit/,
  );
  assert.match(validateAddress({ ...address, pin: "ABCDEF" }).pin, /six-digit/);
  assert.match(validateAddress({ ...address, city: "  " }).city, /city/);
});
test("address fields retain the backend string contract without empty separators", () => {
  assert.equal(
    formatAddress(address),
    "Customer, 9876543210, 12 Main Road, Bengaluru, Karnataka, 560001",
  );
  assert.equal(
    formatAddress({ ...address, line2: " Apartment 4 " }),
    "Customer, 9876543210, 12 Main Road, Apartment 4, Bengaluru, Karnataka, 560001",
  );
});
