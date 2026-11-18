import { test, expect } from "@playwright/test";

const users = {
  a: { id: 101, name: "Customer A", email: "a@example.test", role: "user", auth_provider: "password", email_verified: 1 },
  b: { id: 202, name: "Customer B", email: "b@example.test", role: "user", auth_provider: "google", email_verified: 1 },
};
const products = [
  { id: "shirt", name: "Everyday Shirt", category: "Shirts", image: "/images/mens/photo-1603252110481-7ba873bf42ab.jpg", price: 1590, sizes: ["M", "L"], description: "An everyday shirt." },
  { id: "jeans", name: "Indigo Jean", category: "Jeans", image: "/images/mens/photo-1542272604-787c3835535d.jpg", price: 2490, sizes: ["M", "L"], description: "Everyday denim." },
];
const address = { fullName: "Customer A", phone: "9876543210", line1: "12 Private Street", line2: "", city: "Bengaluru", state: "Karnataka", pin: "560001" };
async function fixture(page) {
  const state = { user: null, nextUser: null, expired: false, quote: null, profile: null };
  await page.route("**/src/firebase.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `
    export const auth={}, provider={}, firebaseConfigured=true, firebaseError='';
    export async function signInWithPopup(){return {user:{emailVerified:true,getIdToken:async()=> 'public-test-token'}};}
    export async function signOut(){} export async function getRedirectResult(){return null;}
  ` }));
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/login") { state.user = users[route.request().postDataJSON().email.startsWith("a@") ? "a" : "b"]; return route.fulfill({ json: state.user }); }
    if (path === "/api/auth/google") { state.user = users.b; return route.fulfill({ json: state.user }); }
    if (path === "/api/auth/logout") { state.user = null; return route.fulfill({ json: { ok: true } }); }
    if (path === "/api/auth/me") { if (state.nextUser) { state.user = state.nextUser; state.nextUser = null; } return route.fulfill({ json: state.user }); }
    if (path === "/api/auth/profile" && state.profile) { await state.profile; return route.fulfill({ json: state.user }); }
    if (path === "/api/auth/sessions" && state.expired) return route.fulfill({ status: 401, json: { detail: "Please log in." } });
    if (path === "/api/checkout/quote") { if (state.quote) await state.quote; return route.fulfill({ json: { subtotal: 1590, total: 1000, discount: 590, coupon: "PRIVATE" } }); }
    return route.fulfill({ json: path === "/api/products" ? products : path === "/api/auth/profile" ? state.user : [] });
  });
  return state;
}
async function login(page, account = "a", google = false, destination = "account") {
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  if (google) await page.getByRole("button", { name: "Continue with Google" }).click();
  else {
    await page.getByLabel("Email", { exact: true }).fill(users[account].email);
    await page.getByLabel("Password", { exact: true }).fill("public-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }
  if (destination === "account") await expect(page.getByRole("heading", { name: `Hello, ${users[account].name}.` })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Your bag." })).toBeVisible();
}
async function accountTab(page, name) { await page.locator(".account-nav").getByRole("link", { name, exact: true }).click(); }
async function addShirt(page) {
  await page.locator(".header-actions").getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox").fill("Everyday");
  await page.getByRole("option", { name: /Everyday Shirt/ }).click();
  await page.locator(".pdp-sizes").getByRole("button", { name: "M", exact: true }).click();
  await page.locator(".pdp-purchase").getByRole("button", { name: "Add to bag", exact: true }).click();
  await page.getByRole("button", { name: "Close your bag" }).click();
  await page.getByRole("button", { name: "Save to wishlist", exact: true }).click();
}
test("A → logout → Google B → logout → A isolates and restores cart, wishlist and addresses without reload", async ({ page }) => {
  await fixture(page); await page.goto("/login"); await login(page);
  await addShirt(page);
  await page.locator(".header-actions").getByRole("link", { name: /^Account(?: for .+)?$/, exact: true }).click();
  await accountTab(page, "Addresses");
  await page.getByRole("button", { name: "Add your first address", exact: true }).click();
  for (const [key, value] of Object.entries(address)) await page.locator(`#address-${key}`).fill(value);
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.locator(".saved-address")).toContainText("12 Private Street");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bag (0)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wishlist (0)", exact: true })).toBeVisible();
  await login(page, "b", true);
  await expect(page.getByRole("button", { name: "Bag (0)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wishlist (0)", exact: true })).toBeVisible();
  await accountTab(page, "Addresses"); await expect(page.locator(".saved-address")).toHaveCount(0);
  await accountTab(page, "Wishlist"); await expect(page.locator("main .product-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Bag (0)", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Your bag", exact: true })).not.toContainText("Everyday Shirt");
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Log out", exact: true }).click();
  await login(page);
  await expect(page.getByRole("button", { name: "Bag (1)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wishlist (1)", exact: true })).toBeVisible();
  await accountTab(page, "Addresses"); await expect(page.locator(".saved-address")).toContainText("12 Private Street");
  const saved = await page.evaluate(() => ({ a: JSON.parse(localStorage.getItem("vastre-cart:u101")), b: JSON.parse(localStorage.getItem("vastre-cart:u202")) }));
  expect(saved.a).toEqual([{ product_id: "shirt", size: "M", quantity: 1 }]); expect(saved.b).toEqual([]);
});
test("legacy guest data migrates once, login merges maximum quantity/union and discards guest addresses", async ({ page }) => {
  await fixture(page);
  await page.addInitScript((address) => {
    localStorage.setItem("vastre-cart", JSON.stringify([{ product_id: "shirt", size: "M", quantity: 3 }]));
    localStorage.setItem("vastre-wishlist", JSON.stringify(["shirt"]));
    localStorage.setItem("vastre-addresses", JSON.stringify([{ ...address, id: "guest", label: "Guest" }]));
    localStorage.setItem("vastre-cart:u101", JSON.stringify([{ product_id: "shirt", size: "M", quantity: 5 }]));
    localStorage.setItem("vastre-wishlist:u101", JSON.stringify(["jeans"]));
  }, address);
  await page.goto("/login"); await expect(page.getByRole("button", { name: "Bag (3)", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("vastre-cart"))).toBeNull();
  await login(page);
  await expect(page.getByRole("button", { name: "Bag (5)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wishlist (2)", exact: true })).toBeVisible();
  await accountTab(page, "Addresses"); await expect(page.locator(".saved-address")).toHaveCount(0);
  expect(await page.evaluate(() => ["cart", "wishlist", "addresses"].every((kind) => !localStorage.getItem(`vastre-${kind}:guest`)))).toBe(true);
  await page.getByRole("button", { name: "Log out", exact: true }).click(); await login(page);
  await expect(page.getByRole("button", { name: "Bag (5)", exact: true })).toBeVisible();
});
test("401 closes drawers and clears forms/quotes; a late quote cannot populate the next account", async ({ page }) => {
  const state = await fixture(page); await page.goto("/login"); await login(page); await addShirt(page);
  await page.getByRole("button", { name: "Bag (1)", exact: true }).click();
  await page.getByRole("dialog", { name: "Your bag", exact: true }).getByRole("link", { name: "View bag", exact: true }).click();
  await page.locator("#address-line1").fill("Private pending draft"); await page.locator("#coupon-code").fill("PRIVATE");
  let release; state.quote = new Promise((resolve) => { release = resolve; });
  await page.getByRole("button", { name: "Apply coupon", exact: true }).click();
  state.expired = true;
  // Trigger a real protected API failure without reloading or replacing AuthContext.
  await page.evaluate(async () => { const { default: api } = await import("/src/api/client.js"); try { await api("/auth/sessions"); } catch {} });
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("button", { name: "Bag (0)", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your bag", exact: true })).not.toBeVisible();
  release(); await login(page, "b", true, "cart");
  await expect(page.getByRole("button", { name: "Bag (0)", exact: true })).toBeVisible();
  await addShirt(page);
  await page.getByRole("button", { name: "Bag (1)", exact: true }).click();
  await page.getByRole("dialog", { name: "Your bag", exact: true }).getByRole("link", { name: "View bag", exact: true }).click();
  await expect(page.locator("#address-line1")).toHaveValue(""); await expect(page.locator("#coupon-code")).toHaveValue(""); await expect(page.locator(".applied-coupon")).toHaveCount(0);
});
test("a direct authenticated user-id change closes an open drawer and resets owner data", async ({ page }) => {
  const state = await fixture(page); await page.goto("/login"); await login(page); await addShirt(page);
  await page.locator(".header-actions").getByRole("link", { name: /^Account(?: for .+)?$/, exact: true }).click(); await accountTab(page, "Profile");
  let release; state.profile = new Promise((resolve) => { release = resolve; }); state.nextUser = users.b;
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Bag (1)", exact: true }).click(); await expect(page.getByRole("dialog", { name: "Your bag", exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Hello, Customer B." })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your bag", exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Bag (0)", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Wishlist (0)", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vastre-cart:u101")))).toEqual([{ product_id: "shirt", size: "M", quantity: 1 }]);
});
