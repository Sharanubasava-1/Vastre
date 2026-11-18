import { useEffect, useId, useRef, useState } from "react";
import ProductCard from "../ProductCard";
import Icon from "../Icon";
export default function ProductCarousel({ products }) {
  const ref = useRef(null),
    id = useId();
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const track = ref.current;
    function update() {
      setEdges({
        start: track.scrollLeft <= 2,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
      });
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", update);
    };
  }, [products]);
  function move(direction) {
    const track = ref.current;
    const card = track.querySelector(".product-card");
    const step =
      card.getBoundingClientRect().width +
      parseFloat(getComputedStyle(track).columnGap);
    track.scrollBy({
      left: direction * step,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <div className="product-carousel">
      <div className="carousel-controls" aria-label="New in carousel controls">
        <button
          className="icon-button"
          aria-label="Previous new arrivals"
          aria-controls={id}
          disabled={edges.start}
          onClick={() => move(-1)}
        >
          <Icon name="arrow" className="arrow-back" />
        </button>
        <button
          className="icon-button"
          aria-label="Next new arrivals"
          aria-controls={id}
          disabled={edges.end}
          onClick={() => move(1)}
        >
          <Icon name="arrow" />
        </button>
      </div>
      <div
        className="carousel-track"
        id={id}
        ref={ref}
        role="region"
        aria-roledescription="carousel"
        aria-label="New arrivals"
        tabIndex={0}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
