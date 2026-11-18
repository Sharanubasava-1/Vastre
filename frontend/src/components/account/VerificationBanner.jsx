import { useState } from "react";
import api from "../../api/client";
import Button from "../Button";
import { useToast } from "../../context/ToastContext";

export default function VerificationBanner({ user }) {
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  if (
    user.email_verified === true ||
    user.email_verified === 1 ||
    user.auth_provider === "google"
  )
    return null;
  async function resend() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/auth/send-verification", {});
      notify("Verification email requested. Check your inbox.", "success");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="verification-banner" role="status">
      <p>Please verify your email to keep your account up to date.</p>
      <Button variant="ghost" loading={busy} onClick={resend}>
        Resend verification email
      </Button>
    </div>
  );
}
