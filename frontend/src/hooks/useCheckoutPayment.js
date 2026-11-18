import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { loadRazorpay } from "../services/razorpay";
export default function useCheckoutPayment({ user, notify, onConfirmed }) {
  const [phase, setPhase] = useState("idle"),
    [unverified, setUnverified] = useState(null);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function release() {
    lock.current = false;
    if (mounted.current) setPhase("idle");
  }
  async function pay(snapshot) {
    if (lock.current || unverified) return;
    lock.current = true;
    setPhase("preparing");
    try {
      // Load before creating an order so an SDK failure leaves no unnecessary pending order.
      const Razorpay = await loadRazorpay();
      if (!mounted.current) {
        release();
        return;
      }
      const order = await api("/payments/order", {
        items: snapshot.items.map(({ product_id, size, quantity }) => ({
          product_id,
          size,
          quantity,
        })),
        coupon: snapshot.coupon,
        address: snapshot.address,
      });
      if (!mounted.current) {
        release();
        return;
      }
      let verifying = false,
        settled = false;
      const checkout = new Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: "Vastré",
        prefill: {
          name: snapshot.name,
          email: user.email,
          contact: snapshot.phone,
        },
        theme: {
          color: getComputedStyle(document.documentElement)
            .getPropertyValue("--orange")
            .trim(),
        },
        modal: {
          ondismiss: () => {
            if (!verifying && !settled) {
              settled = true;
              release();
              notify("Checkout closed. Your bag is saved.", "info");
            }
          },
        },
        handler: async (response) => {
          if (verifying || settled) return;
          verifying = true;
          if (mounted.current) setPhase("verifying");
          try {
            const verified = await api("/payments/verify", response);
            settled = true;
            onConfirmed({
              ...snapshot,
              id: verified.order_id || order.order_id,
              total: order.amount / 100,
            });
            notify("Payment confirmed. Your order has been placed.", "success");
          } catch (error) {
            settled = true;
            if (mounted.current) setUnverified(order.order_id);
            notify(
              `We couldn’t confirm your payment. Check your orders before paying again. ${error.message}`,
              "error",
            );
          } finally {
            release();
          }
        },
      });
      checkout.on?.("payment.failed", (response) => {
        if (verifying || settled) return;
        settled = true;
        checkout.close?.();
        release();
        notify(
          `Payment wasn’t completed. ${response.error?.description || "Please try again or choose another payment method."}`,
          "error",
        );
      });
      if (mounted.current) setPhase("payment");
      checkout.open();
    } catch (error) {
      release();
      notify(
        error.message || "We couldn’t open secure checkout. Please try again.",
        "error",
      );
    }
  }
  return { pay, phase, busy: phase !== "idle", unverified };
}
