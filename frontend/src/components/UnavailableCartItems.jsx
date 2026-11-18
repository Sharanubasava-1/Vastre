import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
export default function UnavailableCartItems() {
  const { cart, remove } = useCart(),
    { products, loading } = useCatalog();
  if (loading) return null;
  const missing = cart.filter(
    (item) => !products.some((product) => product.id === item.product_id),
  );
  if (!missing.length) return null;
  return (
    <div className="cart-unavailable">
      <p>
        {missing.length} saved{" "}
        {missing.length === 1 ? "item isn’t" : "items aren’t"} in the loaded
        collection.
      </p>
      <button
        className="text-link"
        onClick={() =>
          missing.forEach((item) => remove(item.product_id, item.size))
        }
      >
        Remove unavailable items
      </button>
    </div>
  );
}
