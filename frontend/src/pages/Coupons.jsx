import Heading from "../components/Heading";
import { useNavigate } from "react-router-dom";
import { money } from "../utils/store";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";
import Skeleton from "../components/Skeleton";
export default function Coupons() {
  const { offers, offersLoading } = useCatalog(),
    { setCoupon } = useCart(),
    { notify } = useToast(),
    go = useNavigate();
  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
      notify(`${code} copied.`, "success");
    } catch {
      notify(
        "Couldn’t copy automatically. Select the code and copy it manually.",
        "info",
      );
    }
  }
  return (
    <section className="section-shell coupons-page">
      <Heading className="page-title">Your offers.</Heading>
      <p className="offers-intro">
        A little extra for your everyday. Choose an offer for your next order.
      </p>
      {offersLoading ? (
        <Skeleton />
      ) : offers.length ? (
        <div className="offer-grid">
          {offers.map((offer) => (
            <article className="coupon-card offer-ticket" key={offer.code}>
              <div className="ticket-offer">
                <h2>
                  {offer.percent}% <span>off</span>
                </h2>
                <p>
                  {offer.minimum
                    ? `On orders ${money(offer.minimum)} and above`
                    : "On your order"}
                </p>
              </div>
              <div className="ticket-code">
                <code>{offer.code}</code>
                <button className="text-link" onClick={() => copy(offer.code)}>
                  Copy code
                </button>
              </div>
              <button
                className="button button-dark full-width"
                onClick={() => {
                  setCoupon(offer.code);
                  go("/cart", { state: { couponToApply: offer.code } });
                }}
              >
                Apply in bag <Icon name="arrow" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="offers-empty">
          There are no offers right now. Check back soon for something good.
        </p>
      )}
      <p className="muted">
        One coupon per order. Codes are validated against your bag before
        payment.
      </p>
    </section>
  );
}
