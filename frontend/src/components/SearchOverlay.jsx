import { imageUrl } from "../utils/images";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext";
import { matchesSearch } from "../utils/listing";
import { cats, money } from "../utils/store";
import Drawer from "./Drawer";
import Icon from "./Icon";
export default function SearchOverlay({ open, onClose }) {
  const { products, loading } = useCatalog(),
    [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [selected, setSelected] = useState(-1),
    input = useRef(null),
    id = useId(),
    navigate = useNavigate();
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setSelected(-1);
    }
  }, [open]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setSelected(-1);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const pending = query.trim() !== debounced,
    matches = debounced
      ? products.filter((product) => matchesSearch(product, debounced))
      : [],
    results = matches.slice(0, 8);
  function allResults() {
    if (query.trim()) navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
  }
  function keys(event) {
    if (pending || !results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((old) => (old + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((old) => (old <= 0 ? results.length - 1 : old - 1));
    } else if (event.key === "Enter" && selected >= 0) {
      event.preventDefault();
      navigate(`/products/${results[selected].id}`);
    }
  }
  useEffect(() => {
    if (selected >= 0)
      document
        .getElementById(`${id}-${selected}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [selected, id]);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Search"
      className="search-panel"
      initialFocusRef={input}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          allResults();
        }}
      >
        <label htmlFor={`${id}-input`}>Search the collection</label>
        <div className="search-input-wrap">
          <Icon name="search" />
          <input
            ref={input}
            id={`${id}-input`}
            type="search"
            role="combobox"
            autoComplete="off"
            value={query}
            placeholder="Try linen, jeans, or hoodies"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(-1);
            }}
            onKeyDown={keys}
            aria-autocomplete="list"
            aria-controls={`${id}-results`}
            aria-expanded={Boolean(debounced) && !pending && results.length > 0}
            aria-activedescendant={
              selected >= 0 && !pending ? `${id}-${selected}` : undefined
            }
          />
        </div>
      </form>
      {!query.trim() ? (
        <div className="search-suggestions">
          <p className="muted">Explore by category</p>
          <div>
            {cats.map((category) => (
              <Link
                className="chip"
                key={category}
                to={`/shop/${encodeURIComponent(category)}`}
              >
                {category}
              </Link>
            ))}
          </div>
          <p className="search-hint">
            Type to search. Use ↑ / ↓ to choose a result and Enter to open it.
          </p>
        </div>
      ) : loading || pending ? (
        <p className="search-status" role="status">
          Searching the collection…
        </p>
      ) : (
        <>
          <p className="search-status" role="status">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </p>
          <ul
            id={`${id}-results`}
            className="search-results"
            role="listbox"
            aria-label="Search results"
          >
            {results.map((product, index) => (
              <li
                id={`${id}-${index}`}
                key={product.id}
                role="option"
                aria-selected={selected === index}
                onPointerMove={() => setSelected(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <img
                  decoding="async"
                  src={imageUrl(product.image, "thumbnail")}
                  alt=""
                  width="56"
                  height="70"
                  loading="lazy"
                />
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {product.category} · {money(product.price)}
                  </small>
                </span>
                <Icon name="arrow" width="18" height="18" />
              </li>
            ))}
          </ul>
          {matches.length > 0 ? (
            <Link
              className="button button-dark full-width"
              to={`/shop?q=${encodeURIComponent(debounced)}`}
            >
              View all {matches.length} results
            </Link>
          ) : (
            <p className="search-empty">
              No pieces found. Try another name or category.
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}
