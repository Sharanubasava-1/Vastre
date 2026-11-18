import { test, expect } from "@playwright/test";

const customer = {
  id: 7,
  name: "Google Customer",
  email: "customer@example.test",
  role: "user",
  auth_provider: "google",
  email_verified: 1,
};
const firebaseMock = `
export const auth={currentUser:null}, provider={providerId:'google.com'}, firebaseConfigured=true, firebaseError='';
function credential(){auth.currentUser={emailVerified:window.__authCase!=='unverified',getIdToken:async()=> 'public-mocked-token'};return {user:auth.currentUser};}
export async function signInWithPopup(){window.__popups=(window.__popups||0)+1;if(window.__authCase&&window.__authCase!=='unverified')throw {code:'auth/'+window.__authCase};return credential();}
export async function signInWithRedirect(){window.__redirected=true;}
export async function getRedirectResult(){return credential();}
export async function signOut(){auth.currentUser=null;window.__signedOut=(window.__signedOut||0)+1;}
`;
async function setup(
  page,
  {
    signedIn = false,
    provider = "google",
    role = "user",
    code = "",
    apiStatus = 200,
  } = {},
) {
  let user = signedIn ? { ...customer, role, auth_provider: provider } : null;
  const writes = [];
  await page.addInitScript((code) => {
    window.__authCase = code;
  }, code);
  await page.route("**/src/firebase.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: firebaseMock,
    }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      if (method !== "GET")
        writes.push({ path, data: route.request().postDataJSON() });
      if (path === "/api/auth/google") {
        if (apiStatus !== 200)
          return route.fulfill({
            status: apiStatus,
            json: { detail: "Google sign-in failed. Please try again." },
          });
        user = { ...customer };
        return route.fulfill({ json: user });
      }
      if (path === "/api/auth/profile") {
        user = { ...user, name: route.request().postDataJSON().name };
        return route.fulfill({ json: user });
      }
      if (path === "/api/auth/sessions")
        return route.fulfill({
          json: [
            {
              id: "own-session",
              current: true,
              user_agent: "Chrome on Windows",
              last_seen_at: 1792396800,
              ip: "127.0.0.1",
            },
            { id: "other-session", current: false },
          ],
        });
      if (path === "/api/auth/me") return route.fulfill({ json: user });
      return route.fulfill({ json: method === "GET" ? [] : { ok: true } });
    },
  );
  return writes;
}
test("login, profile and security preserve layouts and themes", async ({
  page,
}, info) => {
  const writes = await setup(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login?next=%2Faccount%3Ftab%3Dprofile");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("login.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/account\?tab=profile$/);
  await expect(page.getByText("Email verified", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__signedOut)).toBe(1);
  await page.getByLabel("Name", { exact: true }).fill("Updated Customer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Updated Customer." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("profile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Security", exact: true }).click();
  await expect(page.getByText("Chrome on Windows")).toBeVisible();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: info.outputPath("security.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Set a password", exact: true })
    .click();
  await page
    .getByLabel("New password", { exact: true })
    .fill("Public-new-password-23");
  await page.getByRole("button", { name: "Confirm with Google" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    writes.find((item) => item.path.endsWith("set-password"))?.data.id_token,
  ).toBe("public-mocked-token");
  expect(await page.evaluate(() => window.__signedOut)).toBe(2);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test.describe("auth behavior", () => {
  test.beforeEach(({}, info) =>
    test.skip(
      info.project.name !== "375-light",
      "Behavior runs once; layouts run at every size/theme.",
    ),
  );
  for (const [code, message] of [
    ["popup-closed-by-user", null],
    ["network-request-failed", /Check your connection/],
    ["unauthorized-domain", /not enabled for localhost/],
    ["user-disabled", /disabled or unavailable/],
    ["too-many-requests", /Too many attempts/],
    ["unverified", /Verify your Google email/],
  ]) {
    test(`Google ${code}`, async ({ page }) => {
      const writes = await setup(page, { code });
      await page.goto("/login");
      await page.getByRole("button", { name: "Continue with Google" }).click();
      if (message) await expect(page.getByRole("alert")).toContainText(message);
      else {
        await expect(
          page.getByRole("button", { name: "Log in", exact: true }),
        ).toBeEnabled();
        await expect(page.getByRole("alert")).toHaveCount(0);
      }
      expect(writes.some((item) => item.path.endsWith("auth/google"))).toBe(
        false,
      );
    });
  }
  for (const status of [401, 403, 429])
    test(`backend Google ${status}`, async ({ page }) => {
      await setup(page, { apiStatus: status });
      await page.goto("/login");
      await page.getByRole("button", { name: "Continue with Google" }).click();
      await expect(page.getByRole("alert")).toContainText(
        status === 401
          ? /Google sign-in failed/
          : status === 403
            ? /disabled or unavailable/
            : /Too many attempts/,
      );
      await expect(page).toHaveURL(/\/login$/);
      expect(await page.evaluate(() => window.__signedOut)).toBe(1);
    });
  test("blocked popup redirects and resumes with next, exchanging only once", async ({
    page,
  }) => {
    await setup(page, { code: "popup-blocked" });
    await page.goto("/login?next=%2Faccount%3Ftab%3Dorders");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect
      .poll(() => page.evaluate(() => !!window.__redirected))
      .toBe(true);
    await page.reload();
    await expect(page).toHaveURL(/\/account\?tab=orders$/);
    expect(await page.evaluate(() => window.__signedOut)).toBe(1);
  });
  test("anonymous guards preserve next and admin login has no Google button", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/account?tab=orders");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%3Ftab%3Dorders$/);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fusers$/);
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toHaveCount(0);
  });
  test("normal user cannot access admin routes", async ({ page }) => {
    await setup(page, { signedIn: true });
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "Access denied." }),
    ).toBeVisible();
  });
  test("protected API 401 clears user and redirects with a session-expired toast", async ({
    page,
  }) => {
    await setup(page, { signedIn: true });
    await page.route("**/api/orders", (route) =>
      route.fulfill({ status: 401, json: { detail: "Please log in." } }),
    );
    await page.goto("/account?tab=orders");
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(
      page.getByRole("region", { name: "Notifications" }).getByRole("status"),
    ).toContainText("Your session expired, please log in again");
    await expect(
      page.getByRole("link", { name: "Login", exact: true }),
    ).toBeVisible();
  });
  test("protected API 403 shows Access denied", async ({ page }) => {
    await setup(page, { signedIn: true });
    await page.route("**/api/orders", (route) =>
      route.fulfill({ status: 403, json: { detail: "Forbidden" } }),
    );
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Access denied." }),
    ).toBeVisible();
  });
  test("password account delete requires current password and explicit confirmation", async ({
    page,
  }) => {
    const writes = await setup(page, { signedIn: true, provider: "password" });
    await page.goto("/account?tab=security");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Confirm deletion" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Enter your current password",
    );
    expect(writes).toHaveLength(0);
    await page
      .getByLabel("Current password", { exact: true })
      .fill("public-password");
    await page.getByRole("button", { name: "Confirm deletion" }).click();
    await expect(page).toHaveURL("http://localhost:5173/");
    expect(
      writes.find((item) => item.path.endsWith("delete-account"))?.data
        .current_password,
    ).toBe("public-password");
  });
  test("Google-only delete re-authenticates, cancellation is silent", async ({
    page,
  }) => {
    const writes = await setup(page, {
      signedIn: true,
      code: "popup-closed-by-user",
    });
    await page.goto("/account?tab=security");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByRole("button", { name: "Confirm with Google" }).click();
    await expect(
      page.getByRole("button", { name: "Confirm with Google" }),
    ).toBeEnabled();
    expect(writes).toHaveLength(0);
    await page.evaluate(() => {
      window.__authCase = "";
    });
    await page.getByRole("button", { name: "Confirm with Google" }).click();
    await expect(page).toHaveURL("http://localhost:5173/");
    expect(
      writes.find((item) => item.path.endsWith("delete-account"))?.data
        .id_token,
    ).toBe("public-mocked-token");
    expect(await page.evaluate(() => window.__signedOut)).toBe(1);
  });
  test("blocked Google re-auth redirects without persisting a password, then resumes confirmation", async ({
    page,
  }) => {
    const writes = await setup(page, { signedIn: true, code: "popup-blocked" });
    await page.goto("/account?tab=security");
    await page
      .getByRole("button", { name: "Set a password", exact: true })
      .click();
    await page
      .getByLabel("New password", { exact: true })
      .fill("Public-new-password-23");
    await page.getByRole("button", { name: "Confirm with Google" }).click();
    await expect
      .poll(() => page.evaluate(() => !!window.__redirected))
      .toBe(true);
    expect(
      await page.evaluate(() => sessionStorage.getItem("vastre:google-return")),
    ).not.toContain("Public-new-password-23");
    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.evaluate(() => window.__signedOut)).toBe(1);
    await page
      .getByLabel("New password", { exact: true })
      .fill("Public-new-password-23");
    await page.getByRole("button", { name: "Confirm with Google" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      writes.find((item) => item.path.endsWith("set-password"))?.data.id_token,
    ).toBe("public-mocked-token");
    expect(writes.some((item) => item.path.endsWith("auth/google"))).toBe(
      false,
    );
  });
  test("missing Firebase settings are named explicitly and password login remains enabled", async ({
    page,
  }) => {
    await setup(page);
    await page.route("**/src/firebase.js*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: firebaseMock.replace(
          "firebaseError=''",
          "firebaseError='Google sign-in needs: VITE_FIREBASE_APP_ID. Update frontend/.env and restart Vite.'",
        ),
      }),
    );
    await page.goto("/login");
    await expect(page.getByRole("status")).toContainText(
      "VITE_FIREBASE_APP_ID",
    );
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toBeEnabled();
  });
  test("wrong current password stays inline; correct re-authentication changes password and ends the session", async ({
    page,
  }) => {
    await setup(page, { signedIn: true, provider: "password" });
    let changes = 0;
    await page.route("**/api/auth/change-password", (route) => {
      changes++;
      return route.fulfill(
        changes === 1
          ? { status: 401, json: { detail: "Incorrect email or password." } }
          : { json: { ok: true } },
      );
    });
    await page.goto("/account?tab=security");
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await page
      .getByLabel("New password", { exact: true })
      .fill("Public-new-password-23");
    await page.getByRole("button", { name: "Update password" }).click();
    expect(changes).toBe(0);
    await page
      .getByLabel("Current password", { exact: true })
      .fill("wrong-password");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Incorrect email or password.",
    );
    await expect(page).toHaveURL(/\/account\?tab=security$/);
    await page
      .getByLabel("Current password", { exact: true })
      .fill("public-password");
    await page
      .getByLabel("New password", { exact: true })
      .fill("Public-new-password-23");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(changes).toBe(2);
  });
  test("device revocation and confirmed logout-all use the existing session endpoints", async ({
    page,
  }) => {
    const writes = await setup(page, { signedIn: true });
    await page.goto("/account?tab=security");
    await page
      .getByRole("button", { name: "Log out device", exact: true })
      .click();
    await expect(page.locator(".toast-success")).toContainText(
      "Device logged out.",
    );
    expect(
      writes.some((item) => item.path.endsWith("sessions/other-session")),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Log out of all devices", exact: true })
      .click();
    await page.keyboard.press("Escape");
    expect(writes.some((item) => item.path.endsWith("logout-all"))).toBe(false);
    await page
      .getByRole("button", { name: "Log out of all devices", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(writes.some((item) => item.path.endsWith("logout-all"))).toBe(true);
  });
  test("Google exchange disables both sign-in methods while pending", async ({
    page,
  }) => {
    await setup(page);
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/auth/google", async (route) => {
      await held;
      return route.fulfill({ json: customer });
    });
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Please wait/ }),
    ).toBeDisabled();
    await expect(
      page.getByRole("tab", { name: "Create account" }),
    ).toBeDisabled();
    release();
    await expect(page).toHaveURL(/\/account$/);
    expect(await page.evaluate(() => window.__signedOut)).toBe(1);
  });
  test("backend exchange network failure clears Firebase and keeps login usable", async ({
    page,
  }) => {
    await setup(page);
    await page.route("**/api/auth/google", (route) =>
      route.abort("internetdisconnected"),
    );
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Check your connection",
    );
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toBeEnabled();
    expect(await page.evaluate(() => window.__signedOut)).toBe(1);
  });
});
