const roles = new Map([
  ["user", "Customer"],
  ["customer", "Customer"],
  ["support", "Support"],
  ["admin", "Admin"],
]);
const providers = new Map([
  ["password", "Email"],
  ["google", "Google"],
  ["both", "Email + Google"],
]);
export const roleName = (role) => roles.get(role) || "Unknown role";
export const providerName = (provider) =>
  providers.get(provider) || "Not available";

export function lastLogin(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    date: date.toLocaleDateString("en-IN", { dateStyle: "medium" }),
    time: date.toLocaleTimeString("en-IN", { timeStyle: "short" }),
  };
}

export function protectedUser(person, actor, activeAdmins) {
  return (
    !Number.isSafeInteger(person.id) ||
    person.id < 1 ||
    person.id === actor?.id ||
    (person.role === "admin" && !person.disabled && activeAdmins <= 1)
  );
}

export function normalizeUsers(value) {
  if (!value || !Array.isArray(value.users))
    throw Error("The user list could not be loaded. Please try again.");
  const count = (number, fallback = 0) =>
    Number.isSafeInteger(number) && number >= 0 ? number : fallback;
  return {
    users: value.users
      .filter(
        (person) =>
          person && typeof person === "object" && !Array.isArray(person),
      )
      .map((person) => ({
        id: person.id,
        name:
          typeof person.name === "string" ? person.name : "Unnamed customer",
        email:
          typeof person.email === "string"
            ? person.email
            : "Email not available",
        role: typeof person.role === "string" ? person.role : "unknown",
        disabled: person.disabled === true || person.disabled === 1,
        auth_provider:
          typeof person.auth_provider === "string" ? person.auth_provider : "",
        last_login_at: person.last_login_at,
      })),
    total: count(value.total),
    pages: Math.max(1, count(value.pages, 1)),
    activeAdmins: count(value.active_admins),
  };
}
