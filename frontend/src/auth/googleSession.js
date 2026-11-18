import api from "../api/client";
import { exchangeGoogle, popupGoogle } from "./googleFlow";
import { safeReturnTo } from "../utils/auth";

const pendingKey = "vastre:google-return";
function intent() {
  try {
    const value = sessionStorage.getItem(pendingKey);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return { next: safeReturnTo(value), kind: "login" };
    }
  } catch {
    return null;
  }
}
export function hasGoogleRedirect() {
  return intent()?.kind === "login";
}
function saveIntent(value) {
  try {
    sessionStorage.setItem(pendingKey, JSON.stringify(value));
  } catch {
    throw Object.assign(
      new Error(
        "Allow session storage to use Google’s redirect sign-in, then try again.",
      ),
      { code: "auth/configuration" },
    );
  }
}
async function sdk() {
  const value = await import("../firebase");
  if (value.firebaseError)
    throw Object.assign(new Error(value.firebaseError), {
      code: "auth/configuration",
    });
  return value;
}
const exchange = (id_token) =>
  api("/auth/google", { id_token }, { authError: "inline" });
export async function googleConfiguration() {
  const value = await import("../firebase");
  return value.firebaseError;
}
export async function loginWithGoogle(next) {
  const value = await sdk();
  return popupGoogle(value, exchange, () =>
    saveIntent({ next: safeReturnTo(next), kind: "login" }),
  );
}
let redirectResult;
export function completeGoogleRedirect() {
  // A single exchange even under React StrictMode/remounts.
  if (!redirectResult)
    redirectResult = (async () => {
      const pending = intent();
      if (pending?.kind !== "login") return null;
      try {
        const value = await sdk();
        const credential = await value.getRedirectResult(value.auth);
        if (!credential)
          throw Object.assign(
            new Error(
              "Google couldn’t finish redirect sign-in. Allow third-party storage for this site, or enable popups and try again.",
            ),
            { code: "auth/configuration" },
          );
        return {
          user: await exchangeGoogle(value, credential, exchange),
          next: safeReturnTo(pending.next),
        };
      } finally {
        sessionStorage.removeItem(pendingKey);
      }
    })();
  return redirectResult;
}
export async function confirmGoogleIdentity(action, purpose) {
  // A fresh popup, never /auth/google: re-authentication must not create another app session.
  return popupGoogle(await sdk(), action, () =>
    saveIntent({ kind: "security", purpose }),
  );
}
let securityRedirect;
export function resumeSecurityRedirect() {
  if (!securityRedirect)
    securityRedirect = (async () => {
      const pending = intent();
      if (pending?.kind !== "security") return null;
      try {
        const value = await sdk(),
          credential = await value.getRedirectResult(value.auth);
        if (!credential)
          throw Object.assign(
            new Error(
              "Google couldn’t finish redirect sign-in. Enable popups and try again.",
            ),
            { code: "auth/configuration" },
          );
        // Transient memory only, consumed once by the confirmation form, never persisted.
        return await exchangeGoogle(value, credential, async (id_token) => ({
          id_token,
          expires: Date.now() + 240000,
          purpose: pending.purpose === "delete" ? "delete" : "password",
        }));
      } finally {
        sessionStorage.removeItem(pendingKey);
      }
    })();
  return securityRedirect;
}
