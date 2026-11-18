# Step 0 audit — 17 October 2026

Phases 1–7 were reviewed against the current code and tested before any Phase 8 work. Phase 8 has not started.

| Area                       | Status after this pass                         | Confirmed                                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation                 | Done                                           | React Router; all ten required URLs; `/wishlist`; `api/`, Auth/Cart/Toast contexts, components, pages and token-based styles; error boundary, 404 and pathname scroll reset.                                                                                            |
| Design system and shell    | Done                                           | Paper/ink/orange palette, Playfair Display + DM Sans, dark/system theme with persisted toggle, sticky header, trapped-focus mobile menu, announcement, footer, stacked toasts and shared controls. Heading punctuation now uses the orange accent consistently.         |
| Home, Shop, Product detail | Done for the requested UI scope                | Editorial hero, trust strip, five categories, new-in carousel, bestsellers, offers/lookbook/newsletter; URL filters/sort, search, product cards/quick-add; gallery/lightbox/swipe, size pills/guide, quantity, sticky mobile CTA, related/recently viewed and metadata. |
| Cart and checkout          | Partial: external gateway verification pending | Drawer, bag, structured address, coupon application, offers, confirmation and persisted Account order all work through the real local API. Actual Razorpay-hosted test checkout could not be verified because test credentials are not configured.                      |
| Auth and account           | Done                                           | Responsive login/register tabs, password controls, validation and redirect-back; account overview/orders/wishlist/addresses/logout; dedicated wishlist and size-aware Move to bag.                                                                                      |

Required routes checked: `/`, `/shop`, `/shop/:category`, `/products/:id`, `/cart`, `/coupons`, `/login`, `/admin/login`, `/account`, `/admin`.

## Fixes made

- Recovered from malformed saved-cart rows instead of letting them crash the global header. Valid variants are retained; invalid and duplicate rows are discarded.
- Added an explicit removal action for saved products absent from the loaded catalogue, so stale bag references cannot leave the customer stuck. Missing catalogue items are not automatically erased.
- Applied the existing orange full-stop treatment to headings without changing their copy, layout, fonts or palette.
- Added a repeatable purchase smoke fixture and `npm run test:smoke` command. No production endpoint or request/response shape changed.

## Validation

- Production build: passed.
- Unit checks: 13 passed.
- `backend/test_store.py`: 3 passed.
- Desktop/mobile regression run: 102 passed.
- Additional desktop/mobile stale-bag recovery checks: 2 passed.
- Full purchase smoke against the final production build and real local backend: 2 passed.

The complete smoke traversed browse → category/price/size filtering and sorting → product → explicit size → bag → VASTRE10 → structured address → register/return to checkout → simulated Razorpay checkout → server verification → confirmation → paid Account order. Reloading Account retained the order. A three-shirt order had subtotal ₹5,670, discount ₹567 and paid total ₹5,103.

The smoke fixture uses a temporary SQLite database and the real cookie session, validation, quote, order, verification and order-list endpoints. Only the external Razorpay transport and hosted widget are simulated. No real payment was attempted, and the fixture never targets `backend/store.db`.

SHA-256 comparisons confirmed these production files were unchanged: `backend/app.py`, `api/client.js`, `context/AuthContext.jsx`, `utils/auth.js`, `hooks/useCheckoutPayment.js`, and `services/razorpay.js`. Auth-page edits were limited to heading presentation. `.env`, `.venv/` and `backend/store.db` remain covered by `.gitignore`; no credentials were added or printed.

## Existing scope limits

- Rating placeholders, illustrative size measurements and the UI-only delivery estimate remain labelled previews; newsletter forms remain UI-only.
- Addresses and wishlist remain browser-local as requested. Metadata is client-rendered.
- The current backend adds no delivery charge; checkout totals retain that behavior.
- Actual Razorpay test-mode checkout remains unverified until test credentials are configured locally. The simulated smoke is not a substitute for that external integration check.

Run the repeatable local smoke from `frontend` with `npm run test:smoke` (`npm.cmd` in Windows PowerShell). It builds the storefront and starts the isolated fixture on `127.0.0.1:5182`; it requires the existing root `.venv` and installed Chrome. The fixture requires an explicit test-only environment flag and is never imported by the production server.

## Phase 8 — 19 October 2026

The accepted Step 0 snapshot above is retained. This follow-up completes the delivery-copy correction and admin dashboard; Phase 9 and the data/content changes have not started.

### Delivery copy correction

`frontend/src/config/storefront.js` now owns `DELIVERY_COPY`: **Free delivery on every order**. The announcement, Home trust strip, product delivery/returns text, bag and drawer reuse this setting. `DeliveryNote` replaces the threshold progress component; its unused progress-bar CSS is removed. Checkout summaries and backend totals are unchanged.

### Delivered

| Area | Status | Behavior |
| --- | --- | --- |
| Routes and access | Done | `/admin`, `/admin/orders`, `/admin/products`, `/admin/coupons`; refreshable links, desktop sidebar, scrollable mobile navigation with active-tab visibility. Anonymous users return through `/admin/login`; signed-in non-admins see Access denied. Existing session and role checks are reused. |
| Overview | Done | Customers, total orders, paid revenue, pending orders, paid-order average value; inline SVG amounts-by-status chart with text equivalents; five newest orders in the endpoint's supplied order. No dates are invented. |
| Orders | Done | Native table / mobile cards; keyboard-operated expansion; safely parsed items, coupon and address; ID/email search, status filter, sorting, filtered CSV export with multiline escaping and spreadsheet-formula protection. |
| Products | Done | Read-only table with thumbnails, name, category, price, compare-at, tag, name/category filters and View in store links. The table scrolls within its region on narrow screens. |
| Coupons | Done | Ticket cards from the existing overview response, with code, percentage and minimum spend. |
| States and theme | Done | Loading skeletons, empty/filter-empty states and Try again errors on every section; malformed or absent fields have safe fallbacks. Storefront tokens, dark mode, orange punctuation and DM Mono figures are reused. The storefront's floating WhatsApp control is hidden on admin routes so it cannot cover operational data. |

`frontend/src/utils/admin.js` keeps the paise-to-rupees conversion in one helper. Product prices and coupon minimums remain in rupees. Admin helpers have unit coverage for revenue, averages, filtering, safe JSON parsing and CSV serialization. Browser regressions cover administrators, normal users, anonymous redirects/return destinations, refresh/history, expansion, filtering, exports, retry/empty states and malformed responses.

The backend application, API wrapper, AuthContext, login page, auth helpers, checkout payment hook and Razorpay loader have identical SHA-256 hashes to the start of this phase. No backend endpoints, response shapes, authentication handlers, payment logic or checkout totals changed. No database migration or production data write was needed. Existing secret/database/environment ignore rules remain; the additional admin screenshots are ignored too.

Run the dedicated width/theme check from `frontend` with `npm exec playwright test -- --config playwright.admin.config.js`. It visits all four sections at **375 / 768 / 1280px**, in both **light and dark** mode, checking viewport fit, navigation, mobile/table layouts and product-table scrolling, and capturing screenshots in ignored `frontend/test-results-admin/`. Admin UI browser tests use fixture responses; the backend tests separately exercise the existing server-side role check. The purchase smoke still uses real local APIs and temporary SQLite storage with a simulated external Razorpay provider; actual hosted Razorpay checkout remains outside the verified scope noted above.

### Final Phase 8 checks

