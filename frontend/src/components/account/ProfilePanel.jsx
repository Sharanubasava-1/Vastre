import { useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Button from "../Button";
import Avatar from "./Avatar";
import VerificationBanner from "./VerificationBanner";

export default function ProfilePanel({ user }) {
  const { refresh } = useAuth(),
    { notify } = useToast();
  const [name, setName] = useState(user.name || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/profile", { name: name.trim() }, { method: "PATCH" });
      await refresh();
      notify("Your profile is updated.", "success");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }
  const provider = user.auth_provider || "password";
  return (
    <div className="account-settings">
      <h2>
        Profile<span className="orange">.</span>
      </h2>
      <div className="profile-identity">
        <Avatar user={user} />
        <div>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </div>
      </div>
      <div className="provider-badges" aria-label="Sign-in methods">
        {["google", "both"].includes(provider) && (
          <span className="chip">Google</span>
        )}
        {provider !== "google" && (
          <span className="chip">Email &amp; password</span>
        )}
        <span className="chip">
          {user.email_verified ? "Email verified" : "Email not verified"}
        </span>
      </div>
      <VerificationBanner user={user} />
      <form onSubmit={save} noValidate className="account-settings-form">
        <label htmlFor="profile-name">Name</label>
        <input
          id="profile-name"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          aria-invalid={!!error}
          aria-describedby="profile-error"
          required
        />
        <p id="profile-error" className="field-error" aria-live="polite">
          {error}
        </p>
        <Button type="submit" loading={busy}>
          Save profile
        </Button>
      </form>
      <p className="muted">
        Your email identifies your account and cannot be changed here.
      </p>
    </div>
  );
}
