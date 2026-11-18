import { responsiveImage } from "../utils/images";
import UnavailableCartItems from "../components/UnavailableCartItems";
import Heading from "../components/Heading";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import QuantityStepper from "../components/QuantityStepper";
import EmptyBag from "../components/checkout/EmptyBag";
import DeliveryNote from "../components/checkout/DeliveryNote";
import CheckoutSteps from "../components/checkout/CheckoutSteps";
import AddressForm from "../components/checkout/AddressForm";
import OrderConfirmed from "../components/checkout/OrderConfirmed";
import Icon from "../components/Icon";
import Skeleton from "../components/Skeleton";
import api from "../api/client";
import { money, wa } from "../utils/store";
import { validateAddress, formatAddress } from "../utils/checkout";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { useCatalog } from "../context/CatalogContext";
import { useWishlist } from "../context/WishlistContext";
import useCheckoutPayment from "../hooks/useCheckoutPayment";
import { useOwnerData } from "../context/OwnerDataContext";
export default function Cart() {
  const { products, offers, loading } = useCatalog(),
    { user, loading: authLoading } = useAuth(),
    { notify } = useToast(),
    { ids, toggle } = useWishlist();
  const {
    cart,
    update,
    remove,
    clearPurchased,
    coupon,
    setCoupon,
    quote,
    setQuote,
    addressFields,
    setAddressFields,
  } = useCart();
  const go = useNavigate(),
    location = useLocation();
  const { resetLocationKey } = useOwnerData();
  const ownerChangedHere = resetLocationKey === location.key;
  const [errors, setErrors] = useState({}),
    [step, setStep] = useState(
      !ownerChangedHere && location.search.includes("step=address") ? 1 : 0,
    ),
    [couponBusy, setCouponBusy] = useState(false),
    [couponError, setCouponError] = useState(""),
    [confirmation, setConfirmation] = useState(null);
  const addressRef = useRef(null),
    requestId = useRef(0),
    cartKey = JSON.stringify(cart),
    currentKey = useRef(cartKey),
    autoApplied = useRef(""),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  currentKey.current = cartKey;
  const items = cart
    .map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.product_id),
    }))
    .filter((item) => item.product);
  const subtotal = items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    ),
    discount = quote?.discount || 0,
    total = quote?.total ?? subtotal;
  const payment = useCheckoutPayment({
    user,
    notify,
    onConfirmed: (order) => {
      clearPurchased(order.items);
      setCoupon("");
      setQuote(null);
      setConfirmation(order);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
  });
  async function applyCoupon(code) {
    const token = ++requestId.current,
      key = cartKey;
    setCoupon(code);
    setCouponError("");
    setCouponBusy(true);
    setQuote(null);
    try {
      const result = await api("/checkout/quote", {
        items: cart,
        coupon: code.trim(),
      });
      if (
        active.current &&
        token === requestId.current &&
        key === currentKey.current
      ) {
        setQuote(result);
        setCoupon(result.coupon);
        notify(
          result.coupon ? "Coupon applied." : "Coupon removed.",
          "success",
        );
      }
    } catch (error) {
      if (
        active.current &&
        token === requestId.current &&
        key === currentKey.current
      ) {
        setCouponError(error.message);
        notify(error.message, "error");
      }
    } finally {
      if (active.current && token === requestId.current) setCouponBusy(false);
    }
  }
  useEffect(() => {
    if (loading || !items.length || ownerChangedHere) return;
    if (location.hash === "#delivery-address") {
      setStep(1);
      addressRef.current?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
    const code = location.state?.couponToApply;
    if (code && autoApplied.current !== location.key) {
      autoApplied.current = location.key;
      applyCoupon(code);
    }
  }, [loading, location.key, items.length]);
  useEffect(() => {
    if (!confirmation) return;
    document.title = "Order confirmed | Vastré";
    return () => {
      if (document.title === "Order confirmed | Vastré")
        document.title = "Your bag | Vastré";
    };
  }, [confirmation]);
  function editAddress(name, value) {
    setAddressFields((old) => ({ ...old, [name]: value }));
    setErrors((old) => ({ ...old, [name]: undefined }));
  }
  function validate() {
    const next = validateAddress(addressFields);
    setErrors(next);
    if (Object.keys(next).length) {
      setStep(1);
      document.getElementById(`address-${Object.keys(next)[0]}`)?.focus();
      return false;
    }
    return true;
  }
  function pay() {
    if (payment.busy) return;
    if (!user) {
      go("/login", {
        state: { returnTo: "/cart?step=address#delivery-address" },
      });
      return;
    }
    if (!validate()) return;
    setStep(2);
    payment.pay({
      items: items.map((item) => ({ ...item })),
      subtotal,
      discount,
      coupon: quote?.coupon || "",
      address: formatAddress(addressFields),
      name: addressFields.fullName.trim(),
      phone: addressFields.phone.trim(),
    });
  }
  function move(item) {
    if (!ids.includes(item.product_id)) toggle(item.product_id);
    remove(item.product_id, item.size);
    notify("Moved to your wishlist.", "success");
  }
  if (confirmation) return <OrderConfirmed order={confirmation} />;
  return (
    <section className="section-shell cart-page">
      <CheckoutSteps step={payment.busy ? 2 : step} />
      <Heading className="page-title">Your bag.</Heading>
      <UnavailableCartItems />
      {loading ? (
        <Skeleton />
      ) : !items.length ? (
        <>
          {coupon && (
            <p className="muted">
              {coupon} is ready. Add an item, then apply the code in your bag.
            </p>
          )}
          <EmptyBag />
        </>
      ) : (
        <div className="cart-layout">
          <div className="cart-content">
            <DeliveryNote />
            <div className="cart-lines">
              {items.map((item) => (
                <article
                  className="cart-item"
                  key={`${item.product_id}-${item.size}`}
                >
                  <Link to={`/products/${item.product_id}`}>
                    <img
                      decoding="async"
                      {...responsiveImage(item.product.image, "120px")}
                      loading="lazy"
                      alt={item.product.alt || item.product.name}
                      width="120"
                      height="150"
                    />
                  </Link>
                  <div className="cart-item-body">
                    <Link
                      className="cart-item-name"
                      to={`/products/${item.product_id}`}
                    >
                      {item.product.name}
                    </Link>
                    <p className="muted">
                      Size {item.size} · {money(item.product.price)}
                    </p>
                    <QuantityStepper
                      value={item.quantity}
                      disabled={payment.busy}
                      onChange={(quantity) =>
                        update(item.product_id, item.size, quantity)
                      }
                    />
                    <div className="cart-item-actions">
                      <button
                        disabled={payment.busy}
                        className="text-link"
                        onClick={() => move(item)}
                      >
                        Move to wishlist
                      </button>
                      <button
                        disabled={payment.busy}
                        className="text-link"
                        onClick={() => remove(item.product_id, item.size)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <strong className="cart-line-total">
                    {money(item.product.price * item.quantity)}
                  </strong>
                </article>
              ))}
            </div>
            <div
              id="delivery-address"
              ref={addressRef}
              onFocusCapture={() => {
                if (!payment.busy) setStep(1);
              }}
              className="address-panel"
            >
              <AddressForm
                value={addressFields}
                onChange={editAddress}
                errors={errors}
                disabled={payment.busy}
                onBlur={(name) =>
                  setErrors((old) => ({
                    ...old,
                    [name]: validateAddress(addressFields)[name],
                  }))
                }
              />
              <Button
                variant="light"
                disabled={payment.busy}
                onClick={() => {
                  if (validate()) {
                    setStep(2);
                    document.getElementById("payment-button")?.focus();
                  }
                }}
              >
                Continue to payment <Icon name="arrow" />
              </Button>
            </div>
          </div>
          <aside className="checkout-panel">
            <h2>Order summary</h2>
            <dl className="order-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              {quote?.coupon && (
                <div>
                  <dt>Discount</dt>
                  <dd>−{money(discount)}</dd>
                </div>
              )}
              <div>
                <dt>Delivery</dt>
                <dd>{money(0)}</dd>
              </div>
              <div className="summary-total">
                <dt>Total</dt>
                <dd>{money(total)}</dd>
              </div>
            </dl>
            <small className="muted">
              Delivery is included in the current checkout.
            </small>
            <div className="coupon-section">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (coupon.trim()) applyCoupon(coupon);
                }}
              >
                <label htmlFor="coupon-code">Coupon code</label>
                <div className="coupon-input">
                  <input
                    id="coupon-code"
                    value={coupon}
                    disabled={payment.busy || couponBusy}
                    maxLength={64}
                    onChange={(e) => {
                      setCoupon(e.target.value);
                      setQuote(null);
                      setCouponError("");
                    }}
                    placeholder="Enter your code"
                    aria-invalid={!!couponError}
                    aria-describedby={couponError ? "coupon-error" : undefined}
                  />
                  <Button
                    type="submit"
                    variant="light"
                    loading={couponBusy}
                    disabled={payment.busy || !coupon.trim()}
                  >
                    Apply coupon
                  </Button>
                </div>
              </form>
              {couponError && (
                <p className="field-error" id="coupon-error" role="alert">
                  {couponError}
                </p>
              )}
              {quote?.coupon && (
                <div className="applied-coupon">
                  <Icon name="check" />
                  <span>{quote.coupon} applied</span>
                  <button
                    className="icon-button"
                    aria-label="Remove coupon"
                    disabled={payment.busy || couponBusy}
                    onClick={() => {
                      ++requestId.current;
                      setCoupon("");
                      setQuote(null);
                      setCouponError("");
                    }}
                  >
                    <Icon name="close" width="16" height="16" />
                  </button>
                </div>
              )}
              {!quote && coupon.trim() && !couponBusy && !couponError && (
                <small className="muted">
                  Apply your code to validate it against your current bag.
                </small>
              )}
              {offers.length > 0 && (
                <div className="quick-coupons">
                  <span>Available offers</span>
                  {offers.map((offer) => (
                    <button
                      key={offer.code}
                      className="chip"
                      disabled={
                        payment.busy ||
                        couponBusy ||
                        subtotal < offer.minimum ||
                        quote?.coupon === offer.code
                      }
                      title={
                        subtotal < offer.minimum
                          ? `Minimum order ${money(offer.minimum)}`
                          : undefined
                      }
                      onClick={() => applyCoupon(offer.code)}
                    >
                      Apply {offer.code} · {offer.percent}% off
                      {offer.minimum > 0 && (
                        <small>Min. {money(offer.minimum)}</small>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="payment-section">
              <p className="payment-note">
                <Icon name="shield" />
                Secure payment with Razorpay
              </p>
              {payment.unverified ? (
                <div className="verification-help" role="alert">
                  <p>
                    We couldn’t verify order{" "}
                    <strong>{payment.unverified}</strong>. Check your orders or
                    contact us before paying again.
                  </p>
                  <Link
                    className="button button-dark full-width"
                    to="/account?tab=orders"
                  >
                    View my orders
                  </Link>
                </div>
              ) : (
                <Button
                  id="payment-button"
                  className="full-width"
                  loading={payment.busy || authLoading}
                  disabled={
                    authLoading || couponBusy || items.length !== cart.length
                  }
                  onClick={pay}
                >
                  {authLoading
                    ? "Checking your session…"
                    : payment.phase === "preparing"
                      ? "Preparing checkout…"
                      : payment.phase === "verifying"
                        ? "Verifying payment…"
                        : payment.phase === "payment"
                          ? "Complete payment in Razorpay"
                          : user
                            ? "Pay with Razorpay"
                            : "Log in to checkout"}
                </Button>
              )}
              <a
                className="checkout-help"
                href={wa("Hello, I have an enquiry about my bag.")}
                target="_blank"
                rel="noreferrer"
              >
                Need help? WhatsApp us <Icon name="arrow" width="18" />
              </a>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
