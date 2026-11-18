import { useEffect, useState } from "react";
import Button from "./Button";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { googleMessage } from "../auth/googleFlow";
import {
  completeGoogleRedirect,
  googleConfiguration,
  loginWithGoogle,
  hasGoogleRedirect,
} from "../auth/googleSession";

export default function GoogleLogin({ next, busy, lock, setBusy, setError }) {
  const { acceptGoogle } = useAuth(),
    go = useNavigate();
  const [configuration, setConfiguration] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const redirecting = hasGoogleRedirect();
    if (redirecting) {
      lock.current = true;
      setBusy(true);
      setGoogleBusy(true);
    }
    googleConfiguration()
      .then((error) => {
        if (active) setConfiguration(error);
      })
      .catch(() => {
        if (active)
          setConfiguration(
            "Google sign-in couldn’t load. Check your connection and try again.",
          );
      });
    completeGoogleRedirect()
      .then((result) => {
        if (!active || !result) return;
        acceptGoogle(result.user);
        go(result.next, { replace: true });
      })
      .catch((error) => {
        if (active) setError(googleMessage(error, window.location.hostname));
      })
      .finally(() => {
        if (active && redirecting) {
          lock.current = false;
          setBusy(false);
          setGoogleBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function signIn() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setGoogleBusy(true);
    setError("");
    try {
      const user = await loginWithGoogle(next);
      if (user) {
        acceptGoogle(user);
        go(next, { replace: true });
      }
    } catch (error) {
      setError(googleMessage(error, window.location.hostname));
    } finally {
      lock.current = false;
      setBusy(false);
      setGoogleBusy(false);
    }
  }
  return (
    <div className="google-login">
      <Button
        variant="light"
        className="full-width google-button"
        loading={googleBusy}
        disabled={busy || !!configuration}
        onClick={signIn}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.85 46.98 24.55Z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
          />
        </svg>
        Continue with Google
      </Button>
      {configuration && (
        <p role="status" className="field-error">
          {configuration}
        </p>
      )}
      <div className="auth-divider">
        <span>or</span>
      </div>
    </div>
  );
}
