import { useEffect, useState, useRef } from "react";
import Drawer from "../Drawer";
import Icon from "../Icon";
import { imageUrl, responsiveImage } from "../../utils/images";
export default function ProductGallery({ product }) {
  const images = [
    ...new Set([...(product.images || []), product.image].filter(Boolean)),
  ];
  const [index, setIndex] = useState(0),
    [open, setOpen] = useState(false),
    [zoom, setZoom] = useState(false);
  const start = useRef(null),
    swiped = useRef(false);
  function move(delta) {
    setIndex((old) => (old + delta + images.length) % images.length);
    setZoom(false);
  }
  useEffect(() => {
    if (images.length < 2) return;
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    const props = responsiveImage(
      images[index],
      "(max-width: 768px) 100vw, 55vw",
    );
    preload.href = props.src;
    preload.imageSrcset = props.srcSet || "";
    preload.imageSizes = props.sizes || "";
    preload.fetchPriority = "high";
    document.head.appendChild(preload);
    return () => preload.remove();
  }, [index, images.join("|")]);
  useEffect(() => {
    if (!open) return;
    function key(event) {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, images.length]);
  const swipe = {
    onTouchStart: (e) => {
      swiped.current = false;
      start.current =
        e.touches.length === 1
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
    },
    onTouchEnd: (e) => {
      if (!start.current || (open && zoom)) return;
      const dx = e.changedTouches[0].clientX - start.current.x,
        dy = e.changedTouches[0].clientY - start.current.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        swiped.current = true;
        move(dx < 0 ? 1 : -1);
      }
      start.current = null;
    },
  };
  const navigation = (
    <div className="gallery-navigation">
      <button
        className="icon-button gallery-prev"
        aria-label="Previous image"
        onClick={() => move(-1)}
      >
        <Icon name="arrow" />
      </button>
      <span aria-live="polite">
        {index + 1} / {images.length}
      </span>
      <button
        className="icon-button"
        aria-label="Next image"
        onClick={() => move(1)}
      >
        <Icon name="arrow" />
      </button>
    </div>
  );
  return (
    <>
      <div className="pdp-gallery">
        <div className="pdp-thumbnails" aria-label="Product images">
          {images.map((src, i) => (
            <button
              key={src}
              aria-label={`View ${product.name} image ${i + 1}`}
              aria-pressed={index === i}
              onClick={() => {
                setIndex(i);
                setZoom(false);
              }}
            >
              <img
                decoding="async"
                src={imageUrl(src, "thumbnail")}
                srcSet={responsiveImage(src).srcSet}
                sizes="80px"
                width="80"
                height="100"
                alt=""
                loading="lazy"
              />
            </button>
          ))}
        </div>
        <div className="gallery-stage" {...swipe}>
          <button
            className="gallery-open"
            aria-label={`Enlarge ${product.name} image ${index + 1}`}
            onClick={() => {
              if (swiped.current) {
                swiped.current = false;
                return;
              }
              setZoom(false);
              setOpen(true);
            }}
          >
            <img
              decoding="async"
              {...responsiveImage(
                images[index],
                "(max-width: 768px) 100vw, 55vw",
              )}
              alt={`${product.image_alts?.[index] || product.alt || product.name}, view ${index + 1}`}
              width="800"
              height="1000"
              loading="eager"
              fetchPriority="high"
              onLoad={() => {
                if (images.length > 1) {
                  const next = new Image();
                  next.fetchPriority = "low";
                  next.src = imageUrl(
                    images[(index + 1) % images.length],
                    "detail",
                  );
                }
              }}
            />
            <span>
              View larger <Icon name="search" />
            </span>
          </button>
          {images.length > 1 && navigation}
        </div>
      </div>
      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          setZoom(false);
        }}
        title={`${product.name} gallery`}
        className="product-lightbox"
      >
        <div className={`lightbox-stage ${zoom ? "is-zoomed" : ""}`} {...swipe}>
          <img
            decoding="async"
            src={imageUrl(images[index], "detail")}
            srcSet={responsiveImage(images[index]).srcSet}
            sizes="100vw"
            alt={`${product.image_alts?.[index] || product.alt || product.name}, view ${index + 1}`}
            width="1200"
            height="1500"
          />
        </div>
        <div className="lightbox-controls">
          {images.length > 1 && navigation}
          <button
            className="button button-light"
            aria-pressed={zoom}
            onClick={() => setZoom(!zoom)}
          >
            {zoom ? "Zoom out" : "Zoom in"}
          </button>
        </div>
        <p className="muted">
          Use arrow keys or swipe to browse. Escape closes the gallery.
        </p>
      </Drawer>
    </>
  );
}
