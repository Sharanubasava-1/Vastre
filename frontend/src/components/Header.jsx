import { imageUrl } from "../utils/images";
import SearchOverlay from "./SearchOverlay";
import { useEffect, useState } from "react";
import Avatar from "./account/Avatar";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cats } from "../utils/store";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useWishlist } from "../context/WishlistContext";
import { useCatalog } from "../context/CatalogContext";
import Drawer from "./Drawer";
import Icon from "./Icon";
export default function Header() {
  const { user } = useAuth(),
    { cart, drawerOpen, setDrawerOpen } = useCart(),
    { theme, toggleTheme } = useTheme(),
    { ids, toggle } = useWishlist(),
    { products } = useCatalog();
  const [panel, setPanel] = useState(null),
    [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    setPanel(null);
    setDrawerOpen(false);
  }, [location.key, setDrawerOpen]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeMenu = (e) => {
      if (e.matches) setPanel((value) => (value === "menu" ? null : value));
    };
    media.addEventListener("change", closeMenu);
    return () => media.removeEventListener("change", closeMenu);
  }, []);
  useEffect(() => {
    function shortcut(event) {
      const command =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest("input, textarea, select"));
      if (
        event.repeat ||
        event.altKey ||
        !(
          command ||
          (event.key === "/" && !event.ctrlKey && !event.metaKey && !typing)
        )
      )
        return;
      if (document.querySelector("dialog[open]") && panel !== "search") return;
      event.preventDefault();
      setPanel("search");
      if (panel === "search")
        document.querySelector(".search-panel input")?.focus();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [panel]);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const categories = cats.map((category) => (
    <NavLink
      key={category}
      to={`/shop/${encodeURIComponent(category)}`}
      className={({ isActive }) => (isActive ? "active" : undefined)}
    >
      {category}
    </NavLink>
  ));
  const close = () => setPanel(null);
  return (
    <>
      <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
        <button
          className="icon-button menu-trigger"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={panel === "menu"}
          onClick={() => setPanel("menu")}
        >
          <Icon name="menu" />
        </button>
        <Link to="/" className="wordmark" aria-label="Vastré home">
          Vastré<span>.</span>
        </Link>
        <nav className="collection-nav" aria-label="Men's clothing categories">
          {categories}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button
            className="icon-button"
            aria-label="Search"
            aria-expanded={panel === "search"}
            aria-keyshortcuts="/ Control+K Meta+K"
            aria-haspopup="dialog"
            onClick={() => setPanel("search")}
          >
            <Icon name="search" />
          </button>
          <button
            className="icon-button wishlist-trigger"
            aria-label={`Wishlist (${ids.length})`}
            aria-haspopup="dialog"
            onClick={() => setPanel("wishlist")}
          >
            <Icon name="heart" />
            <span className="count-badge" aria-hidden="true">
              {ids.length}
            </span>
          </button>
          <Link
            className="icon-button account-trigger"
            to={user ? "/account" : "/login"}
            state={
              !user
                ? {
                    returnTo:
                      location.pathname + location.search + location.hash,
                  }
                : undefined
            }
            aria-label={
              user ? `Account for ${user.name || "customer"}` : "Login"
            }
          >
            {user ? <Avatar user={user} /> : <Icon name="account" />}
            <span className="header-account-name">
              {user ? user.name?.split(" ")[0] || "Account" : "Login"}
            </span>
          </Link>
          {user?.role === "admin" && (
            <Link className="admin-link" to="/admin">
              Admin
            </Link>
          )}
          <button
            className="icon-button bag-trigger"
            aria-label={`Bag (${count})`}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="bag" />
            <span className="count-badge" aria-hidden="true">
              {count}
            </span>
          </button>
        </div>
      </header>
      <Drawer
        open={panel === "menu"}
        onClose={close}
        title="Menu"
        side="left"
        className="mobile-menu-panel"
      >
        <nav className="mobile-nav" aria-label="Mobile clothing categories">
          <NavLink to="/shop" end>
            All clothing
          </NavLink>
          {categories}
          <NavLink to="/coupons">Offers</NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin">Admin dashboard</NavLink>
          )}
          <NavLink to="/wishlist">Wishlist</NavLink>
          <NavLink
            to={user ? "/account" : "/login"}
            state={
              !user
                ? {
                    returnTo:
                      location.pathname + location.search + location.hash,
                  }
                : undefined
            }
          >
            {user ? "Your account" : "Log in"}
          </NavLink>
        </nav>
        <p className="muted">Men’s essentials. Everyday, elevated.</p>
      </Drawer>
      <SearchOverlay open={panel === "search"} onClose={close} />
      <Drawer open={panel === "wishlist"} onClose={close} title="Your wishlist">
        {ids.length ? (
          <ul className="drawer-items">
            {products
              .filter((p) => ids.includes(p.id))
              .map((p) => (
                <li className="drawer-item" key={p.id}>
                  <img
                    decoding="async"
                    src={imageUrl(p.image, "thumbnail")}
                    alt={p.alt || p.name}
                    width="88"
                    height="110"
                    loading="lazy"
                  />
                  <div>
                    <Link to={`/products/${p.id}`}>{p.name}</Link>
                    <button className="text-link" onClick={() => toggle(p.id)}>
                      Remove from wishlist
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <div className="panel-empty">
            <h3>
              Keep your favourites close<span className="orange">.</span>
            </h3>
            <p>Use the heart on a product to save it here.</p>
            <Link className="button button-dark" to="/shop">
              Explore the collection
            </Link>
          </div>
        )}
        <Link
          className="button button-dark full-width wishlist-page-link"
          to="/wishlist"
        >
          View wishlist <Icon name="arrow" />
        </Link>
      </Drawer>
    </>
  );
}
