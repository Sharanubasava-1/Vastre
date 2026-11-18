# Frontend foundation

`src/App.jsx` composes providers, the shared shell, and the route table. React Router owns navigation; `ScrollToTop` resets scroll when the pathname changes; query-only filtering and pagination retain the current scroll position.

- `api/client.js` preserves the `/api` prefix, cookie credentials, JSON POST bodies, and API error handling.
- `AuthContext` owns the session and login/register/logout operations.
- `CartContext` owns item variants, quantity changes, localStorage persistence, coupon/quote/address state, and the live bag drawer. The header opens the drawer; the existing `/cart` route handles checkout.
- `CatalogContext` loads products and coupons once per application mount.
- `ToastContext` exposes `notify(message, type)` (`success`, `error`, or `info`) and `dismiss(id)`; up to five notifications stack, auto-dismiss after four seconds, and can be closed individually. Passing an empty message clears the current notification.
- Pages own their local form and gallery state. Account and admin pages fetch their data when mounted with an eligible session.
- `styles/tokens.css` contains shared presentation values. `base.css` contains document defaults; `components.css` contains shared controls, the shell, and responsive page styles. `styles.css` is the import entry point.
- `ErrorBoundary` catches rendering failures and provides reload recovery. Missing routes and missing products use `NotFound`.

Run `npm run build` for the production build, `npm run test:unit` for listing/URL logic checks, and `npm test` for desktop/mobile browser regression checks. Tests use installed Chrome and mocked API responses, including a simulated Razorpay callback; they do not contact the payment service or validate the live backend. The test server uses port 5180. Production hosting must serve `index.html` for application URLs while forwarding `/api` to the backend.

## Design system and shell

Edit the announcement and help copy in `src/config/storefront.js`. Dismissal is versioned by announcement text so an updated message appears again. Help panels provide contact guidance; no shipping or returns policy is invented.

`ThemeContext` follows the system preference until the header toggle chooses light or dark. The choice is stored as `vastre-theme`; storage failures leave the current session usable. A small initialization script sets explicit preference before the first paint. Theme-specific colors are defined in `tokens.css`; shared type, spacing, radius, elevation and motion scales apply to both themes.

`Drawer` uses a native modal dialog, explicit Tab wrapping, Escape handling, scroll locking and trigger focus restoration. The mobile menu, bag, wishlist, search and footer help use this component. Search matches the loaded catalogue by product name and category; the wishlist is local only. Newsletter signup is a UI preview that displays a success toast without storing or sending the email.

`Button` supports `loading`, `disabled` and dark/light/ghost variants. Use `aria-invalid` plus a linked `.field-error` for form errors; chips use `.chip` and `aria-pressed`, and labels use `.badge`. All interactive controls share the orange focus ring. Route transitions and other animations turn off with reduced motion.

Fonts are self-hosted under `public/fonts`; their OFL licenses are included. FastAPI serves `/fonts` and `/images`, and Vite copies these public assets into the production build. Browser tests cover both themes, shell persistence, focus containment, Escape/focus restoration, newsletter behavior, toast lifetimes, reduced motion and the existing purchase API contracts.

## Editorial home page

The nine home sections live in `pages/Home.jsx`; the route-specific layout is in `styles/home.css`. The existing local men's photos provide the hero and story. Category counts come from the catalogue; a curated local category image is used when a collection has no image or is empty. Loading categories display skeletons instead of empty image elements.

New arrivals and bestsellers match the actual `tag` value (`New in` / `Bestseller`, case-insensitive). No extra items are relabelled to fill a section. The carousel uses native scroll snap, keyboard/touch scrolling and desktop previous/next controls with boundary states. The second hero CTA scrolls to new arrivals on the page.

Offers use the shared `/api/coupons` response and have their own loading state. The lookbook links up to six products, preferring different photographs; empty datasets display useful collection links. Newsletter forms share `NewsletterForm` and remain UI-only. The hero zoom, skeleton pulse, hover effects and carousel smooth scrolling respect reduced motion.

## Listing and search

