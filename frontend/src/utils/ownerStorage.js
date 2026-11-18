import { normalizeStoredCart } from "./cart.js";
import { EMPTY_ADDRESS } from "./checkout.js";

export function ownerId(user) {
  return user?.id !== undefined && user.id !== null && String(user.id).trim()
    ? `u${encodeURIComponent(String(user.id))}`
    : "guest";
}
export function ownerStorageKey(kind, owner) {
  return `vastre-${kind}:${owner}`;
}
export function normalizeWishlist(value) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id) =>
              (typeof id === "string" && id.trim()) ||
              (typeof id === "number" && Number.isFinite(id)),
          ),
        ),
      ]
    : [];
}
export function normalizeAddresses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        Object.keys(EMPTY_ADDRESS).every(
          (field) => typeof item[field] === "string",
        ),
    )
    .map((item) => ({
      id: item.id,
      label: typeof item.label === "string" ? item.label : "Address",
      ...Object.fromEntries(
        Object.keys(EMPTY_ADDRESS).map((field) => [field, item[field]]),
      ),
    }));
}
export function mergeCarts(...carts) {
  const rows = new Map();
  for (const cart of carts) {
    const bounded = Array.isArray(cart)
      ? cart.map((item) =>
          item && Number.isInteger(item.quantity)
            ? { ...item, quantity: Math.min(item.quantity, 10) }
            : item,
        )
      : [];
    for (const item of normalizeStoredCart(bounded)) {
      const key = JSON.stringify([item.product_id, item.size]),
        existing = rows.get(key);
      rows.set(
        key,
        existing
          ? {
              ...existing,
              quantity: Math.max(existing.quantity, item.quantity),
            }
          : item,
      );
    }
  }
  return [...rows.values()];
}
export function mergeWishlists(...lists) {
  return normalizeWishlist(lists.flatMap(normalizeWishlist));
}
function read(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) || "[]");
  } catch {
    return [];
  }
}
export function writeOwner(storage, kind, owner, value) {
  try {
    if (!storage) return false;
    storage.setItem(ownerStorageKey(kind, owner), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function remove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    /* Storage may be blocked. */
  }
}
export function readOwner(storage, owner) {
  const cart = normalizeStoredCart(
    read(storage, ownerStorageKey("cart", owner)),
  );
  const ids = normalizeWishlist(
    read(storage, ownerStorageKey("wishlist", owner)),
  );
  const addresses = normalizeAddresses(
    read(storage, ownerStorageKey("addresses", owner)),
  );
  if (owner === "guest")
    return {
      owner,
      cart: mergeCarts(cart, normalizeStoredCart(read(storage, "vastre-cart"))),
      ids: mergeWishlists(ids, read(storage, "vastre-wishlist")),
      addresses: [
        ...new Map(
          [
            ...addresses,
            ...normalizeAddresses(read(storage, "vastre-addresses")),
          ].map((item) => [item.id, item]),
        ).values(),
      ],
    };
  // Previous account addresses used :123; migrate only for that same owner.
  const legacy = normalizeAddresses(
    read(storage, `vastre-addresses:${owner.slice(1)}`),
  );
  return {
    owner,
    cart,
    ids,
    addresses: [
      ...new Map(
        [...legacy, ...addresses].map((item) => [item.id, item]),
      ).values(),
    ],
  };
}
export function mergeGuest(owned, guest) {
  return {
    ...owned,
    cart: mergeCarts(owned.cart, guest.cart),
    ids: mergeWishlists(owned.ids, guest.ids),
  };
}
export function persistOwner(storage, data) {
  for (const [kind, value] of [
    ["cart", data.cart],
    ["wishlist", data.ids],
    ["addresses", data.addresses],
  ]) {
    if (writeOwner(storage, kind, data.owner, value)) {
      remove(storage, `vastre-${kind}`);
      if (data.owner !== "guest") {
        if (kind !== "addresses")
          remove(storage, ownerStorageKey(kind, "guest"));
        else remove(storage, `vastre-addresses:${data.owner.slice(1)}`);
      }
    }
  }
  if (data.owner !== "guest") {
    remove(storage, ownerStorageKey("cart", "guest"));
    remove(storage, ownerStorageKey("wishlist", "guest"));
    remove(storage, ownerStorageKey("addresses", "guest"));
    remove(storage, "vastre-addresses");
  }
}
