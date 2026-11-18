import { Link } from "react-router-dom";
import OrderCard from "./OrderCard";
import Skeleton from "../Skeleton";
import Icon from "../Icon";
export default function OrdersPanel({ orders, loading, error, reload }) {
  return (
    <>
      <h2>Your orders</h2>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="account-empty" role="alert">
          <h3>
            We couldn’t load your orders<span className="orange">.</span>
          </h3>
          <p>{error}</p>
          <button className="button button-light" onClick={reload}>
            Try again
          </button>
        </div>
      ) : orders.length ? (
        <div className="account-orders">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <div className="account-empty">
          <Icon name="bag" width="40" height="40" />
          <h3>
            Your first favourite is waiting<span className="orange">.</span>
          </h3>
          <p>No orders yet. Find something you’ll reach for every day.</p>
          <Link className="button button-dark" to="/shop">
            Explore the collection <Icon name="arrow" />
          </Link>
        </div>
      )}
    </>
  );
}
