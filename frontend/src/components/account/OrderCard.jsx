import { responsiveImage } from "../../utils/images";
import { Link } from "react-router-dom";
import { useCatalog } from "../../context/CatalogContext";
import { money } from "../../utils/store";
import { orderDate, orderItems } from "../../utils/orders";
import Icon from "../Icon";
export default function OrderCard({ order }) {
  const { products } = useCatalog(),
    items = orderItems(order),
    date = orderDate(order),
    status = order.status || "pending";
  return (
    <article className="account-order">
      <header>
        <div>
          <span className="order-reference">Order {order.id}</span>
          {date && <p className="muted">Placed {date}</p>}
        </div>
        <span
          className={`order-status status-${status === "paid" ? "paid" : "pending"}`}
        >
          {status === "paid"
            ? "Paid"
            : status === "pending"
              ? "Pending"
              : status}
        </span>
      </header>
      <div className="order-card-total">
        <span>Total</span>
        <strong>
          {Number.isFinite(order.amount)
            ? money(order.amount / 100)
            : "Amount unavailable"}
        </strong>
      </div>
      <details>
        <summary>View items{items.length ? ` (${items.length})` : ""}</summary>
        {items.length ? (
          <ul>
            {items.filter(Boolean).map((item, index) => {
              const product = products.find(
                (p) => String(p.id) === String(item.product_id),
              );
              return (
                <li key={`${item.product_id}-${item.size}-${index}`}>
                  {product?.image ? (
                    <img
                      decoding="async"
                      {...responsiveImage(product.image, "80px")}
                      alt=""
                      width="56"
                      height="70"
                      loading="lazy"
                    />
                  ) : (
                    <Icon name="bag" width="32" height="32" />
                  )}
                  <div>
                    {product ? (
                      <Link to={`/products/${product.id}`}>
                        {item.name || product.name}
                      </Link>
                    ) : (
                      <strong>
                        {item.name || `Product ${item.product_id ?? ""}`}
                      </strong>
                    )}
                    <span>
                      Size {item.size || "—"} · Qty {item.quantity ?? 1}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">
            Item details aren’t available for this order. Contact us with your
            order ID if you need help.
          </p>
        )}
      </details>
    </article>
  );
}
