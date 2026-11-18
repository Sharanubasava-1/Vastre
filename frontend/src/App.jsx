import { lazy, Suspense } from "react";
import {
  RequireAuth,
  RequireRole,
  AuthResponseHandler,
  AccessDenied,
} from "./components/RouteProtection";
import PageMetadata from "./components/PageMetadata";
import { ThemeProvider } from "./context/ThemeContext";
import { WishlistProvider } from "./context/WishlistContext";
import { OwnerDataProvider } from "./context/OwnerDataContext";
import AnnouncementBar from "./components/AnnouncementBar";
import CartDrawer from "./components/CartDrawer";
import PageTransition from "./components/PageTransition";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider, useCart } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { CatalogProvider } from "./context/CatalogContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import Header from "./components/Header";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import Home from "./pages/Home";
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Login = lazy(() => import("./pages/Login"));
const Cart = lazy(() => import("./pages/Cart"));
const Coupons = lazy(() => import("./pages/Coupons"));
const Account = lazy(() => import("./pages/Account"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminCoupons = lazy(() => import("./pages/admin/Coupons"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter useTransitions={false}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <CatalogProvider>
                <OwnerDataProvider>
                  <WishlistProvider>
                    <CartProvider>
                      <ScrollToTop />
                      <AuthResponseHandler />
                      <PageMetadata />
                      <a className="skip-link" href="#main-content">
                        Skip to content
                      </a>
                      <div id="top" tabIndex={-1} />
                      <AnnouncementBar />
                      <Header />
                      <CartAnnouncement />
                      <main id="main-content" tabIndex={-1}>
                        <PageTransition>
                          <Suspense
                            fallback={
                              <p className="route-loading" role="status">
                                Loading page…
                              </p>
                            }
                          >
                            <Routes>
                              <Route path="/" element={<Home />} />
                              <Route path="/shop" element={<Shop />} />
                              <Route
                                path="/shop/:category"
                                element={<Shop />}
                              />
                              <Route
                                path="/products/:id"
                                element={<ProductDetail />}
                              />
                              <Route path="/cart" element={<Cart />} />
                              <Route path="/coupons" element={<Coupons />} />
                              <Route path="/login" element={<Login />} />
                              <Route path="/admin/login" element={<Login />} />
                              <Route
                                path="/account"
                                element={
                                  <RequireAuth>
                                    <Account />
                                  </RequireAuth>
                                }
                              />
                              <Route
                                path="/access-denied"
                                element={<AccessDenied />}
                              />
                              <Route
                                path="/verify-email"
                                element={<VerifyEmail />}
                              />
                              <Route path="/wishlist" element={<Wishlist />} />
                              <Route
                                path="/admin"
                                element={
                                  <RequireRole role="admin">
                                    <Admin />
                                  </RequireRole>
                                }
                              >
                                <Route index element={<AdminOverview />} />
                                <Route
                                  path="orders"
                                  element={<AdminOrders />}
                                />
                                <Route
                                  path="products"
                                  element={<AdminProducts />}
                                />
                                <Route
                                  path="coupons"
                                  element={<AdminCoupons />}
                                />
                                <Route path="users" element={<AdminUsers />} />
                              </Route>
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </PageTransition>
                      </main>
                      <CartDrawer />
                      <Footer />
                      <WhatsAppButton />
                    </CartProvider>
                  </WishlistProvider>
                </OwnerDataProvider>
              </CatalogProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function CartAnnouncement() {
  const { cart } = useCart();
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  return (
    <p
      className="sr-only"
      data-cart-announcement="true"
      aria-live="polite"
      aria-atomic="true"
    >
      {count} {count === 1 ? "item" : "items"} in your bag.
    </p>
  );
}
