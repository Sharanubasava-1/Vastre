import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut };

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// An unconfigured deployment must still support the existing password login.
export const missingFirebaseVariables = Object.entries(config)
  .filter(
    ([, value]) =>
      typeof value !== "string" || !value.trim() || value.startsWith("your-"),
  )
  .map(
    ([name]) =>
      ({
        apiKey: "VITE_FIREBASE_API_KEY",
        authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
        projectId: "VITE_FIREBASE_PROJECT_ID",
        appId: "VITE_FIREBASE_APP_ID",
      })[name],
  );
export const firebaseConfigured = missingFirebaseVariables.length === 0;
export let firebaseError = missingFirebaseVariables.length
  ? `Google sign-in needs: ${missingFirebaseVariables.join(", ")}. Update frontend/.env and restart Vite.`
  : "";

export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Both initializers reuse their existing instance with the same options on HMR.
// Firebase credentials are transient; the app's httpOnly cookie stays authoritative.
export let auth = null;
try {
  auth = firebaseConfigured
    ? initializeAuth(
        getApps().some((app) => app.name === "[DEFAULT]")
          ? getApp()
          : initializeApp(config),
        {
          persistence: inMemoryPersistence,
          popupRedirectResolver: browserPopupRedirectResolver,
        },
      )
    : null;
} catch {
  firebaseError =
    "Google sign-in couldn’t initialize. Check the VITE_FIREBASE_* settings in frontend/.env and restart Vite.";
}