| Check | Result |
| --- | --- |
| Production build (`npm run build`, also run by the smoke command) | Passed |
| `npm run test:unit` | 17 passed, including four admin helper tests |
| `.venv/Scripts/python.exe -m unittest backend.test_store -v` | 3 passed |
| `npm test` | 120 passed in the final complete run (desktop + mobile, including 16 new admin cases) |
| `npm run test:smoke` | 2 passed; real local API purchase flow, simulated external Razorpay |
| Dedicated admin browser matrix | 6 passed; all four sections at each requested width/theme combination; confirmation screenshots reviewed |

The final full regression run passes without retries. Earlier checks exposed outdated assertions for the retired admin cards, which now target the new stats and read-only product table. Screenshot review identified the WhatsApp overlap and off-screen active mobile tab; both were corrected and the six-combination browser matrix passed again. A transient image-readiness timeout in the earlier concurrent run did not recur in the final full run; image assets and the existing image assertion were unchanged.

Phase 8 summary:

Phase 9 initial handover (2026-10-20; rejected and superseded by Phase 9b): see README's Phase 9 handover for the measured Lighthouse table, bundle/image sizes, test provenance and manual checklist. Core cold-mobile performance is below the requested 85 on all five audited pages; accessibility is 100, Best Practices 96 and public SEO 100. Private-page SEO remains intentionally lower because of noindex. Generated catalogue WebP/font assets are not yet integrated. Final source/optimizer changes have not received a complete suite rerun; an unqualified all-green final-workspace claim would be inaccurate. Stopped before Sportswear/content as requested.

- Delivery copy now promises free delivery on every order from one shared setting; the threshold progress bar is removed.
- The read-only admin dashboard and its four routes are complete; build, unit, backend, regression, purchase smoke and width/theme checks pass.
- Authentication, payment logic, API contracts and checkout totals are unchanged. Phase 9 and data/content improvements remain unstarted.

## Google authentication — Phase 1: configuration and prerequisites

Completed on 19 October 2026. This is Phase 1 of the separate Google authentication plan; the completed UI Phases 1–8 remain intact. Database migration, Google token exchange, hardening, RBAC and new account/login controls have not started.

### Changes

- Added Python prerequisites: `google-auth`, `requests`, `python-dotenv`, `slowapi`, `pytest`, `httpx`. Dependency compatibility checks pass.
- Added `backend/config.py`. Startup loads only `backend/.env` using `override=False`, before reading database/admin/payment environment settings. Existing process variables win. Tests and the smoke fixture explicitly disable local dotenv loading, so local credentials cannot enter their temporary environments.
- Moved credentialed CORS origins to `ALLOWED_ORIGINS`, defaulting to the existing two development origins. Explicit origins are normalized/deduplicated; wildcard, credential-bearing and path-bearing URLs are rejected. An empty allowlist disables cross-origin access. `SESSION_HOURS` controls new session/cookie lifetime, retaining the existing 24-hour default and existing stored-session expiries.
- Replaced populated values in `backend/.env.example` with placeholders and added `frontend/.env.example`. Expanded ignore rules to cover dotenv variants, dependency/build directories, SQLite data and test caches. Existing local environment files were not modified.
- Added the modular Firebase SDK, pinned to **12.19.0** for Node 22 compatibility, and `frontend/src/firebase.js`: one app/auth instance, in-memory auth persistence, and a Google provider with `prompt: "select_account"`. A separate dynamic import keeps Firebase out of the main storefront bundle. Missing Firebase configuration leaves password login usable. No Google login button or backend Google endpoint is enabled in this phase.
- Added backend configuration tests and browser initialization checks. Extended existing tests to verify that configured CORS origins and session lifetimes reach the running app, cookies remain HttpOnly/SameSite=lax, and session tokens remain hashed in SQLite.
- Updated the root README with Firebase console/provider/domain/web-app setup, configuration precedence, localhost guidance, installation and validation commands. The earlier example password should be rotated if used; changing provisioning environment variables alone does not update an existing SQLite user's password.

### Verification

| Check | Result |
| --- | --- |
| `npm run build` (also run by the purchase smoke) | Passed without build warnings; Firebase is a separate chunk |
| `python -m pytest backend/test_store.py backend/test_config.py -q` using the project virtual environment | 9 passed; 16 subtests passed |
| `python -m pip check` | No broken requirements |
| `npm run test:unit` | 17 passed |
| Targeted desktop/mobile browser regressions | 10 passed: Firebase app/auth singleton and provider, no Google network request on initialization, no Firebase auth-user storage, password login/register, protected account redirect, admin routes and normal-user denial |
| `npm run test:smoke` | 2 passed: built app + real local APIs + temporary SQLite + simulated external Razorpay; paid order persists in Account |
| Production database and existing frontend auth/payment files | Hashes unchanged across final checks |

All four required frontend Firebase configuration fields are present (values were not printed). `FIREBASE_PROJECT_ID` is absent from this agent's process environment; the user's separately configured backend terminal may have it. Supply it in the process that starts the backend or in `backend/.env` before the Google-token verification phase. This does not block Phase 1 or existing password login.

There was no schema migration or production database write. Existing AuthContext, API client, Login, Account, checkout payment hook and Razorpay loader are unchanged in this phase. No commit was created. The workspace has no Git metadata, so existing committed history could not be inspected; local dotenv files, database, dependencies and generated builds remain excluded by ignore rules. Real Google popup sign-in is deferred until the backend exchange and UI phases are implemented.

Phase 1 summary:

- Configuration loading, explicit CORS, configurable session lifetime, Firebase prerequisites and setup documentation are complete.
- Build, backend/unit/browser checks and the existing purchase smoke pass; production data and current frontend auth/payment flows are preserved.
- Stopped before Phase 2 (database migration), awaiting the user's go-ahead.

## Google authentication — Phase 2: database migration

Completed on 19 October 2026. Phase 3 has not started; no Google-token verifier or Google-login endpoint was added.

### Migration and compatibility

- Added `backend/migrations.py`, called at backend startup. It upgrades in one `BEGIN IMMEDIATE` transaction, checks `PRAGMA table_info`, and adds only missing fields. The transaction serializes competing workers and rolls back the entire upgrade on failure. No table is dropped or rebuilt.
- Users gain `google_sub`, `picture`, `auth_provider` (`password` / `google` / `both`), `email_verified`, `disabled`, `created_at`, `last_login_at`. A separate unique index enforces Google subject uniqueness while permitting multiple NULL subjects. Legacy accounts default to password/unverified/enabled; original IDs, names, emails, roles, salts and password hashes are unchanged. Unknown historical timestamps remain NULL.
- Sessions retain their original token primary key, user ID and expiry. Added opaque unique device IDs, `created_at`, `last_seen_at`, `user_agent` (maximum 200 characters), and `ip` (maximum 45 characters). Legacy IDs are backfilled once; original token hashes/expiries are never rewritten. New logins/registrations fill new metadata and use explicit INSERT columns. Existing session cookies still work; expired cookies remain expired.
- Added `audit_log(id, ts, user_id, event, detail, ip)`. Security event writers arrive in the later authentication/authorization phases; no historical events or timestamps are fabricated here.
- Password login now safely rejects NULL salt and/or password fields with exactly **HTTP 401 `{"detail":"Incorrect email or password."}`**, matching wrong passwords and unknown emails. Failed logins issue no session cookie. Existing customer and admin password login, account responses and order ownership behavior are unchanged.
- Added `backend/verify_migration.py`, `backend/test_migrations.py` and `backend/test_migration_auth.py`. Database backups such as `backend/store.db.bak` are now covered by `.gitignore`. No new packages or frontend changes were required.

### Two-pass copy results

