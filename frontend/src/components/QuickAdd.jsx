import { useWishlist } from "../context/WishlistContext";
import { useState } from "react";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import Drawer from "./Drawer";
export default function QuickAdd({ product, moveToBag = false }) {
  const [open, setOpen] = useState(false),
    { add, cart, setDrawerOpen } = useCart(),
    { remove: removeFromWishlist } = useWishlist(),
    { notify } = useToast();
  const sizes = product.sizes || [];
  function choose(size) {
    add(product, size);
    setOpen(false);
    if (moveToBag) {
      removeFromWishlist(product.id);
      setDrawerOpen(true);
    }
    notify(moveToBag ? "Moved to your bag." : "Added to your bag.", "success");
  }
  return (
    <>
      <button
        className="button button-light quick-add-trigger"
        aria-label={
          moveToBag
            ? `Move ${product.name} to bag`
            : `Quick add ${product.name}`
        }
        aria-haspopup="dialog"
        disabled={!sizes.length}
        onClick={() => setOpen(true)}
      >
        {sizes.length
          ? moveToBag
            ? "Move to bag"
            : "Quick add"
          : "Unavailable"}
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Choose your size"
        className="quick-add-panel"
      >
        <p>{product.name}</p>
        <div className="quick-add-sizes">
          {sizes.map((size) => (
            <button
              className="chip"
              key={size}
              disabled={cart.some(
                (item) =>
                  item.product_id === product.id &&
                  item.size === size &&
                  item.quantity >= 10,
              )}
              aria-label={`Add ${product.name}, size ${size}`}
              onClick={() => choose(size)}
            >
              {size}
            </button>
          ))}
        </div>
        <small className="muted">
          Choose a size to add this item to your bag. Maximum 10 per size.
        </small>
      </Drawer>
    </>
  );
}
