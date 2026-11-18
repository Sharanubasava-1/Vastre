import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/client";
import Heading from "../components/Heading";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmail() {
  const { hash } = useLocation();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const token = new URLSearchParams(hash.slice(1)).get("token");
  async function confirm() {
    if (busy || done) return;
    setBusy(true);
    setError("");
    try {
      await api("/auth/verify-email", { token });
      setDone(true);
      history.replaceState(null, "", "/verify-email");
      if (user) await refresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section-shell">
      <Heading className="page-title">Verify your email</Heading>
      <p role="status">
        {done
          ? "Your email is verified. Thank you."
          : "Confirm your email address for your Vastré account."}
      </p>
      {error && <p role="alert">{error}</p>}
      {!done && token && (
        <Button loading={busy} onClick={confirm}>
          Verify email
        </Button>
      )}
      {!done && !token && (
        <p>
          Open the link in your verification email, or request a new one from
          your account.
        </p>
      )}
      <Link className="text-link" to="/account">
        Back to account ↗
      </Link>
    </section>
  );
}