The real backup was opened **read-only**, copied with SQLite's backup API into a `TemporaryDirectory`, and migrated there twice. **Neither migration run targeted `backend/store.db` or the backup itself.** The verifier checks every original column and row ID, all new metadata/schema after the second run, zero second-run row changes and `PRAGMA integrity_check`.

| Original-schema source → temporary test copy | Before | After first migration | After second migration |
| --- | --- | --- | --- |
| Workspace backup: users / sessions / orders | 2 / 0 / 0 | 2 / 0 / 0 | 2 / 0 / 0 |
| Workspace backup: admins | 1 | 1 | 1 |
| Populated fixture: users / sessions / orders | 2 / 3 / 2 | 2 / 3 / 2 | 2 / 3 / 2 |
| Populated fixture: admins | 1 | 1 | 1 |

**No original rows or values were lost or changed. The second migration was a no-op, including generated session IDs and schema. Integrity checks passed.** The populated fixture includes both customer/admin credentials, valid customer/admin sessions, an expired session, a paid order and a pending order. It supplies coverage for existing sessions/orders even though the workspace backup contains none.

Repeat the safe real-backup verification from the repository root:

```powershell
.venv\Scripts\python.exe -m backend.verify_migration --source backend/store.db.bak
```

The source must have the original schema. The verifier has no caller-controlled migration destination and always deletes its temporary copy on completion. Only counts and boolean pass indicators are reported; credential/session/order contents are not printed.

### Live startup versus migration tests

The user's existing backend was already running with auto-reload. The migration was first validated on copies, then connected to startup; that backend subsequently applied the tested additive migration during reload. This was normal startup, **not a migration test against the live database**. A read-only before/after fingerprint of all original columns and row IDs confirms that the live database still has the same two users (including its admin), unchanged credentials/roles, zero sessions and zero orders. Its integrity check is OK. The schema and new metadata fields were added as intended.

### Checks

| Check | Result |
| --- | --- |
| `python -m pytest backend -q` in the virtual environment | 20 passed; 16 configuration subtests passed |
| Real-backup temporary-copy verifier | Two passes; no lost/changed original rows; zero second-run changes; integrity OK |
| Legacy auth integration in isolated child processes | Old customer/admin passwords and old session cookies work; original orders remain owned by their users; expired sessions stay invalid |
| NULL-credential auth integration | Google-only NULL credentials, partial NULL credentials, unknown email and wrong password all return identical 401 JSON; no session is created |
| Metadata integration | New device IDs/timestamps recorded; agent/IP truncated; cookie/token hashing and existing API response shapes retained |
| Failure/concurrency tests | Partial upgrades resume; duplicate-subject failure rolls back atomically; concurrent startup workers serialize safely |
| `npm run build` (inside smoke) | Passed without build warnings |
| `npm run test:unit` | 17 passed |
| `npm run test:smoke` | 2 passed; built app, real local APIs, temporary SQLite and simulated external Razorpay; paid order persists in Account |

Phase 2 summary:

- Additive migration is complete and idempotent; two-pass temporary-copy tests preserve every original user/admin, credential, session and order value.
- Existing password login/session cookies work; NULL salt/password accounts receive the unchanged generic password-login error; all checks pass.
- Stopped before Phase 3, awaiting approval.

## Google authentication — Phase 3 (2026-10-19)

Implemented `POST /api/auth/google` with server-side Firebase token verification using google-auth and the configured `FIREBASE_PROJECT_ID`; no service-account key or production test bypass. The verifier checks signature through Google's verifier and explicitly checks issuer, audience, expiry, Google provider, verified email and subject. Missing configuration, malformed bodies and invalid credentials fail closed with the same generic 401 response. Verification runs in a thread pool so certificate fetching does not block the async request loop.

Returning accounts resolve by Google subject, then verified lower-cased email. Conflicting subjects cannot overwrite a link. Existing password accounts retain ID, name, password credentials, role and orders; verified linking adds `google_sub`, `auth_provider='both'`, picture and email verification. New accounts always have role `user`, provider `google` and NULL password credentials. Google login never creates/promotes an admin, and client/token role fields are ignored; an already provisioned admin retains its role. Disabled Google sign-ins fail with the required 403 before writes.

Account/link changes, the existing session helper, login timestamp and `google_link`/`google_login` audit records share one transaction. Every login issues a fresh cookie; only its hash is stored. Cookie flags/lifetime retain the existing behavior. `/api/auth/me` gains optional profile/provider/verification fields. Password login response shapes and payment handlers are unchanged; Google-only password login retains the generic `Incorrect email or password.` error. No ID tokens, passwords, session tokens or provider exception messages are logged. Audit records contain event, user ID, timestamp and peer IP only.

Files created: `backend/google_auth.py`, `backend/test_google_auth.py`. Files updated: `backend/app.py`, `backend/test_migration_auth.py` (the route now exists), `README.md`, `AUDIT.md`. No packages added in this phase; google-auth and requests were installed in Phase 1. No local environment or database files were edited by the tests.

| Check | Result |
| --- | --- |
| Virtual-environment `python -m pytest backend -q` | 44 passed; 16 configuration subtests passed |
| Google verifier/endpoint tests | 24 passed within the backend suite; Google verifier mocked, external network blocked in endpoint tests, isolated processes and temporary SQLite |
| Legacy migration/auth regression | Original-schema fixtures, two-pass migration, old customer/admin password login, old cookies and order preservation pass |
| Security cases | Invalid/expired/audience/issuer/provider/verification/subject claims, ignored admin role, disabled users, conflicting links, missing project, generic errors, credential-free logs, atomic rollback and production cookie flags pass |
| `npm run test:unit` | 17 passed |
| `npm run build` | Passed inside smoke; no Vite build warnings |
| `npm run test:smoke` | 2 passed; desktop/mobile, real local APIs, temporary DB, simulated external Razorpay; paid order persists in Account |
| Requested browser viewport/theme matrix | 6 passed: 375/768/1280px, light/dark; all four existing admin sections, no horizontal page overflow or page errors |

Run the mocked Google endpoint tests without obtaining any Google token:

```powershell
.venv\Scripts\python.exe -m pytest backend/test_google_auth.py -q
```

The tests send a dummy `id_token` through the actual endpoint and mock `backend.google_auth.id_token.verify_firebase_token`; the normally running application still rejects dummy tokens. Real Firebase sign-in and frontend Google-button/redirect testing remain for Phase 6. The viewport matrix uses the existing mocked admin fixture; purchase smoke uses real local backend APIs with only external payment services simulated.

Phase 3 summary:

- Google backend verification, verified account linking and atomic session/audit writes are complete; existing accounts and roles are preserved.
- Backend, unit, build, purchase smoke and six viewport/theme browser checks pass; sensitive credentials/provider errors are not logged or echoed.
- Stopped before authentication Phase 4, awaiting approval.

## Google authentication — Phase 4 (2026-10-19)

Authentication hardening is complete; Phase 5 authorization dependencies/admin user management have not started. The existing role model, catalogue, checkout totals, Razorpay transport and payment verification remain intact. The sole checkout handler addition is the explicitly opt-in verified-email gate, default false.

### Delivered

