import { useState } from "react";
import { money } from "../../utils/store";
import {
  orderStatus,
  paiseToRupees,
  parseOrderDetails,
  text,
} from "../../utils/admin";

export function StatusBadge({ order }) {
  const status = orderStatus(order);
  return (
    <span className={`admin-status admin-status-${status}`}>
      {status === "unknown"
        ? "Unknown"
        : status === "paid"
          ? "Paid"
          : "Pending"}
    </span>
  );
}

function OrderDetails({ order, products }) {
  const details = parseOrderDetails(order.details);
  return (
    <div className="admin-order-details">
      {details.unavailable ? (
        <p className="muted">Order details are unavailable.</p>
      ) : (
        <>
          <div>
            <h3>Items</h3>
            {details.items.length ? (
              <ul>
                {details.items.map((item, index) => {
                  const product = products.find(
                    (p) => String(p.id) === item.product_id,
                  );
                  return (
                    <li key={index}>
                      {text(product?.name, item.name || item.product_id)}{" "}
                      <span className="muted">
                        · Size {item.size} · Qty {item.quantity}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">No item details supplied.</p>
            )}
          </div>
          <div>
            <h3>Coupon</h3>
            <p className="admin-figure">{details.coupon || "No coupon"}</p>
            <h3>Delivery address</h3>
            <p className="admin-address">
              {details.address || "No address supplied."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function OrderRow({ order, products, index, tableId }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = `${tableId}-details-${index}`;
  return (
    <tbody className="admin-order-row">
      <tr className="admin-order-summary">
        <th scope="row">
          <span className="admin-mobile-label">Order ID</span>
          <button
            className="admin-order-toggle admin-figure"
            aria-label={`Order ${text(order.id)} details`}
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded(!expanded)}
          >
            <svg
              className="admin-disclosure-arrow"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m4 2 4 4-4 4" />
            </svg>
            {text(order.id)}
          </button>
        </th>
        <td className="admin-order-email">
          <span className="admin-mobile-label">Customer</span>
          {text(order.email, "Email unavailable")}
        </td>
        <td className="admin-figure">
          <span className="admin-mobile-label">Amount</span>
          {money(paiseToRupees(order.amount))}
        </td>
        <td>
          <span className="admin-mobile-label">Status</span>
          <StatusBadge order={order} />
        </td>
      </tr>
      <tr hidden={!expanded} id={detailId}>
        <td colSpan={4} className="admin-order-expanded">
          {expanded && <OrderDetails order={order} products={products} />}
        </td>
      </tr>
    </tbody>
  );
}

export default function OrderList({ orders, products = [], label = "Orders" }) {
  const tableId = label === "Orders" ? "all-orders" : "recent-orders";
  return (
    <table className="admin-order-list">
      <caption className="sr-only">{label}</caption>
      <thead className="admin-table-head">
        <tr>
          <th scope="col">Order ID</th>
          <th scope="col">Customer email</th>
          <th scope="col">Amount</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      {orders.map((order, index) => (
        <OrderRow
          order={order}
          products={products}
          index={index}
          tableId={tableId}
          key={`${text(order.id)}-${index}`}
        />
      ))}
    </table>
  );
}
