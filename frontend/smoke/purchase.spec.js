import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
const sdkFixture = `window.Razorpay=class {
 constructor(options){this.options=options;}
 on(){}
 open(){
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-label','Simulated Razorpay test checkout');
  const title=document.createElement('h2');title.textContent='Simulated Razorpay test checkout';
  const note=document.createElement('p');note.textContent='Local fixture only. No real payment or card data.';
  const button=document.createElement('button');button.textContent='Complete simulated payment';
  button.onclick=async()=>{
    button.disabled=true;
    const order=this.options.order_id,payment='pay_'+order;
    const signature=await window.__smokeSignature(order,payment);
    dialog.close();dialog.remove();
    this.options.handler({razorpay_order_id:order,razorpay_payment_id:payment,razorpay_signature:signature});
  };
  dialog.append(title,note,button);document.body.appendChild(dialog);this.dialog=dialog;dialog.showModal();
 }
 close(){this.dialog?.close();this.dialog?.remove();}
};`;
test("browse to a persisted paid Account order through real local APIs", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // No /api route is intercepted: auth, quote, order, verification and Account use the real backend.
  await page.exposeFunction("__smokeSignature", (order, payment) =>
    createHmac("sha256", "public-local-smoke-fixture")
      .update(`${order}|${payment}`)
      .digest("hex"),
  );
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdkFixture }),
  );
  await page.goto("/");
  await page.getByRole("link", { name: /Shop the collection/ }).click();
  await expect(page).toHaveURL(/\/shop$/);
  const mobile = page.viewportSize().width < 1024;
  if (mobile)
    await page.getByRole("button", { name: /^Filter & Sort/ }).click();
  const filters = mobile
    ? page.getByRole("dialog", { name: "Filter & Sort", exact: true })
    : page.getByRole("complementary", { name: "Product filters" });
  await filters.getByRole("checkbox", { name: /^Shirts/ }).check();
  await filters.getByLabel("Minimum", { exact: true }).fill("1000");
  await filters.getByLabel("Maximum", { exact: true }).fill("2500");
  await filters.getByRole("button", { name: "M", exact: true }).click();
  const sort = mobile ? filters : page.locator(".desktop-sort");
  await sort
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("price-asc");
  if (mobile)
    await filters.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/size=M/);
  await page
    .locator(".product-name")
    .filter({ hasText: /^Linen Sun Shirt$/ })
    .click();
  await expect(page.locator("h1")).toHaveText("Linen Sun Shirt");
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText("Select a size");
  await page
    .getByRole("group", { name: "Choose your size", exact: true })
    .getByRole("button", { name: "M", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("3");
  await page
    .locator(".pdp-purchase")
    .getByRole("button", { name: "Add to bag", exact: true })
    .click();
  const bag = page.getByRole("dialog", { name: "Your bag", exact: true });
  await expect(bag).toContainText("₹5,670");
  await bag.getByRole("link", { name: "View bag", exact: true }).click();
  await page.getByRole("button", { name: /Apply VASTRE10/ }).click();
  await expect(page.locator(".applied-coupon")).toContainText(
    "VASTRE10 applied",
  );
  await expect(page.locator(".summary-total")).toContainText("₹5,103");
  const address = {
    fullName: "Smoke Customer",
    phone: "9876543210",
    line1: "12 Test Road",
    line2: "",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560001",
  };
  for (const [key, value] of Object.entries(address))
    await page.locator(`#address-${key}`).fill(value);
  await page
    .getByRole("button", { name: "Log in to checkout", exact: true })
    .click();
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Smoke Customer");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`smoke-${info.project.name}-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-smoke-password-23");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cart\?step=address#delivery-address$/);
  // Crossing guest → customer deliberately clears private form/quote state.
  await expect(page.locator("#address-line1")).toHaveValue("");
  await expect(page.locator("#coupon-code")).toHaveValue("");
  for (const [key, value] of Object.entries(address))
    await page.locator(`#address-${key}`).fill(value);
  await page.getByRole("button", { name: /Apply VASTRE10/ }).click();
  await expect(page.locator(".summary-total")).toContainText("₹5,103");
  const orderResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/payments/order") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Pay with Razorpay", exact: true })
    .click();
  const order = await (await orderResponse).json();
  expect(order.amount).toBe(510300);
  const gateway = page.getByRole("dialog", {
    name: "Simulated Razorpay test checkout",
    exact: true,
  });
  await expect(gateway).toBeVisible();
  await gateway
    .getByRole("button", { name: "Complete simulated payment", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("Order confirmed.");
  await expect(page.locator(".confirmation-id")).toContainText(order.order_id);
  await expect(
    page.getByRole("button", { name: "Bag (0)", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View my orders", exact: true }).click();
  await expect(page).toHaveURL(/\/account\?tab=orders$/);
  const card = page
    .locator(".account-order")
    .filter({ hasText: order.order_id });
  await expect(card.locator(".order-status")).toHaveText("Paid");
  await expect(card).toContainText("₹5,103");
  await card.locator("summary").click();
  await expect(card).toContainText("Linen Sun Shirt");
  await expect(card).toContainText("Size M · Qty 3");
  await page.reload();
  await expect(
    page.locator(".account-order").filter({ hasText: order.order_id }),
  ).toContainText("Paid");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: info.outputPath("persisted-order.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
