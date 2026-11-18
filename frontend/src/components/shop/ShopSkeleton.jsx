export default function ShopSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading products…
      </p>
      <div className="product-grid listing-skeleton-grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <div className="home-skeleton" key={index}>
            <div className="skeleton-image" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-short" />
          </div>
        ))}
      </div>
    </>
  );
}
