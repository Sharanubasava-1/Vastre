let pending;
// A shared, bounded loader avoids duplicate SDK tags and permits retry after failure.
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Secure checkout took too long to load. Please check your connection and try again.",
          ),
        ),
      15000,
    );
    function finish(error) {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve(window.Razorpay);
    }
    script.onload = () =>
      finish(
        window.Razorpay
          ? null
          : new Error("Secure checkout could not start. Please try again."),
      );
    script.onerror = () =>
      finish(
        new Error(
          "We couldn’t load secure checkout. Please check your connection and try again.",
        ),
      );
    document.body.appendChild(script);
  }).catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}
