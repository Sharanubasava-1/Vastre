import { DELIVERY_COPY } from "../config/storefront";
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { money, wa } from "../utils/store";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { useCatalog } from "../context/CatalogContext";
import { useWishlist } from "../context/WishlistContext";
import useRecentlyViewed from "../hooks/useRecentlyViewed";
import NotFound from "./NotFound";
import Skeleton from "../components/Skeleton";
import Breadcrumbs from "../components/Breadcrumbs";
import Button from "../components/Button";
import Icon from "../components/Icon";
import ProductGrid from "../components/ProductGrid";
import ProductGallery from "../components/product/ProductGallery";
import SizeGuide from "../components/product/SizeGuide";
import ProductFacts from "../components/product/ProductFacts";
import DeliveryChecker from "../components/product/DeliveryChecker";
export default function ProductDetail() {
  const { products, loading } = useCatalog(),
    { id } = useParams();
  const product = products.find((p) => String(p.id) === id);
  if (!product)
    return loading ? (
      <div className="section-shell route-loading">
        <Skeleton />
      </div>
    ) : (
      <NotFound />
    );
  return <ProductPage key={product.id} product={product} products={products} />;
}
function ProductPage({ product, products }) {
  const [size, setSize] = useState(""),
    [quantity, setQuantity] = useState(1),
    [error, setError] = useState(""),
    [guide, setGuide] = useState(false),
    [state, setState] = useState("idle"),
    [sticky, setSticky] = useState(false);
  const { add, cart, setDrawerOpen } = useCart(),
    { notify } = useToast(),
    { ids, toggle } = useWishlist();
  const recentIds = useRecentlyViewed(product.id),
    cta = useRef(null),
    sizes = useRef(null),
    timers = useRef([]),
    busy = useRef(false);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    let frame;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSticky(
          !!cta.current && cta.current.getBoundingClientRect().bottom <= 0,
        ),
      );
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  function addToBag() {
    if (busy.current) return;
    if (!size) {
      setError("Select a size");
      sizes.current?.querySelector("button")?.focus();
      return;
    }
    const existing =
      cart.find((i) => i.product_id === product.id && i.size === size)
        ?.quantity || 0;
    if (existing + quantity > 10) {
      setError(
        `Maximum 10 per size. You already have ${existing} in your bag.`,
      );
      return;
    }
    busy.current = true;
    setError("");
    setState("loading");
    timers.current.push(
      setTimeout(() => {
        add(product, size, quantity);
        setState("added");
        notify("Added to your bag.", "success");
        timers.current.push(
          setTimeout(() => {
            setDrawerOpen(true);
            setState("idle");
            busy.current = false;
          }, 600),
        );
      }, 250),
    );
  }
  const addButton = (
    <Button
      loading={state === "loading"}
      disabled={state === "added" || !product.sizes?.length}
      onClick={addToBag}
    >
      {state === "loading" ? (
        "Adding…"
      ) : state === "added" ? (
        <>
          <Icon name="check" /> Added
        </>
      ) : (
        "Add to bag"
      )}
    </Button>
  );
  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);
  const recent = recentIds
    .map((id) => products.find((p) => String(p.id) === id))
    .filter(Boolean)
    .slice(0, 4);
  const saving = Math.max(0, (product.compare_at || 0) - product.price);
  return (
    <>
      <section className="section-shell product-detail">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Shop", to: "/shop" },
            {
              label: product.category,
              to: `/shop/${encodeURIComponent(product.category)}`,
            },
            { label: product.name },
          ]}
        />
        <div className="pdp-layout">
          <ProductGallery product={product} />
          <div className="pdp-info">
            {product.tag && <span className="pdp-tag">{product.tag}</span>}
            <h1>{product.name}</h1>
            <div className="pdp-price">
              <strong>{money(product.price)}</strong>
              {saving > 0 && (
                <>
                  <del>{money(product.compare_at)}</del>
                  <span className="pdp-saving">You save {money(saving)}</span>
                </>
              )}
            </div>
            <ProductFacts product={product} />
            <p className="pdp-intro">{product.description}</p>
            {product.image_note && (
              <p className="muted pdp-image-note">{product.image_note}</p>
            )}
            <div className="size-heading">
              <span id="size-label">Choose your size{size && `: ${size}`}</span>
              <button className="text-button" onClick={() => setGuide(true)}>
                Size guide
              </button>
            </div>
            <div
              ref={sizes}
              className={`pdp-sizes ${error ? "has-error" : ""}`}
              role="group"
              aria-labelledby="size-label"
              aria-describedby={error ? "size-error" : undefined}
            >
              {(product.sizes || []).map((s) => (
                <button
                  key={s}
                  className="chip"
                  aria-pressed={s === size}
                  onClick={() => {
                    setSize(s);
                    setError("");
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {!product.sizes?.length && (
              <p className="muted">This item is currently unavailable.</p>
            )}
            {error && (
              <p id="size-error" role="alert" className="pdp-error">
                {error}
              </p>
            )}
            <div className="pdp-purchase" ref={cta}>
              <div className="pdp-quantity">
                <span id="quantity-label">Quantity</span>
                <div role="group" aria-labelledby="quantity-label">
                  <button
                    className="icon-button"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1 || state !== "idle"}
                    onClick={() => setQuantity((q) => q - 1)}
                  >
                    −
                  </button>
                  <input
                    aria-label="Quantity"
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    disabled={state !== "idle"}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= 10)
                        setQuantity(n);
                    }}
                  />
                  <button
                    className="icon-button"
                    aria-label="Increase quantity"
                    disabled={quantity >= 10 || state !== "idle"}
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              {addButton}
            </div>
            <button
              className="button button-light pdp-wishlist"
              aria-pressed={ids.includes(product.id)}
              onClick={() => toggle(product.id)}
            >
              <Icon
                name="heart"
                fill={ids.includes(product.id) ? "currentColor" : "none"}
              />
              {ids.includes(product.id)
                ? "Saved to wishlist"
                : "Save to wishlist"}
            </button>
            <a
              className="pdp-enquiry"
              href={wa(
                `Hello, I’d like to enquire about ${product.name}${size ? `, size ${size}` : ". Please help me choose a size"}.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="chat" /> Enquire on WhatsApp <Icon name="arrow" />
            </a>
            <ul className="pdp-trust">
              <li>
                <Icon name="delivery" />
                {DELIVERY_COPY}
              </li>
              <li>
                <Icon name="returns" />
                7-day returns
              </li>
              <li>
                <Icon name="shield" />
                Secure checkout
              </li>
            </ul>
            <DeliveryChecker />
            <div className="pdp-accordions">
              <details open>
                <summary>Description</summary>
                <p>{product.description}</p>
              </details>
              <details>
                <summary>Fabric & care</summary>
                <p>
                  {product.fabric ||
                    "Fabric composition is not available for this item. Ask us on WhatsApp for product details."}
                </p>
                <p>
                  {product.care ||
                    "Follow the care instructions on your garment label."}
                </p>
              </details>
              <details>
                <summary>Shipping & returns</summary>
                <p>
                  {DELIVERY_COPY}. Easy 7-day returns. Contact our team on
                  WhatsApp for shipping and return assistance.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="section-shell pdp-recommendations">
          <h2>You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
      {recent.length > 0 && (
        <section className="section-shell pdp-recommendations">
          <h2>Recently viewed</h2>
          <ProductGrid products={recent} />
        </section>
      )}
      <SizeGuide
        open={guide}
        onClose={() => setGuide(false)}
        category={product.category}
        kind={product.size_guide}
      />
      {sticky && (
        <div className="mobile-product-bar">
          <div>
            <strong>{money(product.price)}</strong>
            <span>
              {size ? `Size ${size} · Qty ${quantity}` : "Select a size"}
            </span>
          </div>
          {addButton}
        </div>
      )}
    </>
  );
}
