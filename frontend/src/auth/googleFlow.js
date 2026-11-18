// SDK-independent orchestration: credentials never enter storage or diagnostics.
export function googleMessage(error, hostname = "localhost") {
  if (
    error?.code === "auth/popup-closed-by-user" ||
    error?.code === "auth/cancelled-popup-request"
  )
    return "";
  if (error?.code === "auth/unauthorized-domain")
    return `Google sign-in is not enabled for ${hostname}. Open http://localhost:5173, or add this hostname in Firebase Authentication → Settings → Authorized domains.`;
  if (error?.code === "auth/popup-blocked")
    return "Allow popups to confirm your Google identity, then try again.";
  if (
    error?.code === "auth/network-request-failed" ||
    error instanceof TypeError
  )
    return "Couldn’t connect. Check your connection and try again.";
  if (error?.code === "auth/user-disabled" || error?.status === 403)
    return "This account is disabled or unavailable. Please contact support.";
  if (error?.code === "auth/too-many-requests" || error?.status === 429)
    return "Too many attempts. Please wait a minute and try again.";
  if (error?.code === "auth/unverified-email")
    return "Verify your Google email before signing in, then try again.";
  if (error?.code === "auth/configuration") return error.message;
  return "Google sign-in failed. Please try again.";
}

export async function exchangeGoogle(sdk, credential, exchange) {
  try {
    if (credential.user.emailVerified !== true)
      throw Object.assign(new Error(), { code: "auth/unverified-email" });
    const token = await credential.user.getIdToken(true);
    return await exchange(token);
  } finally {
    // This runs before the caller updates React state or navigates.
    await sdk.signOut(sdk.auth);
  }
}

export async function popupGoogle(sdk, exchange, redirect) {
  let credential;
  try {
    credential = await sdk.signInWithPopup(sdk.auth, sdk.provider);
  } catch (error) {
    if (error.code === "auth/popup-blocked" && redirect) {
      await redirect();
      await sdk.signInWithRedirect(sdk.auth, sdk.provider);
      return null;
    }
    throw error;
  }
  return exchangeGoogle(sdk, credential, exchange);
}
