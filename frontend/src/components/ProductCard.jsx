import { useState } from "react";
import { Link } from "react-router-dom";
import { useWishlist } from "../context/WishlistContext";
import Icon from "./Icon";
import Price from "./Price";
import QuickAdd from "./QuickAdd";
import { responsiveImage } from "../utils/images";
export default function ProductCard({ product: p, moveToBag = false }) {
  const { ids, toggle } = useWishlist(),
    [secondFailed, setSecondFailed] = useState(false);
  const second = p.images?.[1],
    discount =
      Number.isFinite(p.compare_at) &&
      p.compare_at > p.price &&
      p.compare_at > 0
        ? Math.round((1 - p.price / p.compare_at) * 100)
        : 0;
  return (
    <article className="product-card">
      <div className="card-media">
        <Link to={`/products/${p.id}`}>
          <div className="product-image">
            <img
              decoding="async"
              className="product-primary"
              {...responsiveImage(p.image)}
              alt={p.alt || p.name}
              loading="lazy"
              width="800"
              height="1000"
            />
            {second && second !== p.image && !secondFailed && (
              <img
                decoding="async"
                className="product-secondary"
                {...responsiveImage(second)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                width="800"
                height="1000"
                onError={() => setSecondFailed(true)}
              />
            )}
          </div>
        </Link>
        <div className="card-badges">
          {p.tag && <span className="product-tag">{p.tag}</span>}
          {discount > 0 && (
            <span
              className="badge discount-badge"
              aria-label={`${discount}% off`}
            >
              −{discount}%
            </span>
          )}
        </div>
        <button
          className="icon-button product-save"
          aria-label={`${ids.includes(p.id) ? "Remove" : "Save"} ${p.name} ${ids.includes(p.id) ? "from" : "to"} wishlist`}
          aria-pressed={ids.includes(p.id)}
          onClick={() => toggle(p.id)}
        >
          <Icon name="heart" />
        </button>
        <QuickAdd product={p} moveToBag={moveToBag} />
      </div>
      <div className="product-info">
        <Link to={`/products/${p.id}`} className="product-name">
          {p.name}
        </Link>
        <div className="product-category">Men / {p.category}</div>
        <div className="product-price">
          <Price amount={p.price} />
          {p.compare_at > p.price && (
            <del>
              <Price amount={p.compare_at} />
            </del>
          )}
        </div>
      </div>
    </article>
  );
}