`pages/Shop.jsx` reads filter, sort, density and pagination settings from the query string. The URL is the single source of truth. BrowserRouter uses synchronous location updates so controlled filters and browser history remain aligned; visual route transitions are provided by CSS. Repeated `category`, `size`, and `tag` parameters allow multi-selection; `min` and `max` are inclusive INR amounts. `q` matches name/category; `sort` accepts `featured`, `new-in`, `price-asc`, `price-desc`, or `name-asc`. `columns` accepts 2/3/4 on desktop; `limit` starts at 12 and increases with Load more. For example: `/shop?category=Shirts&size=M&min=1000&sort=price-asc`.

Filters combine with AND across groups and OR within a group. A category route such as `/shop/Shirts` stays intact until the category selection changes. Clear all resets filters, search, sorting and pagination while retaining density. Desktop filters apply immediately. Mobile opens an accessible bottom sheet with a draft; Apply commits it, Escape discards it, and Clear all resets the draft. Invalid price ranges disable Apply.

`SearchOverlay` uses a 200ms debounce, up to eight instant results, Arrow Up/Down selection and Enter navigation. The header button, `/` (outside inputs), Ctrl+K and Cmd+K open it; Escape closes it. View all results navigates to `/shop?q=…`. These interactions reuse `/api/products` data without issuing extra product requests.

Shared product cards reserve a 4:5 media frame with explicit image dimensions. A second image crossfades on pointer hover when available. Discount percentages are rounded from the actual price/compare-at values. Quick add opens a small modal size chooser, preserves the existing cart variant/quantity behavior, and disables sizes already at the ten-item limit. Wishlist state remains local. `styles/shop.css` owns the listing, search and shared card refinements.

## Product detail

`pages/ProductDetail.jsx` composes the gallery, size guide, delivery checker, purchase controls and recommendations. Gallery thumbnails, mobile swipes, keyboard lightbox navigation, zoom and next-image preloading share one image index. Modal focus, Escape and focus restoration reuse `Drawer`.

A size must be chosen explicitly. Quantity is capped at ten per variant, including items already in the bag. Add shows loading, then Added, then opens the bag drawer. The mobile purchase bar appears only after the main purchase controls scroll above the viewport. Wishlist and recently viewed IDs stay in localStorage; storage errors are tolerated. Recent history is deduplicated, capped at twelve and excludes the current item from recommendations.

Ratings are labelled placeholders when absent. Size tables are explicitly illustrative sample measurements, not product-specific measurements. Fabric composition is not invented. `services/delivery.js` isolates the UI-only PIN estimate; it makes no serviceability or carrier request and labels its dates as a demo.

`PageMetadata` updates document titles and descriptions on routes, and product Open Graph/INR price tags. These tags are client-rendered; social crawlers that do not execute JavaScript will require server-rendered metadata in a later deployment change.
## Bag, checkout and offers

`CartDrawer` and `Cart` share accessible plus/minus steppers, an empty bag with category links, and a free-delivery note. Delivery is free on every order, with no threshold progress bar. This copy is edited in `src/config/storefront.js` (`DELIVERY_COPY`) and reused in the announcement, Home trust strip, product details, bag and drawer. The drawer has separate View bag and Checkout links; Checkout opens the address section. The backend adds no delivery charge, so summaries display ₹0 without changing the payable amount.

`components/checkout/AddressForm.jsx` supplies labelled structured fields with blur/submit validation and reserved error space to prevent clicks being interrupted by layout shifts. `utils/checkout.js` validates a ten-digit Indian mobile number and six-digit PIN, then joins the fields into the existing `address` string. Address data stays in provider memory, including during login; it is not written to browser storage. Login initiated from checkout returns to the address section.

Coupon application and quick-apply offers use `/api/checkout/quote`. Only validated quotes affect totals and payment payloads. Editing the bag invalidates its quote; in-flight quotes for a previous bag or an unmounted page are ignored. Applied codes can be removed. Offer tickets copy codes through the Clipboard API with a manual-copy fallback, and Apply in bag validates the offer when the bag contains items.

`services/razorpay.js` shares the SDK load promise, bounds loading to 15 seconds, removes failed script tags and permits retries. `hooks/useCheckoutPayment.js` holds a synchronous lock through order creation, the open checkout and server verification. It handles dismissal, provider failure and duplicate callbacks. Verification failure retains the bag and directs the customer to their orders before paying again. Confirmation appears only after `/api/payments/verify` succeeds, and shows the order ID, purchased items, address and amount returned by the payment order. Purchased quantities are removed while preserving items added during payment. Confirmation is kept for the current page visit; persistent order records remain in the account.

