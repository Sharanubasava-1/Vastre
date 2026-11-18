import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import {
  confirmGoogleIdentity,
  resumeSecurityRedirect,
} from "../../auth/googleSession";
import { googleMessage } from "../../auth/googleFlow";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Button from "../Button";
import Drawer from "../Drawer";
import Skeleton from "../Skeleton";

function sessionDate(value) {
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return value && Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : "Unavailable";
}
export default function SecurityPanel({ user }) {
  const { clearUser, refresh } = useAuth(),
    { notify } = useToast(),
    go = useNavigate();
  const [sessions, setSessions] = useState([]),
    [loading, setLoading] = useState(true),
    [sessionError, setSessionError] = useState(""),
    [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(null),
    [password, setPassword] = useState(""),
    [current, setCurrent] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    googleOnly = user.auth_provider === "google";
  const fresh = useRef(null);
  const freshExpiry = useRef(null);
  useEffect(() => {
    let active = true;
    resumeSecurityRedirect()
      .then((value) => {
        if (!active || !value?.id_token) return;
        fresh.current = value;
        freshExpiry.current = setTimeout(
          clearFresh,
          Math.max(0, value.expires - Date.now()),
        );
        setDialog(value.purpose);
        notify(
          "Google identity confirmed. Complete your action below.",
          "info",
        );
      })
      .catch((reason) => {
        if (active)
          notify(googleMessage(reason, window.location.hostname), "error");
      });
    return () => {
      active = false;
      clearFresh();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSessionError("");
    api("/auth/sessions")
      .then((value) => {
        if (!Array.isArray(value))
          throw new Error("Couldn’t load your sessions. Please try again.");
        if (active) setSessions(value);
      })
      .catch((reason) => {
        if (active) setSessionError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  function clearFresh() {
    clearTimeout(freshExpiry.current);
    if (fresh.current) fresh.current.id_token = "";
    fresh.current = null;
  }
  function open(value) {
    if (lock.current) return;
    clearFresh();
    setPassword("");
    setCurrent("");
    setShow(false);
    setError("");
    setDialog(value);
  }
  function signedOut(message, destination = "/login") {
    clearUser();
    notify(message, "success");
    go(destination, { replace: true });
  }
  async function revoke(value) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setSessionError("");
    try {
      if (value === "all") {
        await api("/auth/logout-all", {});
        signedOut("You’re logged out of all devices.");
      } else {
        await api(`/auth/sessions/${encodeURIComponent(value.id)}`, undefined, {
          method: "DELETE",
        });
        if (value.current) signedOut("You’re logged out of this device.");
        else {
          setRevision((n) => n + 1);
          notify("Device logged out.", "success");
        }
      }
    } catch (reason) {
      setSessionError(reason.message);
    } finally {
      lock.current = false;
      setBusy(false);
      setDialog(null);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    if (
      dialog === "password" &&
      (password.length < 10 || password.length > 128)
    ) {
      setError("Use 10–128 characters for your new password.");
      return;
    }
    if (!googleOnly && !current) {
      setError("Enter your current password to confirm your identity.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const endpoint =
        dialog === "delete"
          ? "/auth/delete-account"
          : googleOnly
            ? "/auth/set-password"
            : "/auth/change-password";
      const perform = (credential) =>
        api(
          endpoint,
          {
            ...(dialog === "password" ? { new_password: password } : {}),
            ...credential,
          },
          { authError: "inline" },
        );
      if (googleOnly) {
        if (fresh.current?.id_token && fresh.current.expires > Date.now())
          await perform({ id_token: fresh.current.id_token });
        else if (
          (await confirmGoogleIdentity(
            (id_token) => perform({ id_token }),
            dialog,
          )) === null
        )
          return;
      } else await perform({ current_password: current });
      signedOut(
        dialog === "delete"
          ? "Your account has been deleted. Order records are retained for accounting."
          : "Password updated. Please log in again on your devices.",
        dialog === "delete" ? "/" : "/login",
      );
    } catch (reason) {
      setError(
        reason.code
          ? googleMessage(reason, window.location.hostname)
          : reason.message,
      );
      // A wrong fresh credential stays inline; a truly expired cookie still redirects.
      if (reason.status === 401) refresh().catch(() => {});
    } finally {
      clearFresh();
      lock.current = false;
      setBusy(false);
      setCurrent("");
      setPassword("");
    }
  }
  return (
    <div className="account-settings">
      <h2>
        Security<span className="orange">.</span>
      </h2>
      <section className="security-section">
        <h3>{googleOnly ? "Set a password" : "Password"}</h3>
        <p>
          {googleOnly
            ? "Add email and password sign-in. You’ll confirm your Google identity first."
            : "Choose a new password and confirm your current one. Updating it logs out all devices."}
        </p>
        <Button
          variant="light"
          onClick={() => open("password")}
          disabled={busy}
        >
          {googleOnly ? "Set a password" : "Change password"}
        </Button>
      </section>
      <section className="security-section">
        <h3>Active devices</h3>
        <p className="muted">Don’t recognise a device? Log it out here.</p>
        {sessionError && (
          <div role="alert">
            <p>{sessionError}</p>
            <Button
              variant="light"
              disabled={busy}
              onClick={() => setRevision((n) => n + 1)}
            >
              Try again
            </Button>
          </div>
        )}
        {loading ? (
          <Skeleton />
        ) : (
          !sessionError &&
          (sessions.length ? (
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>
                      {session.current ? "This device" : "Other device"}
                    </strong>
                    <p>{session.user_agent || "Unknown browser"}</p>
                    <p className="muted">
                      {session.ip || "Unknown IP"} · Last active:{" "}
                      {sessionDate(session.last_seen_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => revoke(session)}
                  >
                    Log out{session.current ? " this device" : " device"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No active devices to display.</p>
          ))
        )}
        <Button
          variant="light"
          disabled={busy || loading}
          onClick={() => open("all")}
        >
          Log out of all devices
        </Button>
      </section>
      <section className="security-section danger-zone">
        <h3>Delete account</h3>
        <p>
          This removes your personal profile and signs out every device. Order
          records remain for accounting.
        </p>
        {user.role === "admin" ? (
          <p className="muted">
            Admin accounts cannot be deleted here. Contact another
            administrator.
          </p>
        ) : (
          <Button
            variant="light"
            disabled={busy}
            onClick={() => open("delete")}
          >
            Delete my account
          </Button>
        )}
      </section>
      <Drawer
        open={!!dialog}
        onClose={() => {
          if (!busy) open(null);
        }}
        title={
          dialog === "all"
            ? "Log out of all devices"
            : dialog === "delete"
              ? "Delete your account"
              : googleOnly
                ? "Set a password"
                : "Change password"
        }
      >
        {dialog === "all" ? (
          <>
            <p>
              You’ll need to log in again on every device, including this one.
            </p>
            <Button loading={busy} onClick={() => revoke("all")}>
              Confirm log out
            </Button>
          </>
        ) : (
          <form className="account-settings-form" onSubmit={submit} noValidate>
            <p>
              {dialog === "delete"
                ? "This action cannot be undone. Confirm your identity to delete your account."
                : "For your security, confirm your identity before updating your password."}
            </p>
            {!googleOnly && (
              <>
                <label htmlFor="security-current">Current password</label>
                <input
                  id="security-current"
                  aria-invalid={!!error}
                  aria-describedby="security-error"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={128}
                  value={current}
                  disabled={busy}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </>
            )}
            {dialog === "password" && (
              <>
                <label htmlFor="security-new">New password</label>
                <input
                  id="security-new"
                  aria-invalid={!!error}
                  aria-describedby="security-error"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="muted">
                  Use 10–128 characters. Updating it logs out all devices.
                </p>
              </>
            )}
            {(dialog === "password" || !googleOnly) && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setShow((value) => !value)}
                aria-pressed={show}
              >
                {show ? "Hide passwords" : "Show passwords"}
              </Button>
            )}
            <p
              id="security-error"
              className="field-error"
              role={error ? "alert" : undefined}
              aria-live="polite"
            >
              {error}
            </p>
            <Button type="submit" loading={busy}>
              {googleOnly
                ? "Confirm with Google"
                : dialog === "delete"
                  ? "Confirm deletion"
                  : "Update password"}
            </Button>
          </form>
        )}
      </Drawer>
    </div>
  );
}
