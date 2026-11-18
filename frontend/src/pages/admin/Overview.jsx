import { Link, useOutletContext } from "react-router-dom";
import { money } from "../../utils/store";
import { revenueSummary } from "../../utils/admin";
import Heading from "../../components/Heading";
import OrderList from "../../components/admin/OrderList";
import { AdminEmpty } from "../../components/admin/AdminStates";

export default function Overview() {
  const { orders, customers, products } = useOutletContext();
  const summary = revenueSummary(orders);
  const stats = [
    ["Customers", customers],
    ["Total orders", summary.total],
    ["Paid revenue", money(summary.paidRevenue)],
    ["Pending orders", summary.pending],
    [
      "Average order value",
      money(Number(summary.averageOrderValue.toFixed(2))),
    ],
  ];
  const max = Math.max(1, ...summary.groups.map((group) => group.amount));
  return (
    <>
      <dl className="admin-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="admin-figure">
              {value}
              {label === "Average order value" && (
                <small className="muted">Paid orders only</small>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <section className="admin-chart" aria-labelledby="revenue-title">
        <Heading as="h2" id="revenue-title">
          Revenue by status.
        </Heading>
        <p className="muted">
          Paid amounts are revenue. Pending amounts are awaiting payment. Order
          dates are not supplied.
        </p>
        {orders.length ? (
          <div className="admin-chart-bars">
            {summary.groups
              .filter((group) => group.status !== "unknown" || group.count)
              .map((group) => (
                <div className="admin-chart-row" key={group.status}>
                  <span>
                    {group.status === "paid"
                      ? "Paid"
                      : group.status === "pending"
                        ? "Pending"
                        : "Unknown"}
                    <small>
                      {group.count} {group.count === 1 ? "order" : "orders"}
                    </small>
                  </span>
                  <svg
                    viewBox="0 0 400 28"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <rect
                      width="400"
                      height="28"
                      rx="4"
                      className="admin-chart-track"
                    />
                    <rect
                      width={(group.amount / max) * 400}
                      height="28"
                      rx="4"
                      className={`admin-chart-fill admin-chart-${group.status}`}
                    />
                  </svg>
                  <strong className="admin-figure">
                    {money(group.amount)}
                  </strong>
                </div>
              ))}
          </div>
        ) : (
          <p className="admin-chart-empty">
            Your revenue chart will appear when the first order arrives.
          </p>
        )}
      </section>
      <section aria-labelledby="recent-orders-title">
        <div className="admin-section-heading">
          <Heading as="h2" id="recent-orders-title">
            Recent orders.
          </Heading>
          <Link to="/admin/orders" className="text-link">
            All orders ↗
          </Link>
        </div>
        {orders.length ? (
          <OrderList
            orders={orders.slice(0, 5)}
            products={products}
            label="Five most recent orders"
          />
        ) : (
          <AdminEmpty title="No orders yet.">
            New orders will appear here, newest first.
          </AdminEmpty>
        )}
      </section>
    </>
  );
}
