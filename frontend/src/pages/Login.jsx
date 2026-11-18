import "../styles/account.css";
import Heading from "../components/Heading";
import { useState, useRef, useEffect } from "react";
import GoogleLogin from "../components/GoogleLogin";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { passwordStrength, safeReturnTo, validateAuth } from "../utils/auth";
export default function Login() {
  const location = useLocation(),
    go = useNavigate(),
    { login, register: signUp } = useAuth(),
    { notify } = useToast();
  const admin = location.pathname === "/admin/login";
  const returnTo =
    new URLSearchParams(location.search).get("next") ||
    location.state?.returnTo;
  const [register, setRegister] = useState(false),
    [values, setValues] = useState({ name: "", email: "", password: "" }),
    [errors, setErrors] = useState({}),
    [formError, setFormError] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    active = useRef(true),
    focusAfterSubmit = useRef(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!busy && focusAfterSubmit.current) {
      document.getElementById(focusAfterSubmit.current)?.focus();
      focusAfterSubmit.current = null;
    }
  }, [busy]);
  const strength = passwordStrength(values.password),
    creating = register && !admin;
  function switchTab(next) {
    if (busy) return;
    setRegister(next);
    setErrors({});
    setFormError("");
    setShow(false);
    setValues((old) => ({ ...old, password: "" }));
  }
  function tabKeys(event) {
    const index = ["ArrowRight", "ArrowLeft"].includes(event.key)
      ? register
        ? 0
        : 1
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? 1
          : null;
    if (index === null) return;
    event.preventDefault();
    switchTab(index === 1);
    event.currentTarget.parentElement
      .querySelectorAll("[role=tab]")
      [index]?.focus();
  }
  function edit(name, value) {
    setValues((old) => ({ ...old, [name]: value }));
    setErrors((old) => ({ ...old, [name]: undefined }));
    setFormError("");
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const next = validateAuth(values, creating);
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) {
      document.getElementById(`auth-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const data = {
        email: values.email.trim(),
        password: values.password,
        ...(creating ? { name: values.name.trim() } : {}),
      };
      const user = await (creating ? signUp(data) : login(data));
      notify("");
      if (active.current)
        go(
          safeReturnTo(
            returnTo,
            admin && user.role === "admin" ? "/admin" : "/account",
          ),
          { replace: true },
        );
    } catch (error) {
      if (active.current) {
        if (
          creating &&
          /email.*(already|exists)|already.*email/i.test(error.message)
        ) {
          setErrors({ email: error.message });
          focusAfterSubmit.current = "auth-email";
        } else setFormError(error.message);
        notify(error.message, "error");
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  const field = (
    name,
    label,
    type = "text",
    autoComplete = name,
    maxLength = 80,
  ) => (
    <div className="auth-field" key={name}>
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className={name === "password" ? "password-input" : ""}>
        <input
          id={`auth-${name}`}
          name={name}
          type={name === "password" ? (show ? "text" : "password") : type}
          autoComplete={autoComplete}
          maxLength={maxLength}
          value={values[name]}
          required
          aria-invalid={!!errors[name]}
          aria-describedby={
            [
              errors[name] ? `auth-error-${name}` : "",
              name === "password" && creating ? "password-hint" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={(e) => edit(name, e.target.value)}
          onBlur={() =>
            setErrors((old) => ({
              ...old,
              [name]: validateAuth(values, creating)[name],
            }))
          }
        />
        {name === "password" && (
          <button
            className="icon-button password-toggle"
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        )}
      </div>
      <span
        id={`auth-error-${name}`}
        className="field-error"
        aria-live="polite"
      >
        {errors[name] || ""}
      </span>
    </div>
  );
  return (
    <section className="auth-layout">
      <div className="auth-editorial">
        <img
          decoding="async"
          src="/images/mens/hero-1200.webp"
          alt="Man wearing a tailored everyday outfit"
          width="1000"
          height="1500"
          loading="lazy"
        />
        <div>
          <p>
            Your everyday,
            <br />
            <em>made personal.</em>
          </p>
          <Link to="/shop">
            Explore the collection <Icon name="arrow" />
          </Link>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Heading>
            {admin
              ? "Admin login"
              : creating
                ? "Create your account"
                : "Welcome back."}
          </Heading>
          <p className="auth-intro">
            {admin
              ? "Sign in to manage the store."
              : "Your orders, favourite pieces and addresses, all together."}
          </p>
          {!admin && (
            <div
              className="auth-tabs"
              role="tablist"
              aria-label="Sign in or create an account"
            >
              <button
                id="login-tab"
                type="button"
                role="tab"
                aria-selected={!register}
                aria-controls="auth-panel"
                tabIndex={!register ? 0 : -1}
                disabled={busy}
                onKeyDown={tabKeys}
                onClick={() => switchTab(false)}
              >
                Log in
              </button>
              <button
                id="register-tab"
                type="button"
                role="tab"
                aria-selected={register}
                aria-controls="auth-panel"
                tabIndex={register ? 0 : -1}
                disabled={busy}
                onKeyDown={tabKeys}
                onClick={() => switchTab(true)}
              >
                Create account
              </button>
            </div>
          )}
          <div
            id="auth-panel"
            role={admin ? undefined : "tabpanel"}
            aria-labelledby={
              admin ? undefined : creating ? "register-tab" : "login-tab"
            }
          >
            {/* Admin authentication stays password-only; Google cannot provision an admin. */}
            {!admin && (
              <GoogleLogin
                next={safeReturnTo(returnTo)}
                busy={busy}
                lock={lock}
                setBusy={setBusy}
                setError={setFormError}
              />
            )}
            <form onSubmit={submit} noValidate>
              <fieldset disabled={busy}>
                {creating && field("name", "Name", "text", "name")}
                {field("email", "Email", "email", "email", 254)}
                {field(
                  "password",
                  "Password",
                  "password",
                  creating ? "new-password" : "current-password",
                  128,
                )}
                {creating && (
                  <div id="password-hint" className="password-hint">
                    <div
                      role="meter"
                      aria-label="Password strength"
                      aria-valuemin={0}
                      aria-valuemax={4}
                      aria-valuenow={strength.score}
                      aria-valuetext={strength.label}
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <span
                          key={n}
                          className={n <= strength.score ? "filled" : ""}
                        />
                      ))}
                    </div>
                    <p>
                      {values.password ? `${strength.label}. ` : ""}Use at least
                      10 characters. A longer mix of letters, numbers and
                      symbols is harder to guess.
                    </p>
                  </div>
                )}
                <div
                  className="auth-form-error"
                  role={formError ? "alert" : undefined}
                >
                  {formError}
                </div>
                <Button type="submit" className="full-width" loading={busy}>
                  {busy
                    ? "Please wait…"
                    : creating
                      ? "Create account"
                      : "Log in"}
                </Button>
              </fieldset>
            </form>
          </div>
          {returnTo && (
            <p className="auth-return-note muted">
              After signing in, you’ll return to where you left off.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
