import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { filterOrders, ordersCsv } from "../../utils/admin";
import OrderList from "../../components/admin/OrderList";
import { AdminEmpty } from "../../components/admin/AdminStates";
import Button from "../../components/Button";

export default function Orders() {
  const { orders, products } = useOutletContext();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const visible = filterOrders(orders, { search, status, sort });
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", ordersCsv(visible)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vastre-orders.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-field admin-search">
          <label htmlFor="admin-order-search">Search orders</label>
          <input
            id="admin-order-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order ID or customer email"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-order-status">Status</label>
          <select
            id="admin-order-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="admin-order-sort">Sort orders</label>
          <select
            id="admin-order-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-desc">Amount high to low</option>
            <option value="amount-asc">Amount low to high</option>
            <option value="id">Order ID A–Z</option>
          </select>
        </div>
        <Button variant="light" disabled={!visible.length} onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <p className="admin-results muted" role="status">
        Showing {visible.length} of {orders.length} orders · CSV includes these
        results
      </p>
      {visible.length ? (
        <OrderList orders={visible} products={products} />
      ) : (
        <AdminEmpty
          title={orders.length ? "No matching orders." : "No orders yet."}
          onClear={
            orders.length
              ? () => {
                  setSearch("");
                  setStatus("all");
                  setSort("recent");
                }
              : undefined
          }
        >
          {orders.length
            ? "Try another order ID, email or status."
            : "Orders will appear here after a customer begins checkout."}
        </AdminEmpty>
      )}
    </>
  );
}
