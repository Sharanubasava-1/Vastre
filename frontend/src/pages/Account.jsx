import "../styles/account.css";
import Heading from "../components/Heading";
import { useState, useEffect } from "react";
import ProfilePanel from "../components/account/ProfilePanel";
import SecurityPanel from "../components/account/SecurityPanel";
import VerificationBanner from "../components/account/VerificationBanner";
import {
  Link,
  Navigate,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useWishlist } from "../context/WishlistContext";
import useSavedAddresses from "../hooks/useSavedAddresses";
import WishlistList from "../components/account/WishlistList";
import OrdersPanel from "../components/account/OrdersPanel";
import AddressBook from "../components/account/AddressBook";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";
import Icon from "../components/Icon";
export default function Account() {
  const { user, loading } = useAuth(),
    location = useLocation();
  if (loading)
    return (
      <section className="section-shell">
        <Heading className="page-title">Your account</Heading>
        <Skeleton />
      </section>
    );
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{
          returnTo: location.pathname + location.search + location.hash,
        }}
      />
    );
  return <AccountWorkspace key={user.id ?? user.email} user={user} />;
}
function AccountWorkspace({ user }) {
  const { logout, refresh } = useAuth(),
    { notify } = useToast(),
    { ids } = useWishlist(),
    go = useNavigate(),
    [params] = useSearchParams();
  const tab = [
    "overview",
    "profile",
    "security",
    "orders",
    "wishlist",
    "addresses",
  ].includes(params.get("tab"))
    ? params.get("tab")
    : "overview";
  const [identityError, setIdentityError] = useState(""),
    [identityAttempt, setIdentityAttempt] = useState(0);
  useEffect(() => {
    if (user.auth_provider || !["profile", "security"].includes(tab)) return;
    let active = true;
    setIdentityError("");
    refresh()
      .then((value) => {
        if (!value.auth_provider)
          throw new Error(
            "Couldn’t load your sign-in methods. Please try again.",
          );
      })
      .catch((reason) => {
        if (active) setIdentityError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [user.id, user.auth_provider, tab, identityAttempt]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);
  const { addresses, save } = useSavedAddresses(user);
  const [orders, setOrders] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api("/orders")
      .then((value) => {
        if (!Array.isArray(value))
          throw new Error("Please try loading your orders again.");
        if (active) setOrders(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id, user.email, version]);
  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      go("/login", { replace: true });
    } catch (e) {
      notify(e.message, "error");
      setLoggingOut(false);
    }
  }
  return (
    <section className="section-shell account-page">
      <div className="account-heading">
        <Heading className="page-title">Hello, {user.name}.</Heading>
        <p className="muted">{user.email}</p>
      </div>
      {tab !== "profile" && <VerificationBanner user={user} />}
      <div className="account-layout">
        <nav className="account-nav" aria-label="Account sections">
          {[
            "overview",
            "profile",
            "security",
            "orders",
            "wishlist",
            "addresses",
          ].map((name) => (
            <Link
              key={name}
              to={`/account?tab=${name}`}
              aria-current={tab === name ? "page" : undefined}
            >
              {name[0].toUpperCase() + name.slice(1)}
              <Icon name="arrow" width="18" />
            </Link>
          ))}
          <Button variant="ghost" loading={loggingOut} onClick={signOut}>
            {loggingOut ? "Logging out…" : "Log out"}
          </Button>
        </nav>
        <div className="account-panel" key={tab}>
          {["profile", "security"].includes(tab) && !user.auth_provider ? (
            identityError ? (
              <div role="alert">
                <p>{identityError}</p>
                <Button
                  onClick={() => setIdentityAttempt((value) => value + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <Skeleton />
            )
          ) : tab === "overview" ? (
            <>
              <h2>
                Your account at a glance<span className="orange">.</span>
              </h2>
              <p>
                Review your orders, return to saved pieces, or update your
                delivery addresses.
              </p>
              <div className="account-shortcuts">
                <Link to="/account?tab=orders">
                  <span>View your orders</span>
                  <span className="muted">
                    {loading
                      ? "Loading…"
                      : error
                        ? "View orders"
                        : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
                  </span>
                  <Icon name="arrow" />
                </Link>
                <Link to="/account?tab=wishlist">
                  <span>Browse your wishlist</span>
                  <span className="muted">
                    {ids.length} saved {ids.length === 1 ? "piece" : "pieces"}
                  </span>
                  <Icon name="arrow" />
                </Link>
                <Link to="/account?tab=addresses">
                  <span>Manage addresses</span>
                  <span className="muted">{addresses.length} saved</span>
                  <Icon name="arrow" />
                </Link>
              </div>
              <Link className="button button-light" to="/shop">
                Continue shopping <Icon name="arrow" />
              </Link>
            </>
          ) : tab === "profile" ? (
            <ProfilePanel user={user} />
          ) : tab === "security" ? (
            <SecurityPanel user={user} />
          ) : tab === "orders" ? (
            <OrdersPanel
              orders={orders}
              loading={loading}
              error={error}
              reload={() => setVersion((v) => v + 1)}
            />
          ) : tab === "wishlist" ? (
            <>
              <div className="account-panel-heading">
                <h2>Wishlist</h2>
                <Link className="text-link" to="/wishlist">
                  View wishlist page <Icon name="arrow" width="16" />
                </Link>
              </div>
              <WishlistList />
            </>
          ) : (
            <AddressBook addresses={addresses} save={save} />
          )}
        </div>
      </div>
    </section>
  );
}
