export default function HomeSkeleton({ variant = "products", count = 4 }) {
  return (
    <div
      className={`home-skeletons home-skeletons-${variant}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="home-skeleton" key={index}>
          <div className="skeleton-image" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-short" />
        </div>
      ))}
    </div>
  );
}
