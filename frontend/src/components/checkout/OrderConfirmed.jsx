import { responsiveImage } from "../../utils/images";
import Heading from "../Heading";
import { Link } from "react-router-dom";
import Icon from "../Icon";
import CheckoutSteps from "./CheckoutSteps";
import { money } from "../../utils/store";
export default function OrderConfirmed({ order }) {
  return (
    <section className="section-shell order-confirmed">
      <CheckoutSteps step={3} />
      <div className="confirmation-heading">
        <span className="confirmation-mark">
          <Icon name="check" width="32" height="32" />
        </span>
        <Heading>Order confirmed.</Heading>
        <p>
          Thank you, {order.name}. Your payment is verified and your order is
          placed.
        </p>
        <p className="confirmation-id">
          Order ID <strong>{order.id}</strong>
        </p>
      </div>
      <div className="confirmation-summary">
        <h2>Your order</h2>
        <ul>
          {order.items.map((item) => (
            <li key={`${item.product_id}-${item.size}`}>
              <img
                decoding="async"
                {...responsiveImage(item.product.image, "120px")}
                loading="lazy"
                alt={item.product.alt || item.product.name}
                width="64"
                height="80"
              />
              <div>
                <strong>{item.product.name}</strong>
                <span>
                  Size {item.size} · Qty {item.quantity}
                </span>
              </div>
              <strong>{money(item.product.price * item.quantity)}</strong>
            </li>
          ))}
        </ul>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div>
              <dt>Discount {order.coupon}</dt>
              <dd>−{money(order.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Delivery</dt>
            <dd>{money(0)}</dd>
          </div>
          <div className="summary-total">
            <dt>Paid</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
        <h3>Delivery address</h3>
        <p>{order.address}</p>
      </div>
      <div className="confirmation-actions">
        <Link className="button button-dark" to="/shop">
          Continue shopping
        </Link>
        <Link className="button button-light" to="/account?tab=orders">
          View my orders
        </Link>
      </div>
    </section>
  );
}
