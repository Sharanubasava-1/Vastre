import { useEffect, useRef } from "react";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Skeleton from "./Skeleton";
import Heading from "./Heading";

export function AccessDenied() {
  return (
    <section className="section-shell admin-access">
      <Heading className="page-title">Access denied.</Heading>
      <p>You don’t have permission to access this area.</p>
      <Link className="button button-dark" to="/account">
        Back to my account ↗
      </Link>
    </section>
  );
}
export function RequireAuth({ role, children }) {
  const { user, loading } = useAuth(),
    location = useLocation();
  if (loading)
    return (
      <section className="section-shell" aria-label="Checking access">
        <Skeleton />
      </section>
    );
  const next = location.pathname + location.search + location.hash;
  if (!user)
    return (
      <Navigate
        replace
        to={`${role === "admin" ? "/admin/login" : "/login"}?next=${encodeURIComponent(next)}`}
        state={{ returnTo: next }}
      />
    );
  if (role && user.role !== role) return <AccessDenied />;
  return children || <Outlet />;
}
export function RequireRole({ role, children }) {
  return <RequireAuth role={role}>{children}</RequireAuth>;
}
export function AuthResponseHandler() {
  const go = useNavigate(),
    location = useLocation(),
    { notify } = useToast();
  const handled = useRef(null);
  useEffect(() => {
    function handle(event) {
      if (handled.current === location.key) return;
      handled.current = location.key;
      if (event.detail.status === 401) {
        if (/^\/(admin\/)?login$/.test(location.pathname)) return;
        notify("Your session expired, please log in again", "info");
        const next = location.pathname + location.search + location.hash;
        go(`/login?next=${encodeURIComponent(next)}`, {
          replace: true,
          state: { returnTo: next },
        });
      } else go("/access-denied", { replace: true });
    }
    window.addEventListener("vastre:auth-error", handle);
    return () => window.removeEventListener("vastre:auth-error", handle);
  }, [go, location, notify]);
  return null;
}
