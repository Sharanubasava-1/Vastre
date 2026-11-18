import { imageUrl } from "../utils/images";
import UnavailableCartItems from "./UnavailableCartItems";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import Drawer from "./Drawer";
import Price from "./Price";
import QuantityStepper from "./QuantityStepper";
import DeliveryNote from "./checkout/DeliveryNote";
import EmptyBag from "./checkout/EmptyBag";
export default function CartDrawer() {
  const { cart, update, remove, drawerOpen, setDrawerOpen } = useCart();
  const { products, loading } = useCatalog();
  const close = () => setDrawerOpen(false);
  const items = cart
    .map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.product_id),
    }))
    .filter((item) => item.product);
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  return (
    <Drawer
      open={drawerOpen}
      onClose={close}
      title="Your bag"
      className="bag-drawer"
    >
      <UnavailableCartItems />
      {/* Modal backgrounds are inert: also announce edits inside the drawer. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {cart.reduce((count, item) => count + item.quantity, 0)} items in your
        bag. Subtotal <Price amount={subtotal} />.
      </p>
      {loading ? (
        <p role="status">Loading your bag…</p>
      ) : items.length ? (
        <>
          <DeliveryNote />
          <ul className="drawer-items">
            {items.map((item) => (
              <li
                className="drawer-item"
                key={`${item.product_id}-${item.size}`}
              >
                <Link to={`/products/${item.product_id}`} onClick={close}>
                  <img
                    decoding="async"
                    src={imageUrl(item.product.image, "thumbnail")}
                    alt={item.product.alt || item.product.name}
                    width="88"
                    height="110"
                  />
                </Link>
                <div>
                  <Link to={`/products/${item.product_id}`} onClick={close}>
                    {item.product.name}
                  </Link>
                  <p className="muted">
                    Size {item.size} · <Price amount={item.product.price} />
                  </p>
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(quantity) =>
                      update(item.product_id, item.size, quantity)
                    }
                  />
                  <button
                    className="text-link"
                    onClick={() => remove(item.product_id, item.size)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="drawer-summary">
            <p>
              Subtotal{" "}
              <strong>
                <Price amount={subtotal} />
              </strong>
            </p>
            <small className="muted">
              Apply an offer and add delivery details at checkout.
            </small>
            <div className="bag-drawer-actions">
              <Link className="button button-light" to="/cart" onClick={close}>
                View bag
              </Link>
              <Link
                className="button button-dark"
                to="/cart?step=address#delivery-address"
                onClick={close}
              >
                Checkout
              </Link>
            </div>
          </div>
        </>
      ) : (
        <EmptyBag onNavigate={close} />
      )}
    </Drawer>
  );
}
