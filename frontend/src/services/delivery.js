// UI-only estimate. Replace this function with a delivery-service request when available.
export function estimateDelivery(pin, now = new Date()) {
  if (!/^[1-9]\d{5}$/.test(pin))
    throw new Error("Enter a valid six-digit PIN code.");
  const format = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const date = (days) =>
    format.format(new Date(now.getTime() + days * 86400000));
  return { from: date(4), to: date(7), preview: true };
}
