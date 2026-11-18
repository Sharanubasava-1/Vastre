export const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pin: "",
};
export function validateAddress(address) {
  const errors = {};
  for (const [key, label] of [
    ["fullName", "full name"],
    ["line1", "address line 1"],
    ["city", "city"],
    ["state", "state"],
  ]) {
    if (!address[key]?.trim()) errors[key] = `Enter your ${label}.`;
  }
  if (!/^[6-9]\d{9}$/.test(address.phone?.trim() || ""))
    errors.phone = "Enter a valid 10-digit mobile number.";
  if (!/^[1-9]\d{5}$/.test(address.pin?.trim() || ""))
    errors.pin = "Enter a valid six-digit PIN code.";
  return errors;
}
export function formatAddress(address) {
  return [
    address.fullName,
    address.phone,
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pin,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}
