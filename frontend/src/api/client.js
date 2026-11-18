export default async function api(p, data, options = {}) {
  const r = await fetch("/api" + p, {
    credentials: "include",
    ...(data !== undefined || options.method
      ? {
          method: options.method || "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "vastre",
          },
          ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
        }
      : {}),
  });
  const d = await r.json();
  if (!r.ok) {
    const error = new Error(
      typeof d.detail === "string" ? d.detail : "Please check your details.",
    );
    error.status = r.status;
    // Expected credential failures stay in their form. Anonymous bootstrap is normal.
    const inline =
      options.authError === "inline" ||
      (options.authError !== "session" &&
        /^\/auth\/(me|login|register|google|change-password|set-password|delete-account)(\/|$)/.test(
          p,
        ));
    if (!inline && (r.status === 401 || r.status === 403))
      window.dispatchEvent(
        new CustomEvent("vastre:auth-error", { detail: { status: r.status } }),
      );
    throw error;
  }
  return d;
}