The Razorpay callbacks follow the [official Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/). Browser payment tests simulate the SDK and server responses; they do not charge a card or validate a live merchant account.
## Authentication, account and wishlist

`pages/Login.jsx` provides responsive image/form panels, keyboard-operated Log in/Create account tabs, password visibility, registration strength guidance and inline validation. Password strength is advisory; the required 8–128 character bounds match the backend. A synchronous submit lock and disabled controls prevent duplicate requests. AuthContext tracks the initial session request and ignores stale session responses after authentication changes.

`utils/auth.js` accepts only internal return destinations and rejects login loops, protocol-relative links and external URLs. Protected account visits preserve their pathname/query/hash through login or registration. Header login returns to the current page, and checkout keeps its existing address destination and in-memory form values.

The account sidebar uses shareable `/account?tab=overview|orders|wishlist|addresses` links. Orders load from the existing `/api/orders` endpoint with loading, retry and empty states. Cards show the actual amount in paise converted to INR, paid/pending status, and a date only when supplied. Expandable items read the backend `details` JSON, with support for payload/item arrays and a safe legacy fallback. Item names/images use the current catalogue; historical per-item prices are not invented.

`hooks/useSavedAddresses.js` stores addresses under `vastre-addresses:<user ID or email>` so records are scoped to the signed-in account. The address book supports add/edit/remove and Use at checkout. There is no address endpoint or server sync. Storage failures leave addresses usable within the current account view and show a clear toast.

The public `/wishlist` page and account Wishlist section share `WishlistList`. Existing heart buttons, detail-page controls and the header count use the separate `vastre-wishlist` key. Move to bag requires explicit size selection, adds the chosen variant, removes the saved item and opens the bag drawer. Unavailable catalogue items remain saved until the customer removes them. The header keeps its wishlist preview and links to the dedicated page.
## Step 0 audit and integrated purchase smoke

See `../AUDIT.md` for the Phases 1–7 checklist, fixes and verification results. `npm run test:smoke` builds the production frontend and runs `playwright.smoke.config.js` on desktop and mobile against the real local backend with temporary SQLite storage. The external Razorpay provider/widget is simulated; no payment is made and real credentials are not used. Production auth and payment code is unchanged. Run the normal browser regressions separately with `npm test`.

Saved-bag restoration now drops malformed rows and duplicate variants before they can reach the header. Products missing from the loaded catalogue have an explicit removal action in the bag and drawer; catalogue failures do not automatically delete those saved items. `Heading` and existing orange spans keep full stops consistent without changing heading text.

## Admin dashboard (Phase 8)

The read-only dashboard uses the existing `GET /api/admin/overview` response. `/admin`, `/admin/orders`, `/admin/products` and `/admin/coupons` are nested React Router routes with desktop sidebar navigation and a scrollable mobile bar. The existing AuthContext session and `role === "admin"` check are reused: anonymous visitors return through `/admin/login`, and signed-in non-admins see Access denied. Server authorization remains unchanged.

`utils/admin.js` owns defensive response normalization, safe order-details JSON parsing, order filtering/sorting, paise-to-rupees conversion, paid revenue and CSV serialization. Catalogue prices and coupon minimums already arrive in rupees. Average order value covers paid orders only. Recent-order and newest-first views retain the endpoint's ordering; no dates are invented. The inline SVG chart separates paid, pending and unknown amounts, with text equivalents.

Orders use a native table and keyboard-operated expansion controls, changing to cards on small screens. CSV exports the currently filtered/sorted results, quotes multiline fields and neutralizes spreadsheet formulas. Products remain read-only, with category/name filters and storefront links. All sections share loading, retry and empty states and use the existing theme tokens and DM Mono for figures.

Run `npm test` for regressions, `npm run test:unit` for helpers, and `npm run test:smoke` for the isolated purchase flow. Run `npm exec playwright test -- --config playwright.admin.config.js` for all four admin sections at 375, 768 and 1280px in light/dark mode. Screenshot outputs stay in ignored `test-results-admin/`. The admin browser cases use fixture responses; backend authorization is also covered by `backend/test_store.py`.