- SQLite-backed configurable rate limits: login 5/minute per IP + normalized email, registration 5/hour per IP, Google 20/minute per IP. Generic 429 messages include `Retry-After`; failures/lockouts survive reload and are shared between workers. Failure counters apply equally to nonexistent and existing emails. Default lockout is 15 minutes after 10 failures, escalating to 30/60 minutes for subsequent groups within the counter window. Successful login resets the email's failure counter.
- Development-only `python -m backend.reset_auth_limits` clears only throttle/failure tables. Tests prove users, credentials, sessions and orders remain unchanged; the CLI rejects `COOKIE_SECURE=true`. No reset was run against the live database. Limits/durations are configurable and all defaults are listed in README and the phase report.
- Custom-header + exact Origin/Referer protection on every state-changing API request, including login. The frontend wrapper supplies `X-Requested-With: vastre` for POST/DELETE. Missing/null/foreign/malformed Origin is rejected; a present bad Origin cannot fall back to a trusted Referer. CORS wraps error responses and exposes `Retry-After` to allowed clients.
- Expired-only session cleanup at startup/login and device listing. Valid legacy sessions survive, including legacy admin sessions with unknown last-seen timestamps. Separate 30-minute configurable admin idle policy; sliding last-seen updates. Owned session listing/revocation and logout-all endpoints expose no token hashes. Additive password/disabled triggers revoke all sessions. Session issuance checks again under the write lock so concurrent password changes/disabling cannot create a stale session.
- Password changes, Google-only set-password and account deletion with fresh credentials; subject-matched verified Google `auth_time` must be within five minutes. Deletion anonymizes the user and revokes credentials/sessions/verification links while retaining their ID and accounting order records; admins cannot use the deletion endpoint. The deletion UI remains for Phase 6. New passwords require 10–128 characters and reject common passwords; old 8-character PBKDF2 credentials still log in. New validation/error handling never echoes sensitive input or provider exceptions.
- Single-use, hashed, expiring email verification; resend limits; Account banner and `/verify-email` page. Verification links carry tokens in the URL fragment, avoiding HTTP access logs/referrers. Development console delivery plus optional SMTP/TLS adapter with redacted failures; production Secure-cookie mode never logs verification links. SMTP is mocked in tests and no real email was sent. `REQUIRE_VERIFIED_EMAIL=false` preserves checkout for existing customers by default.
- Security headers (nosniff, DENY framing, strict referrer policy, permissions, popup-compatible COOP, production-only HSTS) and an enforcing CSP. Inline theme code moved into public `theme.js`; inline script/eval remains disallowed while existing inline styles work.

### CSP rollout evidence

The first deployment/test mode was `Content-Security-Policy-Report-Only`. Normal pages passed the six 375/768/1280px light/dark combinations with no CSP console violations. The live Razorpay script revealed an additional `cdn.razorpay.com/static/cx/razorpay-risk-detection/bundle.js` dependency; its specific script host was added. After correcting popup request interception in the test fixture, the external dependency probe passed Report-Only too.

The default was then changed to **`CSP_MODE=enforce`**. Every normal page and both allowed/denied admin states were checked again at all six combinations, along with a live Razorpay script, live Google API script, live Google Fonts and a live Unsplash image. Deterministic fixtures verify Firebase/Google script/frame/connect/popup domains and Razorpay's API iframe origin. A negative control verifies an unlisted script reports under Report-Only and is actually blocked under enforcement. Normal page consoles have no CSP violations. Dependencies/probes use isolated browser contexts and no Google identity credentials; interactive Google sign-in awaits Phase 6. Purchase smoke simulates only the external Razorpay provider and SDK UI; local quote/auth/order/verification/Account APIs are real.

Backend CSP protects the built storefront served by FastAPI. Vite dev HTML does not receive backend document headers; README explains applying the same headers at another static host.

### Checks

| Check | Result |
| --- | --- |
| Virtual-environment `python -m pytest backend -q` | 57 passed; 21 configuration subtests passed |
| Hardening tests | 10 real-ASGI scenarios; temporary SQLite, mocked Google/network, real password hashes/cookies; CSRF, rate/lockout recovery, CORS errors, revocation/cleanup, ownership, fresh re-auth/deletion with order retention/admin protection, email opt-in and stale-login races |
| Migration and legacy auth regression | Two-pass additive migration remains idempotent; accounts/admin roles/credentials/orders preserved; only expired sessions removed during app startup; valid old cookies still work |
| Email adapter tests | 2 passed, mocked SMTP/TLS; production links/provider credential errors not logged; normal Windows TLS trust initialization separately passed |
| `npm run test:unit` | 18 passed, including CSRF POST/DELETE and separate legacy-login/new-registration password bounds |
| `npm run build` | Passed without Vite build warnings, inside final smoke |
| `npm run test:smoke` | 2 passed; desktop/mobile complete purchase through a persisted paid Account order under enforcing CSP and CSRF |
| Account, verification, Firebase and admin browser regression | 40 passed; desktop/mobile |
| CSP Report-Only rollout | 6 viewport/theme page checks + external dependency probe passed after resolving the observed CDN dependency |
| CSP enforcing rollout | 7 passed; 5 duplicate external probes intentionally skipped; normal pages clean, negative control blocked |
| Visual inspection | New account banner checked in 375px dark mode; responsive checks/screenshot capture at all six width/theme combinations |

New environment variables and defaults are documented together in README: LOGIN_RATE_PER_MIN=5; REGISTER_RATE_PER_HOUR=5; GOOGLE_RATE_PER_MIN=20; LOGIN_LOCKOUT_FAILURES=10; LOGIN_LOCKOUT_MIN=15; LOGIN_LOCKOUT_MAX_MIN=60; LOGIN_FAILURE_WINDOW_MIN=60; ADMIN_IDLE_MIN=30; REQUIRE_VERIFIED_EMAIL=false; EMAIL_VERIFICATION_HOURS=24; EMAIL_VERIFICATION_RATE_PER_HOUR=3; PUBLIC_BASE_URL=http://localhost:8000; CSP_MODE=enforce; SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD empty; SMTP_PORT=587; SMTP_FROM=no-reply@vastre.example; SMTP_STARTTLS=true. No new packages or frontend env variables were added. Local environment files and private database files remain outside the changes; all test writes/reset operations used temporary databases.

Phase 4 summary:

- Authentication limits, CSRF, session/password hardening and optional email verification are complete; development reset is documented and valid-session cleanup is preserved.
- Build, backend/unit suites, purchase smoke, 40 browser regressions and staged CSP/browser checks pass; final CSP mode is enforcing.
- Stopped before Phase 5, awaiting approval.

### Phase 4 follow-up: reset before migration

The development reset previously assumed both Phase 4 throttle tables existed, causing `no such table: auth_limits` against an older database. It now acquires a write transaction, checks the schema, and clears only existing throttle tables. If neither exists, it reports that the backend must be started/restarted to initialize them. Reset does not run migrations or modify application tables. Regression tests cover original schema, either partial-table state, both tables, repeated reset, missing database refusal and the production guard. All fixtures are temporary; no reset was executed against the live database. Targeted regression: 3 tests and 4 schema subtests passed. Phase 5 remains unstarted.

## Google authentication — Phase 5 (2026-10-19)

Completed RBAC/ownership and admin user management. Phase 6 Google-login and Account UI work has not started. Existing admin provisioning, stored roles/password hashes and account/order IDs remain intact. No Phase 5 migration or new production environment variables/packages were needed. All test mutations, account updates and public fixture credentials were isolated to temporary databases; the real admin account was not modified by tests.

### Permission map and dependencies

| Role | Allowed actions |
| --- | --- |
| Anonymous | Public catalogue/categories/coupons/quotes and sign-in/registration; protected actions require a session |
| `customer`, legacy alias `user` | `account:self`, `orders:own`, `checkout:own` |
| `support` | Same customer actions for now; no cross-customer/admin access |
| `admin` | Customer actions plus `admin:overview`, `admin:users:read`, `admin:users:write` |
| Unknown role | No capabilities; identity lookup/logout remain available |

