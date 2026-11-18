import "../styles/admin.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { normalizeOverview } from "../utils/admin";
import Heading from "../components/Heading";
import Button from "../components/Button";
import { AdminSkeleton } from "../components/admin/AdminStates";

const sections = [
  ["/admin", "Overview"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/coupons", "Coupons"],
  ["/admin/users", "Users"],
];

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const usersSection = location.pathname === "/admin/users";
  const navRef = useRef(null);
  const overviewRequest = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const title =
    sections.find(([path]) => path === location.pathname)?.[1] || "Admin";

  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!active || nav.scrollWidth <= nav.clientWidth) return;
    const bounds = nav.getBoundingClientRect();
    const link = active.getBoundingClientRect();
    if (link.right > bounds.right) nav.scrollLeft += link.right - bounds.right;
    else if (link.left < bounds.left) nav.scrollLeft -= bounds.left - link.left;
  }, [location.pathname, user?.role, authLoading]);

  useEffect(() => {
    if (usersSection) overviewRequest.current = null;
    if (authLoading || user?.role !== "admin" || usersSection) return;
    let active = true;
    setLoading(true);
    setError("");
    const key = `${user.id ?? user.email}:${attempt}`;
    // Reuse the initial request across StrictMode effect setup/cleanup.
    if (overviewRequest.current?.key !== key)
      overviewRequest.current = { key, promise: api("/admin/overview") };
    overviewRequest.current.promise
      .then((value) => {
        if (active) setData(normalizeOverview(value));
      })
      .catch((reason) => {
        if (active) setError(reason.message || "Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading, attempt, usersSection]);

  if (authLoading)
    return (
      <section className="section-shell">
        <AdminSkeleton label="Checking admin access" />
      </section>
    );
  if (!user)
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  if (user.role !== "admin")
    return (
      <section className="section-shell admin-access">
        <Heading className="page-title">Access denied.</Heading>
        <p>This area is available to store administrators.</p>
        <Link className="button button-dark" to="/account">
          Back to my account ↗
        </Link>
      </section>
    );

  return (
    <section className="section-shell admin-page">
      <div className="admin-heading">
        <div>
          <Heading className="page-title">Store {title.toLowerCase()}.</Heading>
          <p className="muted">Your everyday, behind the scenes.</p>
        </div>
        <Link className="text-link" to="/shop">
          View storefront ↗
        </Link>
      </div>
      <div className="admin-layout">
        <nav ref={navRef} className="admin-nav" aria-label="Admin sections">
          {sections.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === "/admin"}>
              {label}
              <span aria-hidden="true">↗</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-content">
          {usersSection ? (
            <Outlet />
          ) : loading ? (
            <AdminSkeleton label={`Loading ${title.toLowerCase()}`} />
          ) : error ? (
            <div className="admin-state" role="alert">
              <Heading as="h2">Couldn’t load {title.toLowerCase()}.</Heading>
              <p>{error}</p>
              <Button onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </Button>
            </div>
          ) : (
            <Outlet context={data} />
          )}
        </div>
      </div>
    </section>
  );
}
