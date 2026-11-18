export function safeReturnTo(value, fallback = "/account") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://vastre.invalid");
    if (
      url.origin !== "https://vastre.invalid" ||
      /^\/(admin\/)?login\/?$/.test(url.pathname)
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
export function validateAuth(values, register = false) {
  const errors = {};
  if (register && !values.name.trim()) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Enter a valid email address.";
  if (values.password.length < (register ? 10 : 8))
    errors.password = `Use at least ${register ? 10 : 8} characters.`;
  else if (values.password.length > 128)
    errors.password = "Use no more than 128 characters.";
  return errors;
}
export function passwordStrength(password) {
  if (password.length < 10) return { score: 0, label: "Too short" };
  const score = Math.min(
    4,
    1 +
      Number(password.length >= 12) +
      Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) +
      Number(/\d/.test(password)) +
      Number(/[^a-z\d]/i.test(password)),
  );
  return {
    score,
    label: ["Too short", "Basic", "Fair", "Good", "Strong"][score],
  };
}