The ad-hoc boolean admin helper was replaced with FastAPI `current_user`, `require_permission` and `require_role('admin')` dependencies. Every admin endpoint requires the admin role; normal users receive 403, anonymous/disabled/expired sessions 401, and denied admin attempts are audited, including CSRF rejection. Legacy `user` rows remain valid without rewriting their roles. Original-schema admin password/cookie regressions pass.

`GET /api/orders/{order_id}` filters by the authenticated user's ID and returns identical 404 JSON for missing and someone else's orders. Existing order listing and payment verification remain owner-scoped; the provider is never called for another user's payment verification. Admin customer-facing order reads remain owner-only; all-order visibility is available through the existing guarded admin overview. Payment calculation, Razorpay transport/signatures/capture logic and existing success response shapes are unchanged.

### Admin user management

Added sanitized, server-paginated/searchable/filterable `GET /api/admin/users` and guarded `PATCH /api/admin/users/{id}`. Public admin user fields include identity, role/status, provider/verification and timestamps, never salts, password hashes, Google subjects or session/token hashes. Search safely treats wildcard characters literally. Only this authenticated admin PATCH can accept a role assignment; role fields/claims remain ignored by public auth endpoints and Google login cannot create/promote admins.

Updates serialize under `BEGIN IMMEDIATE`, recheck the actor's live session/role, enforce self and last-enabled-admin protections, revoke all target sessions and audit each actual field change with actor/target IDs and old/new values. Role changes log `role_change`; status changes log `account_disabled`/`account_enabled`. No-ops leave sessions/audits unchanged. Independent guard tests cover last-admin protection, and concurrent real-ASGI requests cover both demotion and disabling: only one competing update succeeds and at least one enabled admin remains.

Added `/admin/users` to the existing dashboard, metadata and navigation. The Users tab has debounced name/email search, role/status/provider filters, shareable URL state, pagination, provider labels, honest legacy timestamp fallbacks, a desktop table/mobile cards and independent skeleton/error/retry/empty states. Confirmation dialogs focus Cancel, trap focus, close with Escape, show the proposed change, prevent double submit and retain failed changes with refresh/retry. Current and last-admin controls are disabled in the UI; server guards remain authoritative. Changes that empty a filtered final page return to an existing page without breaking back/forward history. Existing design tokens, paper/ink/orange palette, dark mode and type are preserved.

### Verification

| Check | Result |
| --- | --- |
| Virtual-environment `python -m pytest backend -q` | 71 passed; 25 subtests passed |
| New authorization tests | 11 passed: role map/aliases, independent last-admin predicates, admin gates/denial audits, sanitized search/pagination, own order detail/payment verification, self guards, invalid/no-op requests, audited session revocation and concurrent demotion/disabling |
| Legacy auth, migrations, hardening and payments | Passed within the full backend suite; original customer/admin cookies/passwords/roles/orders preserved |
| `npm run test:unit` | 21 passed, including malformed user metadata/role/provider fallbacks and current/last-admin action protection |
| `npm run build` | Passed without Vite build warnings, inside final purchase smoke |
| `npm run test:smoke` | 2 passed; desktop/mobile real local purchase APIs, simulated external Razorpay, paid order persists in Account |
| Existing admin browser regressions | 16 passed across desktop/mobile |
| Final Users browser regressions | 10 passed across desktop/mobile; access, filters, URL refresh/history, pagination shrink, Cancel/Escape, CSRF PATCH, skeleton/retry/empty/save errors |
| Real-API admin browser smoke | 2 passed; desktop/mobile, disposable seeded accounts, actual admin login/role/status changes, target cookies invalidated, self-disabling 409, owner 200/non-owner 404 |
| Requested visual/browser matrix | 6 passed: 375/768/1280px, light/dark, all five admin sections, Users cards/table and confirmation dialog, keyboard focus and no page overflow/errors |
| Enforcing CSP browser matrix | 7 passed, 5 duplicate dependency probes intentionally skipped; new Users page included and no normal-page CSP violations |

Visual review covered desktop/light, mobile/dark and the confirmation dialog together. One batched refinement split last-login dates/times for legibility and corrected screenshot scroll/focus capture; the final matrix passed. Existing global shell/other admin sections were retained. Google popup testing remains domain compatibility only until Phase 6; SMTP/payment transports stay mocked in fixtures. Test-only admin fixture configuration is isolated in the smoke server, never in production authorization code.

Phase 5 summary:

- RBAC dependencies, owner-only order detail and the responsive admin Users tab are complete; legacy admins and the `user` alias remain compatible.
- Self/last-admin guards, concurrency, auditing and session revocation are tested; backend/unit/build/purchase/admin/browser/theme/CSP checks pass.
- Stopped before Phase 6, awaiting approval.

## Google-auth Phase 6 — Frontend authentication and Account (2026-10-19)

Completed the approved frontend phase within the existing UI structure. No Phase 7 work started.

- **Google sign-in:** Login/Register now has the official multicolour inline Google mark, a minimum-44px button, an “or” divider, shared disabled/loading states and safe `next` navigation. `/admin/login` has no Google button, with the reason documented beside the conditional. SDK configuration failures list exact missing variable names and leave password login available. All four required `VITE_FIREBASE_*` values were present; values were not printed or changed.
- **Cookie authority:** the ID token is exchanged through the existing `/api/auth/google`; Firebase sign-out completes immediately after the backend response and before AuthContext/navigation. Credentials are transient and never logged or placed in local/session storage. Redirect fallback stores only the return path or security action. StrictMode cannot exchange a redirect twice. Friendly messages cover network, disabled account, rate limit, unverified email and unauthorized domain; user-closed/cancelled popups remain silent.
- **Account:** Profile adds a safe Google avatar/initials fallback, editable name, email, provider badges, verification status and the existing resend action. Security adds current/other devices, individual revoke, confirmed logout-all, password change/setup and a confirmed danger-zone deletion. Orders/Wishlist/Addresses and Overview remain intact. Sign-in metadata loads before sensitive controls are enabled, with retry on failure. Google-only password setup/deletion needs fresh Google identity; existing password accounts must enter the current password. Blocked re-authentication popups use redirect and require the action/password to be confirmed again. A fresh redirect credential is kept in transient memory for at most four minutes, used once and erased on cancel/unmount/expiry. Backend freshness/ownership checks remain authoritative; password changes log out every session, and deletion anonymizes the customer while preserving accounting orders. Admin deletion remains unavailable.
- **Profile endpoint:** additive authenticated/authorized/CSRF-protected `PATCH /api/auth/profile`, name only, trimmed and bounded to 1–80 characters. Existing identity/email/role/provider/session/orders are preserved; successful edits are audited. Added an isolated temporary-database test proving ownership, validation and ignored privilege/email fields.
- **Guards and shell:** reusable RequireAuth/RequireRole preserve full destinations in query `next` and existing navigation state. Admin links remain hidden from non-admins; forbidden routes render Access denied. Protected API 401 clears user state and announces/redirects once; 403 shows Access denied. Expected anonymous bootstrap and bad credentials remain inline; sensitive credential failures check whether the app session is still valid. Header shows avatar/name on desktop and the compact avatar on mobile. Existing brand, focus styles, tokens, themes and responsive Account navigation are retained.
- **Regressions fixed:** deduplicated concurrent session-expiry announcements; reused the initial admin overview request across StrictMode effect setup so an initial error cannot be hidden by a second fetch; kept Google loading distinct from password loading. Retained retry and refreshed data when leaving/re-entering Users. Test route matching was narrowed to avoid intercepting `src/api/client.js`; the real popup-close probe allows Firebase's cancellation polling to complete.

