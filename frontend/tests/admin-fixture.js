export const products = [
  { id: "shirt", name: "Linen Sun Shirt", category: "Shirts", price: 1890, compare_at: 2490, tag: "New in", image: "/images/mens/photo-1603252110481-7ba873bf42ab.jpg", sizes: ["S", "M", "L"] },
  { id: "jeans", name: "Indigo Everyday Jeans", category: "Jeans", price: 2490, compare_at: 2990, tag: "Bestseller", image: "/images/mens/photo-1542272604-787c3835535d.jpg", sizes: ["M", "L"] },
  { id: "tee", name: "Everyday Cotton Tee", category: "T-shirts", price: 799, tag: "Everyday essential", image: "/images/mens/photo-1521572163474-6864f9cf17ab.jpg", sizes: ["S", "M"] },
];
export const coupons = [{ code: "VASTRE10", percent: 10, minimum: 4499 }, { code: "EVERYDAY5", percent: 5, minimum: 0 }];
const details = JSON.stringify({ items: [{ product_id: "shirt", size: "M", quantity: 3 }], coupon: "VASTRE10", address: "Sample Customer, 9876543210\n24 Test Road, Bengaluru, Karnataka 560001" });
export const orders = [
  { id: "order_106", email: "customer@example.test", amount: 510300, status: "paid", details },
  { id: "order_105", email: "pending@example.test", amount: 159000, status: "pending", details: "invalid json" },
  { id: "order_104", email: "denim@example.test", amount: 249000, status: "paid", details: '{"items":[{"product_id":"jeans","size":"L","quantity":1}],"coupon":"","address":"45 Test Avenue"}' },
  { id: "order_103", email: "tee@example.test", amount: 79900, status: "paid", details: "{}" },
  { id: "order_102", email: "another@example.test", amount: 129000, status: "pending" },
  { id: "order_101", email: "oldest@example.test", amount: 189000, status: "pending", details: "[]" },
];
export const overview = { customers: 12, orders, products, coupons };
export const users = [
  { id: 1, name: "Store Admin", email: "admin@example.test", role: "admin", disabled: 0, auth_provider: "password", last_login_at: 1790000000 },
  { id: 2, name: "Everyday Customer", email: "customer@example.test", role: "user", disabled: 0, auth_provider: "both", last_login_at: null },
  { id: 3, name: "Second Admin", email: "second-admin@example.test", role: "admin", disabled: 0, auth_provider: "password", last_login_at: 1790000000 },
  { id: 4, name: "Google Customer", email: "google@example.test", role: "customer", disabled: 1, auth_provider: "google", last_login_at: 1790000000 },
];

export async function mockAdmin(page, overrides = {}) {
  const state = { role: "admin", data: overview, failures: 0, overviewRequests: 0, users: users.map((person) => ({ ...person })), usersRequests: [], userChanges: [], userFailures: 0, ...overrides };
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/api/admin/users") {
      state.usersRequests.push(route.request().url());
      if (state.usersHold) await state.usersHold;
      if (state.userFailures-- > 0) return route.fulfill({ status: 503, json: { detail: "User accounts are temporarily unavailable." } });
      const query = new URL(route.request().url()).searchParams;
      const search = (query.get("search") || "").toLowerCase();
      const matching = state.users.filter((person) => [person.name, person.email].join(" ").toLowerCase().includes(search) &&
        (!query.get("role") || (query.get("role") === "customer" ? ["user", "customer"].includes(person.role) : person.role === query.get("role"))) &&
        (!query.get("status") || Boolean(person.disabled) === (query.get("status") === "disabled")) && (!query.get("provider") || person.auth_provider === query.get("provider")));
      const page = Number(query.get("page")) || 1, pageSize = 20;
      return route.fulfill({ json: { users: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length, page, page_size: pageSize, pages: Math.max(1, Math.ceil(matching.length / pageSize)), active_admins: state.users.filter((person) => person.role === "admin" && !person.disabled).length } });
    }
    if (endpoint.startsWith("/api/admin/users/")) {
      const id = Number(endpoint.split("/").at(-1)), data = route.request().postDataJSON();
      state.userChanges.push({ id, data, method: route.request().method(), csrf: route.request().headers()["x-requested-with"] });
      if (state.userUpdateFailure) return route.fulfill({ status: 409, json: { detail: "This account changed. Reload the user list and try again." } });
      const person = state.users.find((entry) => entry.id === id);
      Object.assign(person, data);
      return route.fulfill({ json: person });
    }
    if (endpoint === "/api/admin/overview") {
      state.overviewRequests++;
      if (state.hold) await state.hold;
      if (state.failures-- > 0) return route.fulfill({ status: 503, json: { detail: "The store overview is temporarily unavailable." } });
      return route.fulfill({ json: state.data });
    }
    if (endpoint === "/api/auth/login") {
      state.role = "admin";
      return route.fulfill({ json: { id: 1, name: "Store Admin", email: "admin@example.test", role: "admin" } });
    }
    const json = endpoint === "/api/products" ? products : endpoint === "/api/coupons" ? coupons : endpoint === "/api/auth/me" ? state.role ? { id: 1, name: "Store Admin", email: "admin@example.test", role: state.role } : null : {};
    return route.fulfill({ json });
  });
  return state;
}
