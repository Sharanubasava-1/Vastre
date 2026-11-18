import Heading from "../Heading";

export function AdminSkeleton({ label }) {
  return (
    <div
      className="admin-skeleton"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}…</span>
      <div className="admin-skeleton-stats" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <span key={n} />
        ))}
      </div>
      <div className="admin-skeleton-rows" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} />
        ))}
      </div>
    </div>
  );
}

export function AdminEmpty({ title, children, onClear }) {
  return (
    <div className="admin-state">
      <Heading as="h2">{title}</Heading>
      <p className="muted">{children}</p>
      {onClear && (
        <button className="button button-light" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