### Phase 6 verification

| Check | Result |
| --- | --- |
| `.venv/Scripts/python.exe -m pytest backend -q` | **72 passed, 25 subtests passed**; disposable SQLite only |
| `npm run test:unit` | **26 passed**, including mocked Firebase orchestration and protected/inline API errors |
| `npm run test:smoke` | Final build passed without Vite warnings; **2 passed**, desktop/mobile purchase → paid Account order, existing simulated external Razorpay |
| Existing `npx playwright test` regressions | **136 cases verified**: 134 passed initially; two discovered regressions fixed and both passed with `--last-failed` |
| Mocked Firebase/auth browser checks | **26 unique passing cases** across the auth run and final focused additions: success, loading, cancel, blocked-popup/redirect, domain/network/disabled/429/unverified errors, exact missing config, route/401/403 guards, profile, password/delete re-authentication, device revoke/logout-all |
| Requested browser/visual matrix | **6 passed**, `http://localhost:5173`, 375/768/1280px light/dark; Login/Profile/Security screenshots reviewed in two bounded batches |
| Opt-in real Google entry probe | **Passed**: actual Firebase config, popup reaches `accounts.google.com` from localhost, then closes silently and enables the form. No Google identity/credentials submitted and no real session exchange claimed |
| Enforcing CSP browser checks | **2 passed** at 1280/light: deployed pages including new Profile/Security, plus Razorpay/Google/Fonts/Unsplash/domain compatibility; policy stays **enforcing** |

The mocked browser module exists only in Playwright interception; production code contains no token-verification bypass or test credentials. The real full Google identity → app cookie → Google-authenticated test purchase still requires the user's interactive account; exact steps and expected results are in README's “Manual real Google sign-in check”. No packages, production environment variables or database migration were needed. `.env` and `backend/store.db` were untouched, and no secrets were added to source.

Phase 6 summary:

- Google Login/Register, Profile/Security, route protection and session-error handling are complete in the existing shell.
- Build, backend/unit/browser/theme/purchase/CSP checks pass; a real Google popup opens and cancels correctly, while full identity sign-in remains an interactive manual check.
- Stopped before Phase 7, awaiting approval.

## Frontend shared-browser privacy fix (2026-10-20)

- Added one owner-scoped data context and storage helpers for cart, wishlist and addresses: `:guest` when anonymous and `:u<user-id>` when authenticated. Legacy unscoped keys migrate to guest and are removed; the old already-account-scoped address format migrates only for its original user. Existing user data is never assigned to another owner.
- Password and Google login use the same owner transition. Guest cart variants merge using maximum quantity (never addition), bounded to 10; wishlists use union. Guest addresses are not merged, and guest records are consumed/discarded on login. Previously saved account data stays under its own storage keys and restores when that account returns.
- Owner changes synchronously replace the active data before descendants render. The scoped UI lifetime resets cart drawer, header counts, cart/wishlist pages, address book, checkout fields, coupon/quote/error/confirmation state and pending callbacks. Old-owner setters cannot mutate the new owner's data. Old account snapshots are not retained in an in-memory owner cache. Existing malformed cart normalization and unavailable-item removal were kept.
- Updated browser fixtures/assertions to use scoped storage and real-shaped user IDs. The purchase smoke now asserts that guest address/coupon state clears at login, then refills/reapplies it before the unchanged checkout. Backend source, API shapes, auth/payment logic, `.env` and live customer database were untouched.
- Browser-wide state remaining: theme and announcement dismissal (low-risk preferences), recently viewed product IDs (can reveal shopping interests), and a temporary Google redirect destination/action. Per-owner localStorage is display isolation, not encryption; retained customer addresses remain readable through browser storage access.

Validation: build passed; **33 unit tests passed** (7 new storage tests for keys, merge limits, migration/idempotence, address ownership, malformed/unavailable rows and blocked storage); **32 targeted desktop/mobile regressions passed**, including all 8 new ownership cases; **2 purchase smoke tests passed**, using real disposable local APIs with the existing simulated external Razorpay transport. Phase 7 remains unstarted.

## Google-auth Phase 7 — Tests (2026-10-20)

Audited every Phase 7 requirement against the existing suites, retained good coverage and added 14 focused backend TestClient cases plus two frontend failure-path cases. No production auth, authorization, payment, endpoint or UI implementation was changed; no packages were added. Phase 8 remains unstarted.

### Coverage and safety

- Google create/repeat and verified-only password-account linking; invalid/unverified/wrong-audience/expired/wrong-provider tokens; unchanged existing roles/passwords/orders; ignored client admin claims; safe errors and credential-free logs are covered. A new independently named TestClient case explicitly creates a Google customer with attempted admin claims, then proves **GET `/api/admin/overview` returns 403** (and `/api/admin/users` is denied).
- Disabled Google/password accounts cannot log in; disabling an account invalidates existing cookie replay. Rate-limit boundaries produce 429/Retry-After, progressive lockout recovers under a controlled clock, and a new case compares complete response/status/Retry-After triples for known and unknown emails.
- CSRF now has an explicit POST/PATCH/DELETE matrix across Google authentication, profile, sessions and payments, for both missing custom header and foreign Origin. Verifier/payment handlers are never called on these failures. Existing positive Origin/Referer/CORS checks remain.
- Owner-only orders return the same 404 for missing/foreign orders; anonymous/customer/admin gates yield 401/403/200 as appropriate. Legacy role aliases, self-demotion/disabling, last-admin checks, concurrent admin changes, audits and revocation remain covered. New TestClient replay cases independently prove both first/second-device cookies fail after logout-all and after password change.
- Migration tests build an independent **original-schema** SQLite database (handwritten original users/sessions/orders DDL) in a temporary directory, then verify a temporary copy twice. The fixture has **2 users (one admin), 3 sessions and 2 orders**, identical original rowids/columns/counts after both migrations, unchanged original-source bytes, integrity `ok`, and zero second-run changes. Separate integration cases confirm valid old cookies/passwords/admin roles/orders survive app startup; expired sessions alone expire. No live store or `.bak` customer database was used.
- New pytest safety setup selects a temporary fallback DB before collection, disables dotenv/bootstrap/SMTP, refuses SQLite paths outside the temporary tree (including the live store), and is itself tested to reject the live path **before opening it**. Child-process helpers assert their own temporary database root before importing the app.
- Frontend mocked Firebase covers popup success/cancel/block/redirect/resume, loading, errors, re-authentication, immediate Firebase sign-out, missing config, admin login without Google, RequireAuth/RequireRole/next, 401/403 and owner resets. Added backend Google 401 staying inline and backend network failure cleaning up Firebase. Updated one stale real-admin-smoke URL assertion for the already-shipped `next` query; no application change was needed. Existing full regressions and both real local purchase smokes pass.

### Completed runs

Counts below are collected cases with parametrized inputs expanded, each backend case assigned one primary area. Nested subtests are separate.

| Area | Passed |
| --- | ---: |
| Backend Google auth | 25 |
| Backend rate limiting / lockout / reset | 6 |
| Backend CSRF | 9 |
| Backend sessions / credential hardening | 8 |
| Backend RBAC / ownership | 11 |
| Backend migration / legacy compatibility | 11 |
| Backend other compatibility / isolation | 16 |
| **Backend total** | **86 + 25 subtests** |
| Frontend unit | 33 |
| Full storefront desktop/mobile regression | 144 |
| Mocked Firebase auth browser cases | 28 |
| Purchase smoke (desktop/mobile, real temporary APIs, simulated external Razorpay) | 2 |
| Admin smoke (desktop/mobile, real temporary APIs) | 2 |

