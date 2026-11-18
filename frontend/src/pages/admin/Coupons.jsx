import { useOutletContext } from "react-router-dom";
import { money } from "../../utils/store";
import { nonNegativeNumber, text } from "../../utils/admin";
import { AdminEmpty } from "../../components/admin/AdminStates";

export default function AdminCoupons() {
  const { coupons } = useOutletContext();
  return coupons.length ? (
    <>
      <p className="muted">
        Current store offers. Coupon rules are validated at checkout.
      </p>
      <div className="offer-grid admin-coupons">
        {coupons.map((coupon, index) => (
          <article
            className="coupon-card offer-ticket"
            key={`${text(coupon.code)}-${index}`}
          >
            <div className="ticket-offer">
              <h2>
                <span className="admin-figure">
                  {nonNegativeNumber(coupon.percent)}%
                </span>{" "}
                <span>off</span>
              </h2>
              <p>
                {nonNegativeNumber(coupon.minimum)
                  ? `On orders ${money(nonNegativeNumber(coupon.minimum))} and above`
                  : "No minimum spend"}
              </p>
            </div>
            <div className="ticket-code">
              <code>{text(coupon.code, "Code unavailable")}</code>
            </div>
          </article>
        ))}
      </div>
    </>
  ) : (
    <AdminEmpty title="No offers right now.">
      Active coupons will appear here when available.
    </AdminEmpty>
  );
}
