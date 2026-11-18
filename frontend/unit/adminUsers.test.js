import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUsers,
  roleName,
  providerName,
  lastLogin,
  protectedUser,
} from "../src/utils/adminUsers.js";

test("admin user data tolerates missing metadata and discards non-public fields", () => {
  const result = normalizeUsers({
    users: [
      null,
      [],
      {
        id: 2,
        role: "user",
        password: "private-fixture",
        salt: "private-fixture",
        token: "private-fixture",
      },
    ],
    total: 1,
  });
  assert.equal(result.users.length, 1);
  assert.equal(result.pages, 1);
  assert.equal(result.users[0].name, "Unnamed customer");
  assert.equal(JSON.stringify(result).includes("private-fixture"), false);
  assert.throws(() => normalizeUsers({ users: null }), /could not be loaded/);
  assert.equal(roleName("user"), roleName("customer"));
  assert.equal(roleName(null), "Unknown role");
  assert.equal(providerName("both"), "Email + Google");
  assert.equal(providerName("__proto__"), "Not available");
  assert.equal(roleName("toString"), "Unknown role");
});

test("user actions protect current and last admin, including incomplete data", () => {
  assert.equal(protectedUser({ id: 1, role: "admin" }, { id: 1 }, 2), true);
  assert.equal(protectedUser({ id: 2, role: "admin" }, { id: 1 }, 1), true);
  assert.equal(protectedUser({ id: 2, role: "admin" }, { id: 1 }, 2), false);
  assert.equal(protectedUser({ id: null }, { id: 1 }, 2), true);
  assert.equal(
    protectedUser({ id: 2, role: "admin", disabled: true }, { id: 1 }, 1),
    false,
  );
});

test("last login treats legacy NULL and invalid timestamps as unavailable", () => {
  for (const value of [null, undefined, 0, -1, NaN, Infinity, "123", {}])
    assert.equal(lastLogin(value), null);
  assert.equal(lastLogin(1700000000).iso, "2023-11-14T22:13:20.000Z");
});