`npm run test:browser` is the new consolidated browser command: the existing suite followed by the auth config at `http://localhost:5173`, including 375/768/1280px in light/dark. All six layout runs passed. Auth skips total 116: 110 deliberately redundant behavioral copies and 6 opt-in real-popup entry probes. These are not counted as passes. The final smoke also built the frontend successfully.

Exact run commands, from the repository root:

```powershell
.venv\Scripts\python.exe -m pytest backend -q
Push-Location frontend
npm.cmd run test:unit
npm.cmd run test:browser
npm.cmd run test:smoke
npx.cmd playwright test --config playwright.admin-smoke.config.js
Pop-Location
```

The README now maps every area to coverage, documents marker selection (for example `-m migration`), and includes a Phase 7 manual checklist with a temporary-database-only backend launcher. Full real Google identity/consent → app cookie → purchase, real blocked-popup/third-party-storage behavior, actual Razorpay sandbox interaction and SMTP delivery still require external services/user interaction. Their contract behavior is mocked automatically; no real identity, mail delivery or gateway settlement is claimed. The optional real-popup probe was not run in this phase. Manual checks include popup success, silent close, blocked → redirect, expiry, protected-route next, normal-user admin denial, no Google admin button and an Account paid order after test checkout.

Phase 7 summary:

- Every prompt requirement is covered; explicit Google-customer admin denial and original-schema idempotence checks pass.
- Backend, unit, full browser, responsive auth and both purchase/admin smoke suites pass using temporary databases only.
- Stopped before Phase 8, awaiting approval.

## Google-auth Phase 8 - Documentation and final checks (2026-10-20)

README now contains the implemented Browser/Firebase/backend/session-cookie sequence diagram, complete security-settings table (local observation, defaults and production actions), Firebase setup, permission map, first-admin provisioning/rotation and development lockout reset guidance. It includes an HTTPS/secure-cookie/origins/base-URL/Firebase/SMTP/backup deployment checklist and step-by-step real Google, actual Razorpay test checkout and SMTP acceptance using a new temporary database. Earlier phase results remain historical; this section is the final handover.

### Security findings and limits

- Found a populated admin password and a personal Gmail address in `backend/.env.example`, despite older placeholder-only claims. Removed both without reproducing their values; also replaced the public project identifier with a generic placeholder. **Any account using the exposed password must be rotated through Account Security.** Editing bootstrap environment variables does not rotate existing database credentials. No actual .env file, live database, backup, account or payment logic was changed.
- A redacted scan of 183 source/document/template files found no remaining copies of configured private credentials or private-key markers, and no non-reserved personal emails in README/AUDIT/example templates. Reserved example-domain identities and explicitly public test-fixture credentials are intentional; no actual credential values were added to documentation. This targeted scan is not proof that no unknown secret exists.
- **No Git metadata exists in this checkout.** Git index/tracking/history could not be inspected, so secret-free commits cannot be confirmed. .gitignore now covers env variants (except example templates), SQLite files/backups/journals and browser output folders at any depth. Local backend/frontend .env files, store.db, store.db.bak and test-results directories exist and were retained. Ignore rules alone cannot remove previously tracked files. README requires a real-index/history scan before publishing.
- Configuration-only inspection (no app import or database connection) found CSP enforcing, local Secure=false, 24-hour sessions, 30-minute admin idle expiry, default 5/min login, 5/hour registration, 20/min Google limits, progressive 15/30/60-minute lockout after each 10 failures and REQUIRE_VERIFIED_EMAIL=false. Local SMTP is configured but delivery was not exercised. The full setting/header table is in README, including HSTS (absent locally; one year plus subdomains when Secure=true), CSRF Origin/header checks and production changes.
- Password/ID-token/raw-session-token exclusion and sanitized provider/validation errors are tested. Development console email fallback intentionally logs sensitive verification links, including disposable smoke links; production Secure=true requires SMTP and does not log those links. Restrict development logs and disable proxy/APM credential capture. CSP permits required provider domains and inline styles; no nonce-based strict policy or reporting receiver is implemented.
- Per-owner browser storage prevents accidental cross-account display, not DevTools access/encryption. Recently viewed IDs remain browser-wide and may reveal shopping interests; theme/announcement preferences are low risk. No live migration, database inspection or real identity/payment/mail operation was performed in Phase 8.

### Remaining acceptance and product decisions

Real Google consent/token exchange, deployed redirect behavior, actual Razorpay sandbox capture and SMTP inbox delivery require the operator-run README checklists. Public resource/domain probes and mocked flows do not establish these end-to-end external outcomes. HTTPS/proxy/header behavior and credential rotation must be verified on the deployment, and Git tracking/history must be checked from a real clone.

Product choices left: server-side cart synchronization, admin product editing, real reviews, whether to keep delivery universally free or implement a server-calculated fee, and order emails. SQLite remains suitable for small traffic on persistent single-host storage; README explains consistent backups/restore testing and moving to hosted storage for write contention, multiple writers/hosts or availability requirements.

### Final validation

Backend **86 tests + 25 subtests**, frontend **33 unit tests**, build, **2 purchase smokes**, **2 real-API admin smokes** and **28 mocked Firebase browser checks** passed. Authentication layouts passed at 375/768/1280px in light/dark; 116 redundant/opt-in auth cases were intentionally skipped. All database tests used temporary storage and the pytest live-database guard.

CSP Report-Only: **2 passed** at 1280/light. CSP enforcing: **7 passed**, including all six responsive/theme page checks and the once-only public dependency/domain compatibility probe; **5 redundant external-probe copies skipped**. The negative control was reported in both modes and blocked only in enforcing mode. Final configured mode remains **enforcing**. One Windows transport connection-reset diagnostic appeared during a successful CSP run, without browser page errors or unexpected policy violations; NO_COLOR/FORCE_COLOR runner warnings are environmental. No provider identity/payment/mail success is inferred from resource loading.

The full storefront run exposed a viewport-dependent lazy-image assertion: it expected all off-screen category images to have loaded. Updated only that test to scroll each image into view before checking successful decoding; no application/auth/payment behavior changed. Initial full run: **143 passed, 1 failed** (old desktop assertion). Corrected targeted run: **2 passed** on desktop/mobile, so all 144 distinct storefront cases have passing verification across the full run and rerun. The initial `npm run test:browser` command exited nonzero and skipped its chained auth command; auth was run separately and all 28 checks passed. No claim of a second all-green full-suite invocation is made.

Verified **14 ignore-rule cases** in an independent temporary Git repository: private env variants, database/backup/WAL and browser artifacts are ignored; both example templates and README/AUDIT remain includable. This tests patterns only and cannot establish tracking/history status in the actual workspace. New README anchors and code fences also validate.

Phase 8 summary:

- Documentation, security configuration/production table, external-service checklists and product decision list are complete; AUDIT remains in the workspace.
- Credentials were removed from the example, ignore protections verified, and final checks pass with the explicitly recorded storefront-test correction/rerun; CSP ends enforcing.
- Operator actions remain: rotate the exposed password if used, inspect Git index/history from a real clone, and complete real Google/Razorpay/SMTP plus HTTPS acceptance. No further phase or deployment was started.


## Phase 9b final report - 2026-10-20

Generated assets are integrated: existing catalogue photos use responsive WebP candidates on cards/gallery/home/lookbook; remote Unsplash and known local files share the sizing helper. Eight used font faces are WOFF2 with swap and above-fold preloads. Original photographs/typefaces remain unchanged. Home's hero and the Product lead are high priority; the lead preload is present in initial FastAPI HTML. The Product loading placeholder reserves viewport space, eliminating its measured layout shift. No auth/payment logic, API shape, catalogue content or live database was changed.

