import { responsiveImage } from "../../utils/images";
import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { money } from "../../utils/store";
import { nonNegativeNumber, text } from "../../utils/admin";
import { AdminEmpty } from "../../components/admin/AdminStates";

export default function Products() {
  const { products } = useOutletContext();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const categories = [
    ...new Set(products.map((p) => text(p.category, "")).filter(Boolean)),
  ].sort();
  const visible = products.filter(
    (product) =>
      (!category || text(product.category) === category) &&
      text(product.name, "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-field admin-search">
          <label htmlFor="admin-product-search">Search products</label>
          <input
            id="admin-product-search"
            type="search"
            placeholder="Product name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-product-category">Category</label>
          <select
            id="admin-product-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="admin-results muted" role="status">
        Showing {visible.length} of {products.length} products · Read-only
        catalogue
      </p>
      {visible.length ? (
        <div
          className="admin-products-scroll"
          tabIndex={0}
          role="region"
          aria-label="Product catalogue, scroll horizontally for more columns"
        >
          <table className="admin-products-table">
            <caption className="sr-only">Store products</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Compare-at</th>
                <th scope="col">Tag</th>
                <th scope="col">Storefront</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product, index) => (
                <tr key={`${text(product.id)}-${index}`}>
                  <th scope="row">
                    <div className="admin-product-name">
                      {typeof product.image === "string" && product.image ? (
                        <img
                          decoding="async"
                          {...responsiveImage(product.image, "80px")}
                          alt=""
                          width="48"
                          height="60"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <span
                          className="admin-product-placeholder"
                          aria-hidden="true"
                        />
                      )}
                      <span>{text(product.name, "Unnamed product")}</span>
                    </div>
                  </th>
                  <td>{text(product.category)}</td>
                  <td className="admin-figure">
                    {money(nonNegativeNumber(product.price))}
                  </td>
                  <td className="admin-figure">
                    {product.compare_at != null
                      ? money(nonNegativeNumber(product.compare_at))
                      : "—"}
                  </td>
                  <td>{text(product.tag)}</td>
                  <td>
                    {text(product.id, "") ? (
                      <Link
                        to={`/products/${encodeURIComponent(text(product.id))}`}
                        className="text-link"
                        aria-label={`View ${text(product.name, "product")} in store`}
                      >
                        View in store ↗
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmpty
          title={products.length ? "No matching products." : "No products yet."}
          onClear={
            products.length
              ? () => {
                  setSearch("");
                  setCategory("");
                }
              : undefined
          }
        >
          {products.length
            ? "Try another name or category."
            : "Products from your store catalogue will appear here."}
        </AdminEmpty>
      )}
    </>
  );
}
