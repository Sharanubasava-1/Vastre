# Vastré

Deployment/security reference: [Google-auth Phase 8](#google-authentication-phase-8-documentation-and-final-security-checks). Earlier phase sections retain historical test results; the Phase 8 settings and remaining checks below are the current handover.

Vastré is a dynamic clothing storefront with a React + Vite frontend and a FastAPI backend.

## Project structure

```text
backend/
  app.py
  requirements.txt
frontend/
  src/
  index.html
  package.json
  vite.config.js
```

## Development

Start the backend from the project root:

```powershell
.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Build and local production preview

Build the frontend:

```powershell
cd frontend
npm run build
```

Then serve the generated frontend through FastAPI:

```powershell
cd ..
.venv\Scripts\python.exe -m uvicorn backend.app:app --port 8000
```

Open `http://localhost:8000`.

This is a local preview, not an HTTPS production deployment. Follow the [Phase 8 production checklist](#production-deployment-checklist) before exposing the service.

## Accounts and payments

The catalogue is men-only, with separate collection and product detail pages. Customers can register at `/login`; administrators sign in at `/admin/login`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before starting the backend to provision the first admin. User accounts, sessions and orders persist in `backend/store.db` (SQLite). The admin dashboard shows customers, orders, revenue, catalogue and active coupons.

Configure backend variables using `backend/.env.example` as a reference. The app automatically loads **`backend/.env`**, independent of the working directory, with `override=False`: existing process variables take priority. It never loads `frontend/.env` into the backend. The example contains placeholders only; replace the admin credentials before use and keep local environment files out of version control. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the backend. Start with Razorpay test keys and configure automatic payment capture in your Razorpay dashboard. The backend calculates prices and coupon discounts, creates INR orders and verifies signatures and captured payment details before marking an order paid. Live payments require your activated Razorpay account and live keys. Set `COOKIE_SECURE=true` for HTTPS production.

`ALLOWED_ORIGINS` is a comma-separated list of explicit HTTP(S) origins, including the port when needed. Its default is `http://localhost:5173,http://127.0.0.1:5173`; replace it with the production origin when deploying. Wildcards, credentials and URL paths are rejected. An empty list disables cross-origin access. `SESSION_HOURS` controls new session expiry and cookie lifetime (positive integer, default `24`); existing sessions retain their expiry. `FIREBASE_PROJECT_ID` supplies the server project ID for Google-token verification. It is optional while only existing password login is in use. `PYTHON_DOTENV_DISABLED=1` skips local dotenv loading, useful for deployments with injected environment variables and for isolated tests.

The previous backend example contained populated admin credentials; it now contains placeholders only. If that password was used, rotate it. Changing startup environment variables alone does not update an existing user's password in SQLite.

Coupons: `VASTRE10` gives 10% off orders of ₹4,499 or more; `WELCOME5` gives 5% off. All enquiries link to WhatsApp at +91 7019023964.

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/), create/select the project. In Authentication → Sign-in method, enable Google and select a support email.
2. In Authentication → Settings → Authorized domains, keep `localhost` and add your real production domain. Domain entries do not include a scheme or port.
3. Register a Web app in Project settings and copy its web configuration into `frontend/.env`, using `frontend/.env.example` for the four `VITE_FIREBASE_*` names. Preserve an existing local file. Restart Vite after changing environment variables. These are public web configuration values; never put an admin password, Razorpay secret or service-account key in any `VITE_*` variable.
4. Set the matching `FIREBASE_PROJECT_ID` in the backend process environment or `backend/.env`. No service-account file is needed for the token verifier.
5. Use **`http://localhost:5173`**, not `127.0.0.1`, for Google sign-in testing. Install frontend dependencies with `npm install` from `frontend` if needed.

The modular Firebase singleton uses `prompt: "select_account"` and in-memory persistence. Initialization is loaded separately from the storefront bundle. Missing configuration lists the exact missing `VITE_FIREBASE_*` names and leaves password login usable. SDK v12.19.0 is pinned for Node 22. Google login, backend token exchange, and Account Profile/Security are implemented; see the Phase 8 flow and manual acceptance checks below.

Implementation follows [Firebase web setup](https://firebase.google.com/docs/web/setup) and [auth persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence). Dotenv precedence and its disable switch follow the [python-dotenv documentation](https://pypi.org/project/python-dotenv/).

Run backend checks with `.venv\Scripts\python.exe -m pytest backend/test_store.py backend/test_config.py -q`. Tests use a temporary SQLite database and disable local dotenv loading. `npm run test:smoke` from `frontend` builds and starts the real app with temporary storage, then exercises the existing purchase flow using a simulated external Razorpay provider. It does not make a real payment. No migration runs in authentication Phase 1; existing users and orders remain on their original schema.

## Authentication database migration (Phase 2)

Backend startup now calls `backend/migrations.py`. It initializes fresh databases and upgrades existing SQLite tables in a single transaction, using `PRAGMA table_info` to add only missing columns. No table is dropped or rebuilt. Google subjects use a unique index because [SQLite does not support `ADD COLUMN ... UNIQUE`](https://www.sqlite.org/lang_altertable.html); multiple unlinked users can have NULL subjects. Existing IDs, roles, salts/password hashes, session token hashes/expiries and complete order records are preserved. Original session tokens remain valid until their original expiry.

Users gain `google_sub`, `picture`, `auth_provider`, `email_verified`, `disabled`, `created_at` and `last_login_at`. Legacy accounts default to `password`, unverified and enabled. Unknown historical timestamps stay NULL. Sessions gain opaque unique device IDs, timestamps, a user agent (at most 200 characters) and peer IP (at most 45 characters). New registrations/logins fill the new metadata; the app reads `request.client` rather than forwarded headers directly. The existing token primary key and hashed-at-rest cookie authentication remain unchanged. The new `audit_log` table is ready for the security event writers in later phases.

Password login rejects NULL salt/password rows with exactly `401 {"detail":"Incorrect email or password."}`, matching unknown emails and wrong passwords. API response shapes, password hashing, payment handlers and order ownership behavior are unchanged. Google sign-in/token verification is not implemented in Phase 2.

Run all backend tests with `.venv\Scripts\python.exe -m pytest backend -q`. To verify the migration twice on a **temporary copy** of an original-schema backup:

```powershell
.venv\Scripts\python.exe -m backend.verify_migration --source backend/store.db.bak
```

The verifier opens the source read-only, uses SQLite's backup API to create a consistent temporary copy, and migrates only that copy. It compares every original value and row ID, then verifies the second run changes neither schema nor rows, and runs an integrity check. It prints only row counts and pass indicators, never account/credential/session/order contents. The temporary copy is removed afterwards. Use a pre-migration backup as the source; a migrated source is rejected. Both the live database and its backup files are ignored by version control.

The verified backup in this workspace contained two users (one admin), no sessions and no orders. Separate original-schema fixtures with two users, three sessions (including an expired session) and two orders also passed both migrations, and real app tests confirm the old cookies and customer/admin passwords still work. See `AUDIT.md` for the Phase 2 results.

## Google authentication backend (Phase 3)

`POST /api/auth/google` accepts `{"id_token":"<Firebase ID token>"}`. Set `FIREBASE_PROJECT_ID` to the same project used by the web app; a missing project ID fails closed. The server uses [`google.oauth2.id_token.verify_firebase_token`](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html) with an explicit audience and checks the issuer, audience, expiry, Google provider, verified email and subject. No service-account key is needed. Use a Firebase ID token from Firebase Auth, rather than a Google OAuth access token.

Verified subjects identify returning users. A verified, lower-cased email can link an existing password account, retaining its ID, name, password, role and orders. Conflicting existing Google subjects are rejected. New accounts always have role `user`, provider `google` and NULL password credentials. Client role fields and role claims are ignored; existing provisioned admins retain their role, and Google login cannot create or promote an admin. Disabled accounts receive `403 {"detail":"This account has been disabled."}` before any writes.

Linking, fresh hashed session creation, `last_login_at` and `google_link`/`google_login` audit events commit together. Cookies retain the existing HttpOnly, SameSite=Lax, configured lifetime and `COOKIE_SECURE=true` behavior. The response is `{id,name,email,role,picture}`; `/api/auth/me` additionally includes `picture`, `auth_provider` and `email_verified`. Invalid credentials or provider verification errors return only `401 {"detail":"Google sign-in failed. Please try again."}`. Raw ID tokens, passwords, session cookies and provider errors are never logged or written to the audit log.

Test this endpoint **without a real Google token**, from the repository root:

```powershell
.venv\Scripts\python.exe -m pytest backend/test_google_auth.py -q
```

These tests POST dummy `id_token` values through the real ASGI endpoint while mocking `backend.google_auth.id_token.verify_firebase_token`. They check successful/repeated login, verified linking, ignored admin claims, disabled accounts, invalid claims, safe errors, credential-free logs, cookie policy and atomic rollback. Endpoint tests run in isolated child processes with temporary SQLite databases, dotenv disabled and Google's network transport blocked. No Firebase credentials or external Google calls are required. A dummy token sent to the normally running server is rejected; no test bypass exists in the application.

The UI remained unchanged in Phase 3. The Google button and redirect fallback arrive in frontend Phase 6 and will use this same endpoint. Phase 4 hardening is described below.

## Authentication hardening (Phase 4)

All state-changing `/api/*` requests now require `X-Requested-With: vastre` and an exact trusted `Origin`, falling back to `Referer` only when Origin is absent. Trusted origins are `ALLOWED_ORIGINS` and the app's own origin. Missing, null or foreign origins are rejected. This also protects login from login CSRF. The frontend `api()` wrapper sends the header automatically for POST and DELETE; the browser supplies Origin. Non-browser API callers must supply both headers. Credentialed CORS includes friendly error responses and exposes `Retry-After`. Cookies remain HttpOnly, SameSite=Lax and Secure when `COOKIE_SECURE=true`.

Limits and login failures are stored in SQLite, shared between workers and retained across reloads. Login uses IP + normalized email, registration/Google use IP, and lockout uses normalized email regardless of whether the account exists. Unknown, wrong-password, disabled and Google-only password logins receive the same generic password error. Ten failed logins in the default window start a 15-minute lockout; subsequent groups of ten increase it to 30, then at most 60 minutes. Throttled/locked requests return a friendly 429 and `Retry-After` in seconds. Successful password login clears that email's failure counter. Hashes, not raw emails/IPs, identify throttle buckets.

### New environment variables and defaults

All numeric limits/durations must be positive integers. Restart after changing configuration; existing buckets keep their original expiry until cleared or expired.

| Variable | Default | Meaning |
| --- | --- | --- |
| `LOGIN_RATE_PER_MIN` | `5` | Login requests per IP + email per 60-second window |
| `REGISTER_RATE_PER_HOUR` | `5` | Registrations per IP per hour |
| `GOOGLE_RATE_PER_MIN` | `20` | Google exchanges per IP per minute |
| `LOGIN_LOCKOUT_FAILURES` | `10` | Failed attempts per lockout escalation |
| `LOGIN_LOCKOUT_MIN` | `15` | Initial lockout, minutes |
| `LOGIN_LOCKOUT_MAX_MIN` | `60` | Maximum escalated lockout, minutes |
| `LOGIN_FAILURE_WINDOW_MIN` | `60` | Failure-counter window; an active lockout is never cleared early |
| `ADMIN_IDLE_MIN` | `30` | Admin session idle timeout, minutes |
| `REQUIRE_VERIFIED_EMAIL` | `false` | Opt-in email verification requirement at checkout |
| `EMAIL_VERIFICATION_HOURS` | `24` | Verification-link lifetime |
| `EMAIL_VERIFICATION_RATE_PER_HOUR` | `3` | Resend requests per signed-in user per hour |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Public app origin used in verification links |
| `CSP_MODE` | `enforce` | `report-only` or `enforce`; no disabled mode |
| `SMTP_HOST` | empty | Optional SMTP server; empty selects the development console adapter |
| `SMTP_PORT` | `587` | SMTP TCP port |
| `SMTP_USERNAME` | empty | Optional SMTP authentication username |
| `SMTP_PASSWORD` | empty | Optional SMTP authentication password; backend only |
| `SMTP_FROM` | `no-reply@vastre.example` | Sender; configure a real permitted sender for SMTP |
| `SMTP_STARTTLS` | `true` | Upgrade SMTP transport with a verified TLS context |

Existing `SESSION_HOURS` (24), `COOKIE_SECURE`, `ALLOWED_ORIGINS` and Firebase/payment settings retain their behavior. No new frontend environment variables or packages are required. Keep SMTP credentials in the backend environment, never in `VITE_*` variables or version control.

### Reset development limits without logging anyone out

From the repository root, with the same backend environment/database selection:

```powershell
.venv\Scripts\python.exe -m backend.reset_auth_limits
```

This local CLI clears only existing `auth_limits` and `auth_failures` tables, including resend throttles. If the database predates Phase 4, it safely reports that no limits exist yet; start or restart the backend to initialize the new tables. It also handles partial upgrades and never creates a missing database or runs migrations itself. Users, credentials, sessions, verification links and orders are unchanged. There is no HTTP reset endpoint. The CLI refuses to run with `COOKIE_SECURE=true`; do not change production settings to bypass that guard. In development you can temporarily choose, for example, `LOGIN_RATE_PER_MIN=50` and `LOGIN_LOCKOUT_MIN=1`, then restart and clear already-existing buckets with the command above. Ordinary restarts intentionally do not reset persistent limits. Tests always use temporary databases and never run the reset against `backend/store.db`.

### Sessions, passwords and verification

Startup and login cleanup delete only sessions whose absolute expiry has passed. Currently valid session hashes/expiries survive. Separately, admin sessions expire after the configured idle interval; legacy NULL last-seen timestamps initialize on first authenticated use. Password changes and account disabling revoke all sessions atomically through additive SQLite triggers. Session issuance rechecks the account and password inside the write transaction so a concurrent disable/password change cannot issue a stale session.

New endpoints, using the same session cookie:

- `GET /api/auth/sessions`: this user's device IDs, timestamps, agent/IP and `current` flag; no raw tokens or token hashes.
- `DELETE /api/auth/sessions/{id}`: revoke an owned session; another user's device returns 404.
- `POST /api/auth/logout-all`: revoke all this user's sessions, including the current one.
- `POST /api/auth/change-password`: `{current_password,new_password}` for password accounts. Google-only accounts require `id_token` instead of current password.
- `POST /api/auth/set-password`: `{id_token,new_password}` for Google-only accounts. The verified subject must match, and Google's `auth_time` must be within five minutes. A refreshed token with an old authentication time is insufficient.
- `POST /api/auth/delete-account`: `{current_password}` for password accounts or `{id_token}` with fresh Google re-authentication for Google-only accounts. Anonymizes the user, revokes sessions and verification links, and keeps the user ID and order records for accounting. Admin accounts cannot be deleted here. The danger-zone UI arrives in Phase 6.
- `POST /api/auth/send-verification`: request a new verification email for the signed-in user.
- `POST /api/auth/verify-email`: `{token}`; a hashed-at-rest, single-use, expiring verification token.

New passwords require 10–128 characters and reject a small common-password list. Existing passwords, including legacy 8-character passwords, keep working at login with the unchanged PBKDF2 algorithm. Password changes revoke every session and require login again. Generic validation responses never echo credential input. Register/login/logout and password/security events are audited without credentials or provider error strings. Existing registration/login success response shapes remain intact; duplicate registration now uses a generic 400 detail message.

New password registrations receive a verification email. The Account banner can resend it, and `/verify-email#token=...` provides explicit confirmation. The fragment avoids putting the verification token into HTTP access logs/referrers; resending invalidates the previous link. Console delivery is development-only when SMTP is unconfigured and `COOKIE_SECURE` is false. With `COOKIE_SECURE=true`, configure SMTP: links are never printed in production. SMTP failures are redacted, registration remains usable, and resend returns a friendly 503. The console adapter logs only verification emails, never ID tokens, passwords or session tokens. **`REQUIRE_VERIFIED_EMAIL=false` remains the default**, so existing customers can still check out. Enabling it requires verified email before payment-order creation.

### CSP rollout and checks

The policy was first tested using `Content-Security-Policy-Report-Only`, then switched to **enforcing** `Content-Security-Policy` and tested again. Live dependency testing identified Razorpay's additional `cdn.razorpay.com` risk-detection bundle; that specific script host is allowed. The final script policy does not allow inline scripts or eval. Theme initialization is a local `/theme.js` file. Inline styles remain allowed for existing React style attributes. The policy allows the required Firebase/Google scripts, frames and connections, Razorpay checkout/API/telemetry, Google Fonts, Unsplash images and Google avatars. Security headers include nosniff, DENY framing, strict-origin-when-cross-origin referrers, limited permissions, and `Cross-Origin-Opener-Policy: same-origin-allow-popups`; HSTS is emitted only with `COOKIE_SECURE=true`.

The deployed backend serves these headers on the built storefront. Vite's development HTML server does not apply the backend CSP. If hosting static HTML elsewhere, configure the same policy at that host; API response headers cannot protect HTML served by another server. The custom-header/origin checks follow [OWASP's CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html); policy rollout follows [OWASP's CSP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

Run the backend and frontend checks:

```powershell
.venv\Scripts\python.exe -m pytest backend -q
cd frontend
npm.cmd run test:unit
npm.cmd run test:smoke
$env:CSP_MODE='report-only'
npx.cmd playwright test --config playwright.security.config.js
$env:CSP_MODE='enforce'
npx.cmd playwright test --config playwright.security.config.js
Remove-Item Env:CSP_MODE
npx.cmd playwright test verification.spec.js account.spec.js firebase.spec.js admin.spec.js
```

The security browser suite serves the built app with real local APIs and a temporary database. It checks all pages at 375/768/1280px in light and dark mode, including the new banner. It loads the live public Razorpay script, Google API script, Google Fonts and Unsplash; deterministic transport fixtures cover Google/Firebase popup/frame/connect domains. A negative control proves an unlisted script is actually blocked under enforcement. The dependency probe runs once per policy mode, so the other five copies are intentionally skipped. The compatibility fixture raises only its registration allowance to 100 to create viewport test accounts; backend tests verify the default production limits separately. Purchase smoke simulates external Razorpay, while the local quote/order/verification/Account flow is real. Interactive Google identity sign-in remains for frontend Phase 6; popup-domain compatibility is not a claim of completing a real Google login.

Phase 4 is complete. Phase 5 authorization and admin user management are described below.

## Authorization and admin users (Phase 5)

Protected routes now use FastAPI dependencies: `current_user` resolves a valid, enabled session; `require_permission` checks the explicit capability map; every admin endpoint uses `require_role('admin')`. This follows [FastAPI's dependency model](https://fastapi.tiangolo.com/tutorial/dependencies/). Role values are read from SQLite on requests, never from client identity claims. Existing admin provisioning, password hashes, cookies and stored role values are preserved. `user` is an alias of canonical `customer`; no legacy role backfill is required.

| Role | Allowed actions |
| --- | --- |
| Anonymous | Public catalogue/categories/coupons, checkout quotes and sign-in/registration; protected actions require a session |
| `customer` / legacy `user` | `account:self`, `orders:own`, `checkout:own`: own profile/session/password/verification controls, own order list/detail and own checkout/payment verification; fresh credentials still required for sensitive actions |
| `support` | Same own-account/order/checkout permissions for now; no cross-customer or admin tools |
| `admin` | Customer actions plus `admin:overview`, `admin:users:read`, `admin:users:write`: dashboard/all-order overview and guarded user management |
| Unknown role | No capabilities; protected actions fail closed. Identity lookup/logout remain available |

Disabled/expired sessions return 401. Authenticated users without the necessary role/capability receive 403. Admins can see all orders through the existing admin overview, while the customer-facing order endpoints remain owner-only even for admins. `GET /api/orders/{order_id}` returns the same `404 {"detail":"Order not found."}` for a nonexistent order and an order owned by someone else. Payment verification checks ownership before invoking the payment provider. Razorpay amounts, signatures, capture verification and endpoint response shapes remain unchanged.

### Users dashboard and API

The new linkable `/admin/users` tab uses the existing dashboard shell, tokens, dark mode, desktop sidebar and mobile tab strip. It provides debounced name/email search, role/status/provider filters, server pagination, last-login dates (or “Not available” for unknown legacy timestamps), desktop table/mobile cards, and loading/empty/retry states. Filters and pagination live in the URL; refresh/back/forward work, including when an edit removes the last row from a filtered page. User loading is independent of the overview API.

- `GET /api/admin/users?page=1&page_size=20&search=...&role=...&status=...&provider=...`: paginated sanitized users, `total`, `page`, `page_size`, `pages`, `active_admins`. Page size is 1–100; search matches literal name/email text. Customer filtering includes both `user` and `customer`. Status is `active`/`disabled`; provider is `password`/`google`/`both`. Empty filters mean all.
- Public user fields in this admin response: `id`, `name`, `email`, `role`, `disabled`, `auth_provider`, `email_verified`, `created_at`, `last_login_at`. No salts, password hashes, Google subjects, session tokens or token hashes are returned.
- `PATCH /api/admin/users/{id}` accepts an optional `role` (`user`, `customer`, `support`, `admin`) and/or boolean `disabled`; unknown fields and invalid/null values are rejected. This authenticated, guarded admin endpoint is the only client role-assignment interface. Public registration/login/Google requests still ignore role fields, and Google sign-in never creates or promotes an admin.

Every UI role/status action opens a confirmation dialog showing the account and proposed change, with Cancel focused first, trapped focus, Escape and an explicit confirm button. Confirmation errors keep the proposed action visible and offer refresh/retry. The UI disables own-admin/last-admin controls; the backend independently enforces the rules.

An admin cannot demote or disable themselves. The last **enabled** admin cannot be demoted or disabled. A single serialized SQLite write transaction rechecks the actor's current session/role, counts active admins, applies changes, revokes every target session and writes audit events. Concurrent admins cannot remove the last active admin. Each real role change logs `role_change`; status changes log `account_disabled`/`account_enabled`, with target ID, actor ID and old/new values. No-op requests do not revoke sessions or create change events. Admin access denials, including anonymous/non-admin access and CSRF failures, are audited without credentials or request bodies.

### Phase 5 checks

```powershell
.venv\Scripts\python.exe -m pytest backend -q
cd frontend
npm.cmd run test:unit
npm.cmd run test:smoke
npx.cmd playwright test admin-users.spec.js admin.spec.js
npx.cmd playwright test --config playwright.admin.config.js
npx.cmd playwright test --config playwright.admin-smoke.config.js
npx.cmd playwright test --config playwright.security.config.js
```

Backend tests use temporary SQLite and cover legacy admin/customer login, role aliases, denied access/audits, sanitized pagination/search, owner-only order detail/payment verification, self/last-admin guard rails, concurrency, auditing and session revocation. The admin smoke config starts an explicitly disposable fixture (`VASTRE_ADMIN_SMOKE_FIXTURE=1`, test-only) with public fixture credentials and verifies the browser UI against real local APIs. These fixture accounts are never created by the production app or in `backend/store.db`. Public dependency tests use enforcing CSP; SMTP and payment-provider operations remain mocked. No new production environment variables, packages or database migration are required in Phase 5.

Phase 5 is complete. The Phase 6 implementation is described below.

## Google authentication — Phase 6

The existing Login/Register page now offers Google sign-in above the password form. `/admin/login` deliberately remains password-only. Both sign-in methods are disabled during an active request. A blocked popup falls back to Firebase redirect sign-in, and `getRedirectResult` resumes the saved internal `next` destination once, including under React StrictMode. Closing the popup is silent. Network, disabled-account, rate-limit, unverified-email and unauthorized-domain failures have friendly inline messages; raw Firebase errors are not displayed.

Firebase uses in-memory persistence. Immediately after the backend session exchange, Firebase is signed out before React receives the user or navigates. The app's HttpOnly session cookie is authoritative. ID tokens and passwords are never placed in browser storage or logs. Redirect storage contains only a return path or the requested security action. Sensitive redirect confirmation holds the fresh credential in transient memory for at most four minutes, consumes it once, and clears it on cancellation/unmount; the password must be entered again after redirect.

Account retains Overview, Orders, Wishlist and Addresses, and adds Profile and Security. Profile shows a Google photo or initials, sign-in methods, verification/resend and an editable name. The additive `PATCH /api/auth/profile` accepts only a name (1–80 characters after trimming), updates the current user and audits the change; email, role and provider cannot be changed here. Security lists/revokes devices, supports logout-all, password change/setup and confirmed deletion. Password accounts must supply the current password; Google-only accounts must freshly authenticate with Google. The backend independently verifies identity, freshness and ownership. Password changes revoke all sessions. Deletion anonymizes the customer and preserves accounting orders; admin deletion remains blocked.

`RequireAuth` preserves the full destination in `/login?next=...`; `RequireRole` protects admin routes and sends anonymous visitors to `/admin/login?next=...`. Protected API 401 responses clear AuthContext and redirect once with “Your session expired, please log in again”; 403 responses show Access denied. Expected anonymous `/auth/me` bootstrap and incorrect sign-in/re-authentication credentials remain in their forms. A failed sensitive credential is followed by a session check, so an expired cookie still redirects. Existing CSRF headers/cookies, endpoint contracts and Razorpay payment logic are unchanged.

No packages, production environment variables or database migration were added in this phase. All four required Firebase settings were present: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. If any are absent/placeholder values, the page lists their exact names, disables Google sign-in, and keeps password sign-in available. Restart Vite after editing its environment. Optional Firebase Analytics/Storage settings are not needed for authentication.

### Manual real Google sign-in check

1. In Firebase Console → Authentication → Settings → Authorized domains, ensure **localhost** is listed. The backend `FIREBASE_PROJECT_ID` must match the frontend Firebase project. A hostname error explains this setting and points to `http://localhost:5173`. Firebase's [Google sign-in instructions](https://firebase.google.com/docs/auth/web/google-signin) describe project setup.
2. Start the isolated backend and frontend using the Phase 8 manual-test launcher below. Expected: backend on port 8000 and Vite at **http://localhost:5173**. Use localhost, not 127.0.0.1, for this Google check; do not use the live store database.
3. Open `http://localhost:5173/login?next=%2Faccount%3Ftab%3Dprofile` in a signed-out browser window. Expected: the multicolour Google button above the email form, both existing auth tabs and no configuration warning.
4. Click **Continue with Google**, choose your Google account and finish Google's consent. Expected: Google opens a popup, then it closes; the backend exchanges the Firebase ID token for `vastre_session` and you land on `/account?tab=profile`. The name/email, Google badge, verified status and avatar/initials should appear. A repeat sign-in should reuse the same customer and orders.
5. Refresh the page. Expected: you remain signed in through the app cookie. In Vite's browser console, `(await import('/src/firebase.js')).auth.currentUser === null` should be **true**. In DevTools Application → Cookies, `vastre_session` should be HttpOnly and SameSite=Lax (Secure in HTTPS production). Do not copy tokens/cookies into logs or messages.
6. Edit the Profile name and save, then refresh. Expected: a success toast, saved name and updated header. Open Security: expected active devices, logout controls and **Set a password** for a Google-only user. Setting a password requires Google confirmation and logs out all devices; the new password then works at the ordinary login form, and Profile shows both providers. Use a disposable account for deletion testing: confirmation requires the current password or fresh Google identity, ends the app session and removes the personal profile while orders remain server-side for accounting.
7. Sign out, reopen Login, click Google and close its popup. Expected: no error toast, no session, and both sign-in buttons enabled again. Block popups and retry: expected full-page Google redirect and return to the saved `next` page. Browsers that block third-party storage can prevent Firebase redirect completion; the UI explains recovery. Enable popups or follow Firebase's [redirect deployment guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices) for a production custom domain.
8. While signed out, open `/account?tab=orders`. Expected: `/login?next=%2Faccount%3Ftab%3Dorders`, then Orders after sign-in. As a normal customer open `/admin`: expected **Access denied**. Open `/admin/login`: expected **no Google button**. Revoke the current session from another device and request Account data: expected one session-expired toast and Login with `next` preserved.
9. With Razorpay **test** configuration, sign in with Google, browse → select a size → add to bag → apply a coupon → enter the structured address → complete test checkout. Expected: Order confirmed, then the paid order under Account → Orders. The automated smoke uses real temporary local APIs and simulates only the external payment transport; it does not charge a card.

### Phase 6 checks

```powershell
.venv\Scripts\python.exe -m pytest backend -q
cd frontend
npm.cmd run test:unit
npm.cmd run test:smoke
npx.cmd playwright test
npx.cmd playwright test --config playwright.auth.config.js
npx.cmd playwright test --config playwright.security.config.js --project=1280-light
```

The auth browser config uses `http://localhost:5173`, mocked Firebase modules and public fixture credentials; it never bypasses token verification in production. Layout checks cover Login, Profile and Security at 375/768/1280px in light/dark. Behavioral cases run once to avoid duplicating identical mocks across six layouts. An optional real popup-entry probe (no credentials or session exchange) can be run with `$env:VASTRE_REAL_GOOGLE_ENTRY='1'; npx.cmd playwright test --config playwright.auth.config.js --project=375-light --grep 'real Google popup entry'`; remove the variable afterward. The real Google identity/session/purchase steps above still require your account interaction.

Phase 6 results are recorded here; Phase 7 validation is recorded below.

Phase 6 verification: backend **72 tests + 25 subtests**, frontend unit **26**, existing browser regressions **136** (134 initially, two corrected regressions passed on rerun), mocked auth checks **26** including six size/theme layouts, purchase smoke **2**, enforcing CSP **2**. The opt-in real popup probe reached `accounts.google.com` from localhost and returned silently after closing. Full real Google identity/session exchange and a Google-authenticated Razorpay purchase require the manual account interaction above; they are not claimed as automated successes. Build passed without Vite warnings. No `.env` values or live database were changed, and no new credential logging was added.

## Shared-browser storage isolation

Cart, wishlist and saved addresses now use `vastre-cart:guest` / `vastre-cart:u123` (and equivalent wishlist/addresses keys), keyed by the authenticated user ID. Old unscoped keys migrate to guest data and are removed after successful persistence. Previously account-scoped address keys such as `vastre-addresses:123` migrate only to that same account's `:u123` key. Password and Google login share the same owner transition: guest cart items merge by product/size using the greater quantity, capped at 10; wishlists merge by union; the consumed guest cart/wishlist are cleared and guest addresses are discarded. User-owned stored data remains available when that user returns.

Changing owner, logging out or expiring the session resets the active cart/wishlist/address state, drawers and checkout form/quote/coupon state before the new owner's UI renders. A pending response from the old checkout cannot populate the new session. Guest checkout fields and coupon quotes therefore must be entered/applied again after login; the purchase smoke verifies this behavior. Malformed-cart recovery, unavailable-product removal and blocked-storage support remain intact. This is frontend-only; backend APIs and payment logic were unchanged.

Theme and announcement dismissal remain browser-wide, low-risk preferences. Recently viewed product IDs also remain browser-wide and can reveal shopping interests, so they are a modest browsing-privacy concern. Google redirect session storage contains only a destination/action. Per-owner localStorage prevents accidental cross-account display; it is not encryption, and someone with access to the browser's storage/DevTools can still read retained account data, including addresses.

Checks: `npm.cmd run test:unit`, `npx.cmd playwright test owner-storage.spec.js`, and `npm.cmd run test:smoke`. The owner regression covers password A → logout → Google B → logout → A without a page reload, guest migration/merge, 401 with a late coupon response, and direct authenticated user-ID changes with an open cart drawer. No Google-auth Phase 7 work was started.

## Google authentication — Phase 7 test suite

Run these commands from the repository root, in this order:

```powershell
.venv\Scripts\python.exe -m pytest backend -q
Push-Location frontend
npm.cmd run test:unit
npm.cmd run test:browser
npm.cmd run test:smoke
npx.cmd playwright test --config playwright.admin-smoke.config.js
Pop-Location
```

`test:browser` runs both the complete existing desktop/mobile regression suite and the mocked Firebase suite at `http://localhost:5173`. The latter checks Login/Profile/Security at 375/768/1280px in light/dark; identical behavioral cases run once. The real popup-entry probe is opt-in and skipped by default. It does not supply a Google identity. The purchase/admin smokes start separate disposable backend fixtures, never reuse a development backend, and use temporary SQLite databases. Google verification/Firebase SDK interactions and external payment transport are mocked where needed; no production verification bypass is present. No new packages are needed.

Backend pytest sets a temporary fallback `VASTRE_DB` before collection, disables dotenv/admin bootstrap/SMTP for the run, and rejects SQLite connections outside the temporary directory tree, explicitly including `backend/store.db`. Isolated child-process tests also assert their database is under their own temporary root before importing the app. **Do not point any test or migration verification command at `backend/store.db`.** Tests generate independent original-schema fixtures; they do not copy customer data from the live store or its backup.

Each backend case has one primary area; parametrized inputs are counted individually, nested subtests separately. The terminal prints the same area totals. Select an area, for example, with `.venv\Scripts\python.exe -m pytest backend -m migration -q`.

| Backend area | Cases | Coverage |
| --- | ---: | --- |
| Google auth | 25 | Create/repeat, verified-only linking, unchanged existing roles/passwords/orders, ignored client admin claims, Google-created customer gets admin overview 403, invalid/unverified/wrong-audience/expired/wrong-provider tokens, disabled Google account, safe errors/logs, cookie policy and rollback |
| Rate limiting / lockout | 6 | Threshold 429 + Retry-After, scoped login/register/Google limits, progressive lockout/recovery, identical known/unknown responses, safe development reset |
| CSRF | 9 | Missing custom header/foreign Origin rejected for auth, profile PATCH, session DELETE and payment POST before handlers; valid Origin/Referer and localhost requests accepted |
| Sessions / credential hardening | 8 | Owned private device lists/revocation, expiry/idle cleanup, disabled password login and old-cookie replay, fresh Google re-auth, password rules/races, logout-all and password change invalidate both devices' cookies |
| RBAC / ownership | 11 | Anonymous 401/customer 403/admin 200, role aliases, other users' orders return indistinguishable 404, admin self/last-admin guards, concurrent changes, audits and session revocation |
| Migration / legacy compatibility | 11 | Original DDL → migrate twice; source bytes/rows/rowids unchanged, metadata, nullable passwords/unique subjects, partial/failed/concurrent/fresh upgrades, old passwords/admins/cookies/orders preserved |
| Other compatibility / isolation | 16 | Config, legacy catalogue/payment contracts, email verification/delivery, deletion/profile and the live-database guard |
| **Backend total** | **86 + 25 subtests** | No real Google token or live database required |

The original-schema fixture contains **2 users (including an admin), 3 sessions and 2 orders**. The migration-copy test verifies identical counts and original columns after each of two migrations, a zero-change second run, integrity `ok`, and an unchanged source-file digest. The legacy-auth integration tests additionally confirm that startup expires only expired sessions while valid customer/admin cookies, password login and order ownership continue to work.

Frontend coverage consists of **33 unit cases**, **144 existing/owner-isolation browser cases**, **28 mocked auth browser cases**, **2 purchase smokes** and **2 real-API admin smokes**. Google coverage includes popup success/cancel/block → redirect/resume, loading/duplicate-submit guards, network/disabled/rate/unverified/domain errors, generic backend 401 staying inline, immediate Firebase sign-out, missing config names, no Google button on admin login, RequireAuth/RequireRole/next redirects, session-expiry 401 and 403 pages. Existing account/address/wishlist/cart recovery and shared-browser owner isolation remain covered. Repeat layout copies of behavioral tests and the optional real popup probe are intentionally skipped, not counted as passes.

### Phase 7 manual checklist (temporary database only)

Full real Google identity/consent, real browser redirect storage policies, actual SMTP delivery and real Razorpay test-gateway interaction need external accounts/services. Their SDK/API behavior is simulated automatically; the suite does not claim a real identity or gateway settlement.

Stop any ordinary development backend on port 8000 before starting this **separate temporary test setup** in a fresh PowerShell terminal:

```powershell
$env:VASTRE_DB = Join-Path ([IO.Path]::GetTempPath()) ("vastre-manual-" + [guid]::NewGuid().ToString() + ".db")
$env:PYTHON_DOTENV_DISABLED = '1'
$env:COOKIE_SECURE = 'false'
$env:ALLOWED_ORIGINS = 'http://localhost:5173'
$env:SMTP_HOST = ''
$env:ADMIN_EMAIL = ''
$env:ADMIN_PASSWORD = ''
.venv\Scripts\python.exe -m uvicorn backend.app:app --host localhost --port 8000
```

Use the already configured `FIREBASE_PROJECT_ID` in this terminal; because dotenv is disabled, it must be present in this process environment. Start Vite in a second terminal with `cd frontend` and `npm.cmd run dev -- --host localhost`. Firebase must authorize **localhost**. Use a fresh browser profile/window and open **http://localhost:5173**. This setup does not read or migrate `backend/store.db`. Close the temporary backend terminal afterward so its environment overrides do not carry into normal development.

| Manual action | Expected result |
| --- | --- |
| Open `/login?next=%2Faccount%3Ftab%3Dprofile`, click Google and complete account/consent | Arrive on Profile with verified Google identity; reload stays signed in through the app cookie. `(await import('/src/firebase.js')).auth.currentUser === null` is true in Vite |
| Sign out, start Google again, close popup | No error toast/session; sign-in controls become enabled after Firebase cancellation polling |
| Block popups and retry Google | Full-page redirect fallback returns to the saved next page. If third-party storage prevents completion, recovery message appears; verify the target browser's popup/storage settings |
| Sign out and open `/account?tab=orders` | Login retains `next`; after Google/password login, Orders opens |
| Sign in on two devices/windows; log out all devices from one, then load protected data in the other | One session-expired toast, cleared cart/address/coupon UI, redirect to Login with next; stale cookies no longer authorize |
| As the Google-created customer, open `/admin` and `/admin/login` | Access denied on admin dashboard; admin login has no Google button |
| Supply Razorpay **test** credentials in the temporary backend process, add a sized product and complete test checkout | Re-enter address/apply coupon after login, see Order confirmed, then a paid order in Account; no real-money charge |
| If checking SMTP, use an explicit test mailbox/SMTP service with the temporary backend | Verification email arrives, single-use link updates verification; never use production recipients or expose the link/token in reports |

Phase 7 stops after these tests and their report. Phase 8 is not started.

Phase 7 run result: **86 backend tests + 25 subtests passed; 33 frontend unit tests passed; 144 storefront browser regressions and 28 mocked Firebase browser cases passed; 2 purchase and 2 real-API admin smokes passed.** The 116 auth-suite skips are 110 redundant behavioral layout copies plus 6 opt-in real-popup probes, not missing automated contract coverage. The original-schema copy was migrated twice with no original rows lost. No test opened `backend/store.db`; no production auth/payment implementation was changed.


## Google authentication Phase 8 documentation and final security checks

### Authentication flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Firebase Google popup
    participant A as Vastre backend
    participant D as SQLite
    B->>F: Google consent (popup / redirect fallback)
    F-->>B: Firebase ID token (memory only)
    B->>A: POST /api/auth/google + CSRF header + Origin
    A->>A: Verify signature, issuer, audience, expiry, Google provider, verified email
    A->>D: Link verified email or create customer; store session hash
    A-->>B: HttpOnly SameSite=Lax session cookie (Secure on HTTPS)
    B->>F: signOut immediately after backend response
    B->>A: Subsequent requests use app cookie only
```

Google never assigns/promotes an admin. Client roles are ignored, existing roles are preserved, and password-account linking requires verified Google email. Password login uses the same generic failure for unknown, Google-only and incorrect-password accounts. There is no production mocked-verifier bypass. Tests substitute the verifier only inside isolated test processes.

### Security settings: local observation, defaults and production action

Observed on 2026-10-20 by loading **configuration only**, without importing the app or opening the live database. These are this checkout's local effective values, not measurements of a deployed server. Process environment overrides `backend/.env`. All configurable limits below currently match their defaults. Positive integer settings reject zero/negative values. `COOKIE_SECURE` requires the exact lowercase string `true`.

| Setting / control | Current local value (default where relevant) | Production action |
| --- | --- | --- |
| `vastre_session` cookie | HttpOnly; SameSite=Lax; host-only (no Domain); Path=/; Max-Age=86400 | Keep; serve UI/API on the same HTTPS origin. Never expose cookie to JavaScript. |
| `COOKIE_SECURE` | `false` (unset also behaves as false) | **`true`**; verify Secure in actual Set-Cookie behind proxy. |
| `SESSION_HOURS` | `24`; absolute session expiry, not sliding | Keep or shorten for risk; changing it affects newly issued sessions. |
| `ADMIN_IDLE_MIN` | `30`; valid legacy NULL last-seen initializes on use | Keep; verify expiry after inactivity. Customer sessions have no separate idle timeout. |
| Session cleanup / revocation | Deletes expired sessions only; logout/revoke/credential change/role or status change invalidates affected sessions | Keep; valid sessions survive cleanup. Backups contain hashes, still protect them. |
| Session credentials | Random URL-safe 32-byte token, SHA-256 at rest; no app token in localStorage | Keep; protect DB and server filesystem. |
| Passwords | PBKDF2-HMAC-SHA256, 600000 rounds, random 16-byte salt; new passwords 10-128 characters plus common-password rejection; legacy login remains compatible | Use password manager-generated admin secrets, preferably 20+ characters. No password MFA is implemented. |
| Google verification / re-authentication | Project configured; signature/issuer/audience/expiry/provider/verified email checked; sensitive Google re-auth requires auth_time within 5 minutes (30s future tolerance) | Set matching `FIREBASE_PROJECT_ID`; maintain correct server time. Google login always requires verified email regardless of checkout flag. |
| Sensitive account actions | Current password or fresh Google proof for set/change password and delete; sessions revoked | Keep; confirm with disposable account. |
| `LOGIN_RATE_PER_MIN` | `5` per IP + normalized email / 60s fixed window | Keep initially; monitor legitimate/shared-IP traffic and abuse. |
| `REGISTER_RATE_PER_HOUR` | `5` per IP / 3600s | Keep initially; review shared-network traffic. |
| `GOOGLE_RATE_PER_MIN` | `20` per IP / 60s | Keep initially; monitor. |
| `LOGIN_LOCKOUT_FAILURES` | `10` failures per normalized email | Keep; known/unknown accounts have generic matching responses. |
| `LOGIN_LOCKOUT_MIN` | `15` minutes initially | Keep; do not routinely clear production lockouts. |
| `LOGIN_LOCKOUT_MAX_MIN` | `60`; progressive 15 -> 30 -> 60 minutes | Keep; monitor account-targeted denial of service. |
| `LOGIN_FAILURE_WINDOW_MIN` | `60`; failure rows clear when window and lock have both elapsed | Keep; successful login clears that email's failures. |
| Rate-limit response / identity | 429 with Retry-After; SQLite persistence; request.client IP | Trust forwarded IP/proto only from your known reverse proxy; never trust arbitrary client forwarding headers. Limits persist across app restarts. |
| CSRF | Every API POST/PUT/PATCH/DELETE requires `X-Requested-With: vastre` plus trusted Origin (Referer fallback only without Origin) | Keep api() wrapper and proxy header forwarding; don't exempt payment verification or auth. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173`; credentialed explicit CORS; same backend origin also accepted by CSRF | Replace with exact real HTTPS origins; no wildcard/path/trailing routes. Proxy must reject unknown Host values. |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Set public HTTPS UI origin for verification links, not an internal backend hostname. |
| `CSP_MODE` | **`enforce`** (`Content-Security-Policy`) | Keep enforcing after staging checks. `report-only` is a temporary diagnostic mode, not protection. No CSP reporting endpoint is configured. |
| CSP sources | Default/base/form self; object none; no inline/eval scripts; inline styles allowed; Google/Firebase/Razorpay script/connect/frame allowlist, Google Fonts, Unsplash/provider images, data/blob where needed | Preserve required providers; review allowlist changes and actual console violations. Provider wildcards and inline styles are residual allowances, not a nonce-based strict CSP. Full directive string: `backend/security.py:content_security_policy`. |
| HSTS | Absent locally; with Secure=true: `max-age=31536000; includeSubDomains` | HTTPS first on every subdomain, then enable Secure; no preload currently. App does not itself redirect HTTP to HTTPS. |
| Framing / MIME / referrer | X-Frame-Options DENY; CSP frame-ancestors none; nosniff; strict-origin-when-cross-origin | Keep at app/proxy without conflicting duplicate policies. |
| Permissions / opener | Camera/mic/geolocation disabled; payment allowed self + Razorpay; COOP same-origin-allow-popups | Keep opener compatibility for Google popup; don't substitute same-origin without testing. |
| `REQUIRE_VERIFIED_EMAIL` | `false` | Remains false for legacy customer compatibility. Enable only after verified-email rollout/SMTP acceptance; Google remains verified-only. |
| `EMAIL_VERIFICATION_HOURS` | `24` | Keep; links are single-use and SHA-256 hashed at rest. |
| `EMAIL_VERIFICATION_RATE_PER_HOUR` | `3` per user | Keep initially. |
| SMTP | Host configured locally (delivery not verified); `SMTP_PORT=587`, `SMTP_STARTTLS=true`; credentials/sender withheld | Configure `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` through secret storage; keep STARTTLS=true with certificate validation. Use a provider supporting SMTP STARTTLS on 587. |
| SMTP fallback / logging | With no host and Secure=false, development logs recipient + verification link; Secure=true requires SMTP and does not log link | Never use console email delivery for production. Restrict dev logs: verification links are sensitive credentials even though they are not ID/session tokens. |
| Auth errors / logs | Generic validation/provider/login errors; ID tokens, passwords and raw session tokens excluded from app/audit logging and covered by tests | Disable debug/HTTP-body/Authorization/Cookie/Set-Cookie capture at proxy/APM; redact personal data, restrict error logs. Unexpected internal failures may have server-side stack traces; never expose debug responses. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Bootstrap values present locally (withheld); now blank in example | Inject only for first bootstrap, remove afterward, rotate any previously exposed credential. Environment edits do not rotate an existing DB password. |
| `VASTRE_DB` | Defaults to `backend/store.db` | Persistent private disk outside web/build directories, restrictive OS permissions and tested encrypted backups. No tests open this file. |
| `PYTHON_DOTENV_DISABLED` | Unset; local dotenv enabled by default | `1` when injecting deployment secrets; never upload local .env files as static assets. |
| Firebase web config / domains | Four `VITE_FIREBASE_*` settings configured; domain authorization requires console check | Build with the production web config; authorize real hostname (no scheme/port); restrict API key appropriately without blocking required Firebase APIs. Web config is public, not an admin credential. |
| Browser storage | Per-owner cart/wishlist/addresses; recently viewed/theme/announcement are browser-wide | Shared-browser display isolation is not encryption: retained addresses remain readable in DevTools; recently viewed can reveal interests. Avoid shared browser profiles for sensitive account data. |

Other environment names: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` have no usable defaults and belong only on the backend; test keys for acceptance, live keys only after approval. The four frontend configuration names are `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, with no usable defaults. `FIREBASE_PROJECT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` default empty; `SMTP_FROM` defaults to `no-reply@vastre.example`. No packages or production auth/payment changes were needed for Phase 8.

Repeat the CSP checks from `frontend` (run sequentially; both use the isolated server on port 5182):

```powershell
$env:CSP_MODE = 'report-only'
try { npx.cmd playwright test --config playwright.security.config.js --project=1280-light } finally { Remove-Item Env:CSP_MODE -ErrorAction SilentlyContinue }
npx.cmd playwright test --config playwright.security.config.js
```

The first verifies Report-Only reporting and the second defaults to enforcement at 375/768/1280px in light/dark. Both probe actual public Razorpay/Google SDK scripts, Google Fonts and Unsplash; Google/Firebase frame/connect/popup domains also have deterministic transport probes. The negative control deliberately loads an unlisted script: it must be reported in both modes and blocked only in enforcing mode. It is the only expected CSP violation. These checks require internet access and do not complete real identity or payment transactions.

### Roles, ownership and first administrator

| Role | Allowed actions |
| --- | --- |
| Anonymous | Public catalogue/coupons; register/login/Google exchange; no private account/orders/admin data |
| `user` (legacy alias), `customer` | Own profile/security/sessions; own orders and checkout; another person's order returns 404 |
| `support` | Same own-account permissions as customer; no cross-customer support tools granted |
| `admin` | Own-account actions plus admin overview (orders/products/coupons) and Users read/change |
| Unknown role / disabled account | No authenticated capabilities / disabled sessions rejected |

To provision the first admin, choose an email you control that is **not already a customer row**, generate a strong password in a password manager, and inject `ADMIN_EMAIL`/`ADMIN_PASSWORD` into the backend process before first startup. Do not paste the password into commands, README, source or Git. Startup uses INSERT OR IGNORE: an existing email is neither promoted nor assigned a new password. Sign in at `/admin/login` (password only), verify Users/overview, then remove the bootstrap credentials from runtime configuration. Existing admins retain their role through migrations; Google cannot grant admin status.

Rotate an existing admin through Account -> Security -> Change password, supplying the current password and a new unique password. All that user's sessions end; sign in again with the new password and confirm the old one fails. Changing `ADMIN_PASSWORD` alone does **not** rotate it. Keep a separately controlled second admin for recovery. Admin Users changes require confirmation, are audited and revoke target sessions; self-demotion/disabling and demoting/disabling the last active admin are rejected. Deleting your own admin account is also blocked.

For **development only**, from the same environment/`VASTRE_DB` as your dev server run `.venv\Scripts\python.exe -m backend.reset_auth_limits`. It clears only existing throttle/lockout rows, not users/passwords/sessions, and tolerates original schemas without these tables. It refuses to run with `COOKIE_SECURE=true`. Prefer waiting for Retry-After; do not treat the CLI as production recovery or repeatedly trigger real-account lockouts.

### Repository and credential findings

The Phase 8 checkout has **no .git directory**: `git rev-parse`/`git status` report that it is not a repository. Therefore the index, tracked files, commits and history **could not be verified**. Ignore rules do not untrack already committed files. No claim that Git history is secret-free is possible here.

Found and removed from `backend/.env.example`: a populated `ADMIN_PASSWORD` and a personal Gmail address in `ADMIN_EMAIL`; replaced them with blank values. The example's actual Firebase project identifier was replaced with a generic public placeholder. Password and personal address are deliberately not reproduced. Rotate any account that used the exposed password, and rotate/revoke any exposed provider secret if a real Git/history review finds one. Previous README claims that the template contained only placeholders are true after this cleanup; this finding supersedes older audit assertions.

A redacted scan of README/AUDIT found no non-reserved personal email examples, populated credential literals or copies of the configured private credentials. Reserved examples such as `customer@example.test` / `no-reply@vastre.example` are deliberately fictitious. Private .env files, live `backend/store.db`, a `.bak` copy, and browser test-results exist locally; they were neither deleted nor read as application/test databases. .gitignore now covers .env variants (allowing .env.example), SQLite databases/backups/journals and browser artifacts at any depth. Public test-fixture passwords are intentionally present in test source, not deployable credentials; they must never be reused for real accounts.

Before pushing from a real Git checkout, run `git status --short --ignored`, `git ls-files`, and `git check-ignore -v --no-index backend/store.db backend/store.db.bak backend/.env frontend/.env frontend/test-results/.last-run.json`. Review tracked filenames for env/databases/backups/results, run a reputable secret scanner against the index **and full history**, and review README/AUDIT again. If an artifact was tracked, remove it from the index without deleting local data, rotate secrets first, and follow your hosting provider's sensitive-history removal procedure. Do not paste scan matches/credentials into issues or chat. A clean ignore check is not a clean history scan.

### Production deployment checklist

- [ ] HTTPS only, redirect HTTP at the reverse proxy; same public origin for storefront and `/api`. Bind Uvicorn privately, allow only known Host names, trust forwarding headers only from known proxies; persistent local disk, not an ephemeral container filesystem.
- [ ] Set `COOKIE_SECURE=true` (exact lowercase), `ALLOWED_ORIGINS` to actual HTTPS origin(s), `PUBLIC_BASE_URL` to public HTTPS storefront origin. Inspect Set-Cookie/headers on the deployed site. Ensure all subdomains support HTTPS before includeSubDomains HSTS takes effect.
- [ ] Set matching backend Firebase project and frontend VITE config; authorize the production hostname in Firebase Authentication. Test real popup **and** redirect on the deployed domain. See [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin) and [redirect/custom-domain guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices); third-party storage restrictions can require deployment configuration, not just an allowlist entry.
- [ ] Strong unique admin password; rotate the removed example credential if used, verify second-admin recovery, remove bootstrap password after provisioning. Keep secrets in deployment secret storage; never in VITE variables or frontend build artifacts. Review Git index/history before publishing.
- [ ] Configure SMTP with verified sender and STARTTLS, provider credentials, SPF/DKIM/DMARC as your provider requires; complete the SMTP checklist below. Keep `REQUIRE_VERIFIED_EMAIL=false` until a separate rollout decision.
- [ ] Keep CSP **enforcing** after Report-Only and enforcing staging checks; inspect Google, Razorpay, fonts, images and every page. Header transport probes are not substitutes for a real checkout or Google session exchange.
- [ ] Run backend/unit/browser/smoke commands from Phase 7 plus security tests. Verify no password/ID token/session token appears in app, proxy, analytics or error-reporting logs. Never record a full HAR with credentials.
- [ ] Use Razorpay test keys for staging and complete real sandbox checkout below; only then intentionally activate live keys/capture settings. Existing payment verification/amount logic remains unchanged.
- [ ] Schedule consistent encrypted backups of `store.db` outside the repository/web root, restrict access, retain off-host copies, and test restoration into a separate temporary database. Use SQLite's online backup API (`sqlite3.Connection.backup`) for a running DB; copying one live file while it is being written is not a reliable backup, especially with journals/WAL. Never test a restore over the production file. See [SQLite backup API](https://www.sqlite.org/backup.html).
- [ ] Monitor errors, lockouts, failed payments, disk space, backup success and SQLite lock latency; protect audit/session/order personal data and set retention/access rules. Stop before deployment if the Git-history/credential-rotation checks remain unresolved.

SQLite in a single persistent file is appropriate for a small-traffic, single-host shop with short transactions and backups. Move to a hosted database such as PostgreSQL when sustained write contention causes locking/latency, multiple app hosts need shared writes, storage is ephemeral, or you need managed failover, point-in-time recovery or higher availability. There is no universal customer-count threshold. SQLite allows one writer at a time; don't share its file across app hosts using a network filesystem. Plan a separately tested migration preserving users/roles/password hashes/orders/ownership before switching. See [SQLite deployment guidance](https://www.sqlite.org/whentouse.html) and [locking FAQ](https://www.sqlite.org/faq.html).

### Manual external-service acceptance (temporary database only)

These checks remain manual; mocked success does not prove provider configuration, actual email delivery or payment settlement. Do not use `backend/store.db` or its backup. Use a dedicated test mailbox/account and Razorpay **test** keys only. Stop any existing server on port 8000 before launching this one. No live customer data is needed.

In a new PowerShell terminal at the repository root:

```powershell
$env:VASTRE_DB = Join-Path ([IO.Path]::GetTempPath()) ("vastre-acceptance-" + [guid]::NewGuid().ToString() + ".db")
$env:PYTHON_DOTENV_DISABLED = '1'
$env:COOKIE_SECURE = 'false'
$env:ALLOWED_ORIGINS = 'http://localhost:5173'
$env:PUBLIC_BASE_URL = 'http://localhost:5173'
$env:CSP_MODE = 'enforce'
$env:REQUIRE_VERIFIED_EMAIL = 'false'
$env:ADMIN_EMAIL = ''
$env:ADMIN_PASSWORD = ''
$env:SMTP_HOST = ''
# FIREBASE_PROJECT_ID must already be injected into this terminal.
# For payment/mail checks, inject test-only provider settings securely before startup.
.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

In a second terminal run `cd frontend` then `npm.cmd run dev -- --host localhost`. Open **http://localhost:5173**, not 127.0.0.1. The backend binds IPv4 loopback to match the existing Vite proxy. Frontend `.env` supplies the existing public Firebase config; no local backend .env is loaded. Missing VITE config must show the exact missing names. Do not print environment variables. To enter an operator secret without typing it into shell history, use a secure prompt, for example:

```powershell
$env:RAZORPAY_KEY_SECRET = [System.Net.NetworkCredential]::new('', (Read-Host 'Razorpay TEST secret' -AsSecureString)).Password
```

Do this in the backend terminal **before** launch/restart. Use the same pattern for SMTP_PASSWORD; no credential goes in this README. Do not change deployment secrets or actual account passwords for these tests. Close the disposable terminal afterward and remove temporary data only after the server has stopped and the path is verified; never recursively delete a computed path.

Vite's development HTML does not carry the deployed document CSP. For real Google/payment acceptance under **enforcing CSP**, also run `npm.cmd run build` in `frontend`, restart the same temporary backend with `PUBLIC_BASE_URL=http://localhost:8000`, and repeat the flows at **http://localhost:8000** (still an authorized localhost domain). Confirm the HTML response includes Content-Security-Policy and inspect console violations there. The Vite-only `/src/firebase.js` console import is unavailable in a built preview; immediate Firebase sign-out is covered by the automated SDK tests. Finally repeat on HTTPS staging to establish Secure-cookie/HSTS and real-domain redirect behavior. An automated public-resource probe does not replace these real transactions.

**Real Google identity and cookie**

1. Firebase Console -> Authentication -> Sign-in method: Google enabled. Settings -> Authorized domains: explicitly include `localhost` (new projects may not include it automatically), and later the real deployment hostname. Verify frontend/backend project IDs match. If opened on an unauthorized hostname, expect a friendly authorized-domain explanation rather than silent failure.
2. In a fresh browser profile open `/login?next=%2Faccount%3Ftab%3Dprofile`. Expect an enabled Google button, no configuration warning; `/admin/login` must have no Google button.
3. Click Google, choose the disposable Google identity, and complete consent. Expect return to Account Profile, Google provider/verified email and one customer account. Refresh: still signed in. Sign out and repeat: same account/orders, no duplicate or admin promotion.
4. DevTools -> Application -> Cookies: expect `vastre_session`, HttpOnly, SameSite=Lax; Secure is false for this HTTP localhost test and must be true on HTTPS staging. Do not copy its value. In Vite console evaluate `(await import('/src/firebase.js')).auth.currentUser === null`; expect true after the backend session response. No ID/session token should be in browser localStorage or app logs.
5. Close the popup before selecting an identity: expect silent cancellation and enabled controls. Block popups and retry: expect redirect fallback to the saved destination. Test with third-party storage restricted; if your deployment cannot finish redirect, follow Firebase's redirect guidance and retry with popup allowed. Do not report the flow passed merely because a popup opened.
6. Open `/account?tab=orders` while signed out, sign in, and expect Orders restored. Customer `/admin` shows Access denied and API overview 403. Revoke the session from another device, request Account data, and expect Login with next preserved and one session-expired toast. Check logout removes authenticated access after refresh.
7. Profile edits survive refresh. Set/change password and delete on disposable accounts require current password or fresh Google confirmation; cancellation must not complete them. Changing password revokes both devices. A verified Google email can link an existing matching password account; a password-only unverified email must not be linked via an unverified Google credential (covered by verifier tests, not forgeable through real Google UI).

**Real Razorpay test checkout**

1. In Razorpay Dashboard select **Test mode** and inject that mode's `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` into the isolated backend terminal, without printing/storing them in docs. Enable the appropriate capture setting; restart the temporary server with the same temporary DB path. Use only Razorpay's current [test integration instructions](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and test payment methods; never use a real card or live keys.
2. Sign in with Google, browse Shop, filter, open a product, select an explicit size and quantity, add to bag. Expect header/drawer/page counts to agree. Apply an eligible live coupon and fill a disposable structured delivery address. Guest forms/quotes reset on login intentionally; re-enter after signing in.
3. Confirm summary matches server quote and **delivery is free on every order**. Click checkout once: expect loading/duplicate-submit protection and actual Razorpay test modal. Complete the gateway's test success flow.
4. Expect Order confirmed with order ID/summary, then Account -> Orders showing the same paid order/amount/items; refresh and verify it remains. In test dashboard confirm captured status. Inspect browser console for CSP violations and backend responses for friendly errors, without exporting bodies/tokens.
5. Make a separate test attempt and cancel/fail at the gateway: expect no false confirmation or paid status; retry is possible. Test network/script failure: expect friendly error and no duplicate paid order. Confirm no real charge occurred. Automated smokes simulate the external transport; this checklist exercises the actual sandbox.

**SMTP delivery and verification**

1. Use a test SMTP provider/mailbox you control. Inject `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_USERNAME`, `SMTP_PASSWORD`, authorized `SMTP_FROM`, and `SMTP_STARTTLS=true`; keep `PUBLIC_BASE_URL=http://localhost:5173` and `REQUIRE_VERIFIED_EMAIL=false` for local acceptance. Restart the isolated backend. Do not use an arbitrary address copied from a document/example.
2. Register a new **password** account using that mailbox (a Google account is already verified). Expect registration/login to work and a verification message in the actual inbox/spam folder. Missing SMTP should not be mistaken for delivery: local console fallback prints a sensitive link, which must not be pasted or retained in shared logs.
3. Open the received link on localhost. Expect verified status in Account after refresh. Reuse the link: expect a friendly invalid/expired message, not another successful verification. Request resend from another disposable unverified account and check the latest link works; expiry/single-use/rate boundaries are also covered automatically under controlled clocks.
4. Stop/restart this isolated server with invalid SMTP credentials, then request resend. Expect a friendly failure without provider exception, password or recipient details in error responses/logs. Restore correct SMTP settings; do not exceed resend limits during repeated checks. Keep email-verification gating false by default so legacy checkout remains available.
5. On an HTTPS staging host repeat delivery with `COOKIE_SECURE=true`, real HTTPS `PUBLIC_BASE_URL` and the production sender. Confirm verification links are not logged, TLS delivery succeeds, and Secure cookie/HSTS are present. Local HTTP checks cannot establish HTTPS deployment correctness. These are verification emails only; **order emails are not implemented**.

### What's left for a product decision

- Server-side cart/wishlist/address synchronization across devices, with an explicit guest-merge policy.
- Product editing in admin (catalogue is currently read-only).
- Real reviews/ratings instead of UI placeholders.
- Delivery pricing: keep every order free, or add a future server-calculated charge consistently to quotes/payments/copy. No threshold charge exists today.
- Order confirmation/status emails, delivery provider integration and retry/observability beyond current email verification.

### Phase 9 initial handover (2026-10-20; superseded by Phase 9b below)

Stopped at the user's request before the Sportswear/content stage. Phase 9 is not fully accepted against its performance targets. Lighthouse 12.8.2 mobile, simulated throttling, independent cold navigations produced:

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home | 54 | 100 | 96 | 100 |
| Shop | 68 | 100 | 96 | 100 |
| Product (linen-sun-shirt) | 54 | 100 | 96 | 100 |
| Cart | 71 | 100 | 96 | 66 |
| Login | 81 | 100 | 96 | 66 |

Performance misses 85 on all five core pages: cold client rendering and JavaScript execution remain expensive (Home/Product LCP about 6.2/6.1 seconds and blocking time 854/902 ms). Accessibility and Best Practices meet 95; public SEO meets 95. Private Cart, Login, Account and Admin intentionally remain noindex, so their lower SEO scores are expected. Client-generated metadata still needs real crawler/social preview acceptance; no prerendering was added.

Measured startup JavaScript, including initial vendor chunks: 494.55 kB before / 320.37 kB after (gzip 151.86 / 102.06 kB). Initial CSS: 84.91 / 68.21 kB (gzip 14.79 / 12.63 kB). The original hero was 986,839 bytes; active responsive WebP variants are 38,512 / 110,318 / 198,758 bytes at 600 / 1200 / 1800 pixels. Route splitting, deferred Firebase loading, compression and responsive hero delivery are active. Generated catalogue WebPs and WOFF2 files are not yet wired into runtime; their savings must not be counted. Dependency audit findings remain: 31 advisories (19 moderate, 12 high), including four high production-tree advisories requiring review.

Verification record: backend 96 tests plus 25 subtests; unit 40; storefront 144 distinct cases passed across an initial run (133 passed, 11 failed) and corrected rerun (11 passed); mocked auth browser 28 passed; quality checks 44 distinct cases passed across runs/reruns; purchase smoke 2 passed; admin smoke 2 passed; enforcing-CSP focused checks 2 passed. Build passed. Databases were temporary. These are the last verified results, not a claim that every suite passed against the exact final workspace: the final cart-stepper sizing change and generated optimizer files were not followed by a complete build/format/regression/smoke rerun. Previously passing tests do not close that gap.

Remaining manual acceptance:

1. On localhost:5173 and the authorized production domain, complete real Google popup/redirect login, cancellation, refresh/session persistence and account switching; confirm no Google button on admin login and Firebase sign-out after app-session creation.
2. In an isolated test database, browse, filter, select a size, add to bag, apply a coupon, enter an address and complete/cancel Razorpay TEST checkout; confirm the resulting order in Account.
3. Exercise real SMTP verification, resend, expired/single-use links and delivery failure; verify production HTTPS, secure cookies and enforcing CSP with provider resources.
4. Use a real phone and NVDA/VoiceOver to check keyboard focus, dialogs, announcements, errors, zoom, portrait/landscape and reduced motion in both themes.
5. Check deployed public URLs with Search Console/Rich Results and social previews; retain private noindex directives. Repeat cold mobile Lighthouse and all suites after finishing runtime asset integration. Sportswear/content work has not started.

### Phase 9b asset delivery and dependency review

The same 16 catalogue photographs now use the generated 160/600/1200px WebP variants in product cards, the gallery, category tiles, story and lookbook. The image helper supplies srcset/sizes for known local photographs and remote Unsplash images, preserving unknown URLs as fallbacks. Images retain explicit dimensions. Home's hero and the Product lead image are high priority and never lazy-loaded; FastAPI inserts the Product lead preload into the initial HTML. Other gallery images use small thumbnails, and the next large image is requested only after the visible image loads. Below-fold images retain native lazy loading. The Product loading state reserves viewport height to prevent the footer jumping through the viewport.

Fonts are self-hosted WOFF2 with swap, declaring only the used DM Sans 400/500/600/700, DM Mono 400/500 and Playfair Display 500 normal/italic faces. Body and display fonts are preloaded; Home also preloads its italic headline face. Original photographs/font files and their notices remain available. Firebase and Account/Admin chunks remain outside public startup, checked in the production browser suite. No auth/payment logic, API shape, catalogue content or live database was changed.

| Delivery budget (decimal kB) | Before Phase 9 | Phase 9b |
| --- | ---: | ---: |
| Startup JS, including initial vendor chunks | 494.55 | 321.50 |
| Startup JS, gzip | 151.86 | 102.58 |
| Initial CSS | 84.91 | 67.86 |
| Initial CSS, gzip | 14.79 | 12.60 |
| Hero | 986.84 | 38.51 / 110.32 / 198.76 at 600 / 1200 / 1800px |
| Eight active font faces (uncompressed file bytes) | 517.94 TTF | 203.98 WOFF2 |

The font row totals declared faces, not a claim that every face downloads at startup. The responsive hero and catalogue images are integrated, rather than merely generated; unknown images still fall back to their supplied URL.

`npm audit fix --ignore-scripts` applied no further safe remediation. A same-major `@grpc/grpc-js` override (`^1.13.6`, resolved 1.14.6) removes the four production-tree findings inherited through unused Firebase Firestore packages. The app imports Firebase app/auth, not Firestore. Final `npm audit --omit=dev`: **zero vulnerabilities**. `pip-audit` 2.10.1 scanned the installed Python environment, including development packages: **zero known vulnerabilities**. No breaking upgrades or force fixes were applied.

The full npm development tree still reports **19 moderate and eight high affected-package entries**. The high entries reduce to three root advisories: one FTP parser issue and two ZIP extraction issues. None are shipped in the browser production build or exposed by FastAPI. Reachability below is specific to this repository's local audit runner, which uses an installed Chrome and a fixed localhost URL; it is not a guarantee for arbitrary use of these tools.

| High affected package | Scope and reachability here | Fix path withheld or unavailable |
| --- | --- | --- |
| basic-ftp 5.3.1 | Dev only; FTP directory-listing path is not used by the audit runner | [6.2.1 fixes the parser advisory](https://github.com/advisories/GHSA-c475-qrg2-pj4r), but 5 to 6 is a major upgrade requiring approval |
| extract-zip 2.0.1 | Dev only; browser archive extraction is not invoked when using installed Chrome | No patched release for [symlink traversal](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) or [symlink overwrite](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3); needs an upstream dependency replacement/fix |
| get-uri 6.0.5 | Dev only; inherits basic-ftp through proxy tooling, no FTP fetch here | A parent release using basic-ftp 6.2.1+; no permitted in-range fix found |
| pac-proxy-agent 7.2.0 | Dev only; inherits the FTP branch, no PAC/FTP configuration here | Updated get-uri/basic-ftp dependency chain; no permitted in-range fix found |
| proxy-agent 6.5.0 | Dev only; inherits pac-proxy-agent, no browser-download proxy path here | Updated PAC/get-uri/basic-ftp chain; no permitted in-range fix found |
| @puppeteer/browsers 2.13.2 | Dev only; inherits extract-zip/proxy-agent, installer is not invoked here | Upstream removal/fix of extract-zip plus repaired FTP chain; no safe fixed version identified |
| puppeteer-core 24.43.1 | Dev only; Lighthouse uses browser automation, but the vulnerable installer/proxy paths are not invoked | Upstream browser-management dependency repair; no safe fixed version identified |
| lighthouse 12.8.2 | Dev only; local measurement tool, inherits the above chain | npm suggests an out-of-range downgrade to 12.6.1, not a safe upgrade. No forced downgrade/major migration applied |

Run commands from the repository root unless preceded by `cd frontend`:

```powershell
.venv\Scripts\python.exe -m pytest backend -q
.venv\Scripts\python.exe -m pip_audit
cd frontend
npm.cmd run format:check
npm.cmd run build
npm.cmd run test:unit
npx.cmd playwright test --workers=1
npx.cmd playwright test --config playwright.auth.config.js
npm.cmd run test:smoke
npx.cmd playwright test --config playwright.admin-smoke.config.js
npm.cmd run test:quality
npx.cmd playwright test --config playwright.security.config.js
npm.cmd run test:lighthouse -- --core
npm.cmd audit --omit=dev
```

Run browser suites and Lighthouse sequentially. The production fixture owns port 5182, uses temporary SQLite storage, disables private dotenv loading and replaces only the external payment transport. It must never reuse the customer database. Lighthouse uses the Vite production build served by FastAPI, not the Vite development server; production browser checks assert gzip headers, WebP/WOFF2 delivery and private-chunk exclusion. Lighthouse clears HTTP cache before each mobile simulated navigation. Cart is measured empty and Login anonymous; filled checkout is covered by purchase tests instead.

### Phase 9b final measurements and checks (2026-10-20)

Lighthouse 12.8.2, Chrome 155, mobile simulation with simulated throttling, one independent cold navigation per page, against the compressed FastAPI-served production build. No audit warnings. The final confirmation ran after browser suites finished; no concurrent test workload was used for these measurements.

| Page | Performance | Accessibility | Best Practices | SEO | LCP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 77 | 100 | 96 | 100 | 5.41 s |
| Shop | 87 | 100 | 96 | 100 | 3.56 s |
| Product (linen-sun-shirt) | 91 | 100 | 96 | 100 | 2.99 s |
| Cart (empty) | 93 | 100 | 96 | 66 | 2.88 s |
| Login (anonymous) | 92 | 100 | 96 | 66 | 2.95 s |

All revised Phase 9b performance goals are met: Home >=75 and the other four >=85. Accessibility/Best Practices exceed 95, as does public SEO. Cart/Login retain intentional noindex, as do Account/Admin. Home remains below the original Phase 9 performance goal of 85 and its LCP is still above 2.5 seconds: the LCP element is the hero headline, with 4.94 seconds of simulated element-render delay and approximately 474 ms of measured JavaScript evaluation/parsing. No third-party script was attributed on Home/Shop/Product; their remaining startup work is client rendering. Login loads the Google sign-in SDK only within that route, with about 71 ms of attributed third-party blocking in this run. Public catalogue routes do not load Firebase. These are lab results, not field Core Web Vitals or real-device guarantees; further prerendering work is outside this bounded pass.

The first integrated diagnostic found Product CLS 0.949 from its short loading placeholder. Reserving viewport height reduced final Product CLS to **0** and improved its performance score from 65 in that diagnostic to 91 in the final confirmation. The lead photograph is discoverable in initial HTML, eagerly loaded and high priority. Home CLS is also 0; the other three are below 0.001.

| Final-state check | Result |
| --- | --- |
| Prettier (configured scope plus changed browser test files) | Pass |
| Production build | Pass; no Vite warnings |
| Backend, including temporary/original-schema migration tests | 96 passed + 25 subtests |
| Frontend unit | 41 passed |
| Full storefront browser regression, one single-worker invocation | 144 passed |
| Full mocked-Firebase auth browser invocation | 28 passed; 116 intentional skips |
| Purchase smoke, including production rebuild | 2 passed |
| Real-API admin smoke | 2 passed |
| Final production responsive/accessibility matrix | 48 passed; 48 intentional skips |
| Enforcing-CSP browser suite | 7 passed; 5 redundant external-probe skips |
| Lighthouse core audit | 5 pages completed, no warnings |
| Production npm / installed Python audit | 0 / 0 known vulnerabilities |

The test matrix covers 320/375/768/1280/1920px and 844px landscape in both themes. Representative mobile and desktop settled screenshots were inspected. Playwright still emits the environmental NO_COLOR/FORCE_COLOR warning; this is not a production build warning. All database tests/smokes used temporary databases; backend/store.db was never used as a test target.

Diagnostic runs exposed stale JPEG/lightbox URL assertions and an ambiguous status selector (route loading versus session-expiry toast). Tests now verify responsive URLs, deferred neighbour-image loading and the toast within Notifications. A duplicate concurrent browser run was stopped after resource-contention timeouts; the final results above come from complete sequential browser invocations, not a collection of failed-test reruns. No runtime source changed after the final build/suites, apart from these documentation records.

Manual acceptance still required: real Google popup/redirect on localhost:5173 and the production authorized domain; real Razorpay TEST success/cancellation and Account order history; real SMTP verification/resend/expiry; real-phone/screen-reader/zoom checks; deployed HTTPS/CSP and search/social preview acceptance. Follow the step-by-step checklists above. No real identity exchange, external payment or SMTP delivery is inferred from mocks/resource checks. Sportswear/content work has not started; this pass stops here.

### Phase 8 verification record

Backend: **86 tests + 25 subtests**; frontend unit: **33**; production build; purchase smoke: **2**; real-API admin smoke: **2**; mocked Firebase: **28** passed (116 intentional redundant/opt-in skips). CSP Report-Only: **2 passed**; enforcing: **7 passed**, covering six sizes/themes and the once-only public provider-resource probe (5 redundant probe skips). **Final CSP mode is enforcing.** All database tests used temporary storage; no real Google identity, gateway payment or SMTP message was sent.

The full storefront invocation initially finished **143 passed / 1 failed**: the old empty-category test assumed off-screen lazy images were already loaded. Fixed only that test to scroll each image into view before checking successful loading; targeted desktop/mobile rerun **2 passed**. All 144 distinct cases have passing verification across the run and rerun. Because the initial consolidated browser command stopped at that failure, the mocked Firebase config was run separately and passed; a second complete consolidated invocation was not run. No application/auth/payment logic changed.

Redacted source/doc/template scan: **183 files**, no remaining configured private credential matches/private-key markers or non-reserved email examples in README/AUDIT/templates. Ignore rules: **14 cases passed** in a temporary Git repository; this checkout still has no Git index/history to inspect. The exposed example admin password requires rotation if used. See AUDIT for findings and residual risks. No packages were added.


### Stage 2: catalogue and content (2026-10-21)

The catalogue now contains 60 products: ten each in Shirts, T-shirts, Trousers, Jeans, Hoodies and Sportswear. All 50 previous IDs, names and categories are preserved. Prices and compare-at values are individually distinct; each item has a specific two-sentence description. Review the complete public price/compare-at/weight table in [CATALOGUE.md](CATALOGUE.md).

Edit product records in backend/catalogue.json and restart FastAPI after changes. backend/catalogue.py is a pure data loader (no database side effects); backend/app.py imports its PRODUCTS and CATEGORIES. No database migration is required. New product fields are additive/optional: fabric, fit, colors (name/hex), weight_kg, rating and review_count, plus care/image-reference metadata where applicable. The frontend remains compatible with responses lacking these fields. Ratings are null and review_count is zero until real reviews exist; no fake ratings or aggregate-rating schema were added.

Fit and fabric appear on the detail page, with read-only palette swatches. A visible note and code comment state that colour is not selected or stored in the order. No colour field was added to cart, quote or checkout requests. These are proposed merchandising specifications, not supplier-certified composition or performance measurements.

Unpackaged garment weight estimates: Shirts 0.25 kg, T-shirts 0.18 kg, Trousers 0.45 kg, Jeans 0.65 kg, Hoodies 0.60 kg; Sportswear default 0.35 kg with item-specific values: performance tee 0.18, shorts 0.20, joggers 0.35, track jacket 0.40, tights 0.22, vest 0.14, sports hoodie 0.55, compression tee 0.17, tracksuit set 0.80 and windcheater 0.25 kg. Confirm actual garment and packaging weights before shipping integration. Checkout totals/delivery rules are unchanged.

Sportswear has three reference photos per product, curated from seven men's activewear photographs. These are styling references, not exact SKU or colour photography; the product page says so. All seven originals returned HTTP 200 and passed visual review. Sources/authors/license links are recorded in [sportswear-sources.json](frontend/public/images/sportswear-sources.json). No original catalogue image needed replacement. The same Phase 9b generator produced 160/600/1200px WebPs, and the shared srcset/sizes helper is used on cards, gallery/lightbox, home, admin thumbnails, cart and order displays, with explicit dimensions. LCP images remain high-priority/eager and below-fold images lazy. All 23 catalogue originals and 69 responsive candidates decode successfully.

Sportswear is available in desktop/mobile navigation, search/filter categories, the sixth home tile (with matching skeleton layout), footer/empty-bag shortcuts, admin Products and the generated sitemap (69 public URLs). CSP remains enforcing with no directive changes. Auth/payment handlers and API request shapes were not changed. Stored order amounts/details remain unchanged; saved carts resolve preserved IDs using current catalogue prices.

Additional checks, from frontend:

```powershell
npm.cmd run test:images
npm.cmd run test:content
npm.cmd run test:lighthouse -- --content
```

The content browser suite uses the disposable FastAPI fixture and covers 375/768/1280px in both themes: catalogue surfaces, responsive images, optional facts, accessibility/CSP, admin Sportswear filtering and an old unscoped saved cart. Backend tests quote all 50 original IDs in batches and verify historical order snapshots without touching backend/store.db. Source/catalogue edits need a backend restart; tests and Lighthouse must use the temporary fixture, never the customer database.


#### Stage 2 final verification (2026-10-21)

Final production Lighthouse 12.8.2 / Chrome 155, simulated mobile throttling, independent cold-cache navigation, compressed FastAPI production build. The run started after all browser suites completed and produced no Lighthouse warnings.

| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Shop | 89 | 100 | 96 | 100 | 3.54 s | 0.00009 |
| Sportswear: Performance Training Tee | 85 | 100 | 96 | 100 | 3.95 s | 0.00000 |

Shop exceeds the >=85 requirement and improved from the accepted Phase 9b score of 87 to 89. Shop CLS is unchanged at approximately 0.00009; the new Sportswear page has CLS 0. The new Sportswear page scores 85 with its own photograph/content; it is not the same page as the previously measured Linen Sun Shirt (91). Product LCP remains above the 2.5-second field-vitals goal at 3.95 seconds, despite eager/high-priority/preloaded image delivery. These are single-run lab results, not real-device field guarantees.

| Final-state suite | Result |
| --- | --- |
| Prettier, including changed browser tests | Pass |
| Production build | Pass, no Vite warnings |
| Backend (including original-schema migration and legacy catalogue/order checks) | 99 passed + 25 subtests |
| Frontend unit | 43 passed |
| Full storefront browser regression | 146 passed |
| Auth browser (mocked Firebase) | 28 passed; 116 intentional skips |
| Purchase smoke (with production rebuild) | 2 passed |
| Real-API admin smoke | 2 passed |
| Sportswear/content/old-cart browser suite | 12 passed |
| Responsive/accessibility matrix | 48 passed; 48 intentional skips |
| Enforcing-CSP suite | 7 passed; 5 redundant probe skips |
| Catalogue image decoding | 23 originals + 69 WebP variants passed |

The general matrix covers 320/375/768/1280/1920px and 844px landscape, light/dark; Sportswear specifically covers 375/768/1280px in both themes, with inspected mobile/desktop screenshots. The historical-order test uses an old hoodie amount of INR 1,990 while its current catalogue price is INR 2,190, verifying that stored order amounts/details are not recomputed. All 50 original product IDs remain quoteable; a six-item old unscoped saved cart migrates and survives reload in the browser. Malformed-cart recovery, unavailable-product removal and owner isolation regressions also pass.

All tests used mocks or temporary fixture databases; backend/store.db was never a test target. No auth/payment handler, security directive, database schema or shipping-charge rule changed. No packages were added. The usual Playwright NO_COLOR/FORCE_COLOR environment warning is separate from the warning-free Vite build.

Before launch, review the proposed prices/specifications/weights in CATALOGUE.md and obtain exact SKU/colour photography if needed. Existing README real Google/Razorpay TEST/SMTP and production HTTPS acceptance steps still apply; no real provider success is inferred from these test fixtures. Stage 2 is complete and stops here.