Final Lighthouse 12.8.2 cold mobile simulation against the compressed FastAPI production build (not Vite dev), with browser suites stopped:

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home | 77 | 100 | 96 | 100 |
| Shop | 87 | 100 | 96 | 100 |
| Product | 91 | 100 | 96 | 100 |
| Cart, empty | 93 | 100 | 96 | 66 |
| Login, anonymous | 92 | 100 | 96 | 66 |

All revised Phase 9b performance targets are met. Private Cart/Login/Account/Admin retain noindex intentionally. Home still misses the original Phase 9 target of 85; its headline LCP is 5.41 seconds (4.94 seconds simulated render delay, roughly 474 ms measured JavaScript evaluation/parsing, no attributed third-party script). Public prerendering would be a separate next step, not further tuning in this bounded pass. Product LCP is 2.99 seconds and CLS is zero, versus CLS 0.949 in the first integrated diagnostic. No Lighthouse warnings.

Final checks: Prettier pass (including changed browser test files); production build pass with no Vite warnings; backend 96 tests plus 25 subtests; unit 41; storefront 144 in one full single-worker invocation; auth 28 with 116 intentional skips; purchase smoke 2; admin smoke 2; production quality 48 with 48 intentional skips; enforcing CSP 7 with 5 redundant probe skips. All pass. The responsive matrix covers 12 viewport/theme combinations, including 320, 375, 768, 1280, landscape and 1920. Settled mobile/desktop screenshots were inspected. Runner color-environment warnings remain unrelated to the build. All database tests used temporary databases.

Diagnostic corrections: gallery assertions now distinguish responsive lead URLs from full-size lightbox URLs and verify deferred neighbour loading; session-expiry assertions are scoped to Notifications, avoiding collision with the route-loading status. The duplicate concurrent browser run was stopped after contention timeouts. Final suite results come from complete sequential browser runs, not merely targeted reruns.

Delivery budget: startup JS 494.55 -> 321.50 kB (gzip 151.86 -> 102.58); initial CSS 84.91 -> 67.86 kB (gzip 14.79 -> 12.60); hero 986.84 -> 38.51/110.32/198.76 kB responsive WebP. Eight active font faces total 517,936 original TTF bytes versus 203,976 WOFF2 bytes; these are declared-face totals, not startup downloads.

Dependency review: production npm audit zero; installed Python pip-audit zero known vulnerabilities. Same-major grpc-js override resolves 1.14.6, removing the unused Firestore branch's production findings. No force/major upgrades. Full development npm audit retains 19 moderate and eight high affected-package entries: basic-ftp, extract-zip, get-uri, pac-proxy-agent, proxy-agent, @puppeteer/browsers, puppeteer-core and lighthouse. README contains the package-by-package versions, reachability and fix paths with advisory sources. They are development-only; current runner uses installed Chrome/local URLs and does not invoke vulnerable FTP listing or ZIP installer paths. basic-ftp's patched 6.2.1 requires a major upgrade from 5.3.1; extract-zip has no patched release for its two high advisories. Upstream replacement/repair or an approved toolchain change is still required; these findings are not called resolved.

Manual checks remain real Google, Razorpay TEST checkout, SMTP delivery, real-device assistive technology and deployed HTTPS/CSP/search/social previews; README retains step-by-step instructions. No real provider success is inferred from automated mocks/resource tests. Stage 2 Sportswear/content is not started. Stopped after Phase 9b.


## Stage 2 - data and content (2026-10-21)

Added Sportswear with 10 products, bringing the catalogue to 60 products across six categories. The original 50 IDs/names/categories remain unchanged, protected by backend/fixtures/original_catalogue_ids.json. Public catalogue data is now editable in backend/catalogue.json and loaded by the database-free backend/catalogue.py; backend/app.py imports the same CATEGORIES/PRODUCTS. No database migration or private database access was needed.

Every item has a globally distinct positive INR price and compare-at >= price, plus a specific two-sentence description. Additive optional fields are fabric, fit, colors (name/hex), weight_kg, rating and review_count; care/size-guide/image-reference metadata is optional too. Fit/palette/fabric render without changing cart/order shapes. Palettes are read-only with a visible note and code comment that colour is not an order selection. All actual ratings are null and review counts zero; a mocked UI test covers real-valued rating display without inventing live reviews. Specifications are proposed merchandising content for merchant review.

The full 60-row selling-price/compare-at/weight review table is [CATALOGUE.md](CATALOGUE.md). Category unpackaged weight estimates: Shirts 0.25 kg, T-shirts 0.18, Trousers 0.45, Jeans 0.65, Hoodies 0.60, Sportswear default 0.35. Sportswear overrides: performance tee 0.18, shorts 0.20, joggers 0.35, jacket 0.40, tights 0.22, vest 0.14, sports hoodie 0.55, compression tee 0.17, tracksuit set 0.80, windcheater 0.25 kg. Shipping totals/rules remain unchanged; confirm physical garment and packaging weights before shipping integration.

Seven new men's activewear photographs returned HTTP 200 and passed visual review. Each Sportswear product has three distinct references from that curated pool; these are labelled styling references, not exact SKU/colour photographs. Sources/authors/license URLs are recorded in frontend/public/images/sportswear-sources.json. No existing photograph needed replacement. The Phase 9b pipeline now provides 69 responsive WebPs for 23 originals; all 92 files decoded successfully. Cards, galleries/lightbox, home, admin/cart/order images use sized candidates with explicit geometry. Lead images remain preloaded/high priority, below-fold images lazy. CSP is enforcing without directive changes.

Sportswear is included in navigation, search/filter choices, home tile/skeleton layout, footer/empty-bag links, admin Products and the generated sitemap (69 public URLs). Content-specific checks cover 375/768/1280px in both themes and include zero axe AA violations/CSP errors; mobile/desktop screenshots inspected.

Final production Lighthouse mobile cold-cache results: Shop 89/100/96/100 (Performance/Accessibility/Best Practices/SEO), Performance Training Tee 85/100/96/100. Shop improved from Phase 9b's 87 and exceeds 85. Shop LCP 3.54 s, CLS 0.00009 unchanged; Sportswear LCP 3.95 s, CLS 0. No audit warnings. The Sportswear measurement is a new page, not a same-page comparison with the previous Linen Sun Shirt score of 91; LCP still exceeds 2.5 s. The FastAPI production build was compressed, with suites stopped during measurement.

Final-state results: Prettier pass; production build pass without Vite warnings; backend 99 plus 25 subtests; unit 43; full storefront 146; auth 28 (116 intentional skips); purchase smoke 2; admin smoke 2; content/legacy-cart suite 12; responsive/accessibility 48 (48 intentional skips); enforcing CSP 7 (5 redundant probe skips); image decoding 92 files. All pass. The final backend run includes the repriced-hoodie historical-order test: stored INR 1,990 order amount/details remain unchanged while the current price is INR 2,190. All 50 original IDs quote successfully in batches; an old six-item unscoped browser cart migrates, retains IDs and survives reload. Existing malformed/unavailable cart and owner-isolation checks pass.

All database tests used temporary databases; backend/store.db was never used. Auth/payment handlers, API request shapes, security settings, database schema and delivery pricing were not changed; only product responses have additive optional metadata. No new packages. A diagnostic admin-link test selector was corrected to match existing per-product accessible names; final results are complete passing suite invocations. README documents commands, field/asset handling and remaining merchant/manual-provider acceptance checks. Stage 2 stops here; no further work started.
