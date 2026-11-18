import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/Button";
import Drawer from "../../components/Drawer";
import { AdminEmpty, AdminSkeleton } from "../../components/admin/AdminStates";
import {
  lastLogin,
  normalizeUsers,
  protectedUser,
  providerName,
  roleName,
} from "../../utils/adminUsers";

export default function Users() {
  const { user } = useAuth(),
    { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [version, setVersion] = useState(0),
    [pending, setPending] = useState(null),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const cancelRef = useRef(null);
  const query = params.toString(),
    search = params.get("search") || "";
  const page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const request = new URLSearchParams(query);
      request.set("page_size", "20");
      api(`/admin/users?${request}`)
        .then((value) => {
          if (active) setData({ ...normalizeUsers(value), query });
        })
        .catch((failure) => {
          if (active) setError(failure.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, version]);
  useEffect(() => {
    if (!loading && !error && data?.query === query && page > data.pages) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("page", String(data.pages));
          return next;
        },
        { replace: true },
      );
    }
  }, [data, loading, error, page, query, setParams]);
  function filter(key, value) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        return next;
      },
      { replace: key === "search" },
    );
  }
  function propose(person, update) {
    setSaveError("");
    setPending({ person, update });
  }
  async function confirm() {
    if (saving || !pending) return;
    setSaving(true);
    setSaveError("");
    try {
      await api(`/admin/users/${pending.person.id}`, pending.update, {
        method: "PATCH",
      });
      notify(
        "Account updated. The user has been logged out on all devices.",
        "success",
      );
      setPending(null);
      setVersion((value) => value + 1);
    } catch (failure) {
      setSaveError(failure.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-field admin-search">
          <label htmlFor="admin-user-search">Search users</label>
          <input
            id="admin-user-search"
            type="search"
            maxLength={254}
            placeholder="Name or email"
            value={search}
            onChange={(event) => filter("search", event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-user-role">Role</label>
          <select
            id="admin-user-role"
            value={
              params.get("role") === "user"
                ? "customer"
                : params.get("role") || ""
            }
            onChange={(event) => filter("role", event.target.value)}
          >
            <option value="">All roles</option>
            <option value="customer">Customer</option>
            <option value="support">Support</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="admin-user-status">Status</label>
          <select
            id="admin-user-status"
            value={params.get("status") || ""}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="admin-user-provider">Provider</label>
          <select
            id="admin-user-provider"
            value={params.get("provider") || ""}
            onChange={(event) => filter("provider", event.target.value)}
          >
            <option value="">All providers</option>
            <option value="password">Email</option>
            <option value="google">Google</option>
            <option value="both">Email + Google</option>
          </select>
        </div>
      </div>
      <p className="muted admin-results">
        Your own admin account and the last active admin are protected. Changes
        log the affected user out on all devices.
      </p>
      {loading ? (
        <AdminSkeleton label="Loading users" />
      ) : error ? (
        <div className="admin-state" role="alert">
          <h2>Couldn’t load users.</h2>
          <p>{error}</p>
          <Button onClick={() => setVersion((value) => value + 1)}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => setParams({})}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <p className="admin-results muted" role="status">
            Showing {data.users.length} of {data.total} users
          </p>
          {data.users.length ? (
            <div
              className="admin-users-scroll"
              role="region"
              aria-label="Store users, scroll horizontally for more columns"
              tabIndex={0}
            >
              <table className="admin-users-table">
                <caption className="sr-only">
                  Store users and account access
                </caption>
                <thead>
                  <tr>
                    {[
                      "User",
                      "Role",
                      "Status",
                      "Provider",
                      "Last login",
                      "Action",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((person, index) => {
                    const locked = protectedUser(
                        person,
                        user,
                        data.activeAdmins,
                      ),
                      login = lastLogin(person.last_login_at);
                    return (
                      <tr key={person.id ?? index}>
                        <th scope="row">
                          <strong>
                            {person.name}
                            {person.id === user.id ? " (you)" : ""}
                          </strong>
                          <span className="admin-user-email">
                            {person.email}
                          </span>
                        </th>
                        <td>
                          <span className="admin-mobile-label">Role</span>
                          <select
                            aria-label={`Role for ${person.email}`}
                            disabled={locked}
                            value={person.role}
                            onChange={(event) =>
                              propose(person, { role: event.target.value })
                            }
                          >
                            {!["user", "customer", "support", "admin"].includes(
                              person.role,
                            ) && (
                              <option value={person.role}>Unknown role</option>
                            )}
                            <option
                              value={
                                person.role === "user" ? "user" : "customer"
                              }
                            >
                              Customer
                            </option>
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          <span className="admin-mobile-label">Status</span>
                          <span
                            className={`admin-status ${person.disabled ? "admin-status-disabled" : "admin-status-paid"}`}
                          >
                            {person.disabled ? "Disabled" : "Active"}
                          </span>
                        </td>
                        <td>
                          <span className="admin-mobile-label">Provider</span>
                          {providerName(person.auth_provider)}
                        </td>
                        <td className="admin-figure">
                          <span className="admin-mobile-label">Last login</span>
                          {login ? (
                            <time dateTime={login.iso} aria-label={login.label}>
                              <span>{login.date}</span>
                              <span>{login.time}</span>
                            </time>
                          ) : (
                            <span className="muted">Not available</span>
                          )}
                        </td>
                        <td>
                          <Button
                            variant="light"
                            disabled={locked}
                            aria-label={`${person.disabled ? "Enable" : "Disable"} ${person.email}`}
                            onClick={() =>
                              propose(person, { disabled: !person.disabled })
                            }
                          >
                            {person.disabled ? "Enable" : "Disable"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmpty
              title={query ? "No matching users." : "No users yet."}
              onClear={query ? () => setParams({}) : undefined}
            >
              User accounts will appear here. Try another search or clear your
              filters.
            </AdminEmpty>
          )}
          {data.total > 0 && (
            <nav className="admin-user-pagination" aria-label="User pages">
              <Button
                variant="light"
                disabled={page <= 1}
                onClick={() => filter("page", String(page - 1))}
              >
                Previous
              </Button>
              <span className="admin-figure" role="status">
                Page {page} of {data.pages}
              </span>
              <Button
                variant="light"
                disabled={page >= data.pages}
                onClick={() => filter("page", String(page + 1))}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      <Drawer
        open={!!pending}
        onClose={() => {
          if (!saving) setPending(null);
        }}
        title="Confirm account change"
        initialFocusRef={cancelRef}
      >
        {pending && (
          <div className="admin-user-confirm">
            <p>
              <strong>{pending.person.name}</strong>
              <br />
              <span className="muted">{pending.person.email}</span>
            </p>
            <p>
              {pending.update.role
                ? `Change role from ${roleName(pending.person.role)} to ${roleName(pending.update.role)}?`
                : `${pending.update.disabled ? "Disable" : "Enable"} this account?`}
            </p>
            <p>
              This user will be logged out on all devices. Disabling an account
              prevents them from signing in.
            </p>
            {saveError && (
              <>
                <p role="alert" className="field-error">
                  {saveError}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPending(null);
                    setVersion((value) => value + 1);
                  }}
                >
                  Refresh user list
                </Button>
              </>
            )}
            <div className="admin-user-confirm-actions">
              <button
                ref={cancelRef}
                className="button button-light"
                disabled={saving}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <Button loading={saving} onClick={confirm}>
                Confirm change
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
