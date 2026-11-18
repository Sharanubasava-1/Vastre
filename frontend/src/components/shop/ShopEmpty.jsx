export default function ShopEmpty({ onClear }) {
  return (
    <div className="shop-empty">
      <svg
        width="160"
        height="120"
        viewBox="0 0 160 120"
        fill="none"
        role="img"
        aria-label="An empty clothing rack"
      >
        <path
          d="M22 104V20h116v84M14 104h16m100 0h16M22 29h116"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M74 42a6 6 0 1 1 10 4l-4 3v6m0 0L51 73a3 3 0 0 0 2 5h54a3 3 0 0 0 2-5L80 55Z"
          stroke="var(--orange)"
          strokeWidth="2"
        />
        <path
          d="m116 62 14 14m-14 0 14-14"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <h2>
        No pieces found<span className="orange">.</span>
      </h2>
      <p>Try a wider price range or remove a filter to find your fit.</p>
      <button className="button button-dark" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
