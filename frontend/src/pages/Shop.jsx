import Heading from "../components/Heading";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext";
import {
  readListing,
  writeListing,
  filterProducts,
  clearListing,
  invalidPrice,
} from "../utils/listing";
import Breadcrumbs from "../components/Breadcrumbs";
import ProductGrid from "../components/ProductGrid";
import Drawer from "../components/Drawer";
import Icon from "../components/Icon";
import FilterControls from "../components/shop/FilterControls";
import SortSelect from "../components/shop/SortSelect";
import ShopSkeleton from "../components/shop/ShopSkeleton";
import ShopEmpty from "../components/shop/ShopEmpty";
export default function Shop() {
  const { products, loading } = useCatalog(),
    { category = "" } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate();
  const state = readListing(params, category);
  const filtered = filterProducts(products, state),
    visible = filtered.slice(0, state.limit);
  const [sheetOpen, setSheetOpen] = useState(false),
    [draft, setDraft] = useState(state);
  const selectedCategory =
    state.categories.length === 1 ? state.categories[0] : "";
  const count =
    state.categories.length +
    state.sizes.length +
    state.tags.length +
    Number(state.min !== "") +
    Number(state.max !== "") +
    Number(Boolean(state.q));
  function commit(next) {
    navigate(writeListing(next, params, category));
  }
  function patch(changes) {
    commit({ ...state, ...changes, limit: 12 });
  }
  function clear() {
    commit(clearListing(state));
  }
  function openFilters() {
    setDraft(state);
    setSheetOpen(true);
  }
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = (event) => {
      if (event.matches) setSheetOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  const chips = [
    ...state.categories.map((value) => ({
      label: value,
      key: "categories",
      value,
    })),
    ...state.sizes.map((value) => ({
      label: `Size ${value}`,
      key: "sizes",
      value,
    })),
    ...state.tags.map((value) => ({ label: value, key: "tags", value })),
    ...(state.min !== "" ? [{ label: `Min ₹${state.min}`, key: "min" }] : []),
    ...(state.max !== "" ? [{ label: `Max ₹${state.max}`, key: "max" }] : []),
    ...(state.q ? [{ label: `Search: ${state.q}`, key: "q" }] : []),
  ];
  const breadcrumbs = [
    { label: "Home", to: "/" },
    { label: "Shop", ...(selectedCategory ? { to: "/shop" } : {}) },
    ...(selectedCategory ? [{ label: selectedCategory }] : []),
  ];
  return (
    <section
      className="shop-page"
      style={{ "--listing-columns": state.columns }}
    >
      <Breadcrumbs items={breadcrumbs} />
      <div className="shop-heading">
        <div>
          <Heading className="page-title">
            {selectedCategory || "All clothing"}.
          </Heading>
          <p>Men’s essentials. Find your everyday fit.</p>
        </div>
      </div>
      <div className="shop-layout">
        <aside className="shop-sidebar" aria-label="Product filters">
          <div className="filter-heading">
            <h2>Filters</h2>
            <button className="text-link" onClick={clear}>
              Clear all
            </button>
          </div>
          <FilterControls state={state} onChange={patch} products={products} />
        </aside>
        <div className="shop-results">
          <div className="shop-toolbar">
            <p className="result-count" role="status" aria-live="polite">
              {loading
                ? "Loading collection…"
                : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`}
            </p>
            <button
              className="button button-ghost mobile-filters-trigger"
              onClick={openFilters}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
            >
              <Icon name="filter" />
              Filter & Sort{count > 0 && <span className="badge">{count}</span>}
            </button>
            <div className="desktop-sort">
              <SortSelect
                value={state.sort}
                onChange={(sort) => patch({ sort })}
              />
            </div>
            <div
              className="grid-density"
              role="group"
              aria-label="Grid density"
            >
              {[2, 3, 4].map((columns) => (
                <button
                  key={columns}
                  className="icon-button"
                  aria-label={`${columns} columns`}
                  aria-pressed={state.columns === columns}
                  onClick={() => commit({ ...state, columns })}
                >
                  <Icon name={`grid${columns}`} />
                </button>
              ))}
            </div>
          </div>
          {chips.length > 0 && (
            <div className="active-filters" aria-label="Active filters">
              {chips.map((chip) => (
                <button
                  className="chip"
                  key={`${chip.key}-${chip.value || ""}`}
                  aria-label={`Remove ${chip.label}`}
                  onClick={() =>
                    patch({
                      [chip.key]: Array.isArray(state[chip.key])
                        ? state[chip.key].filter(
                            (value) => value !== chip.value,
                          )
                        : "",
                    })
                  }
                >
                  {chip.label}
                  <Icon name="close" width="14" height="14" />
                </button>
              ))}
              <button className="text-link" onClick={clear}>
                Clear all
              </button>
            </div>
          )}
          <div className="listing-grid" aria-busy={loading}>
            {loading ? (
              <ShopSkeleton />
            ) : filtered.length ? (
              <ProductGrid products={visible} />
            ) : (
              <ShopEmpty onClear={clear} />
            )}
          </div>
          {!loading && filtered.length > 0 && (
            <div className="load-more">
              <p aria-live="polite">
                Showing {visible.length} of {filtered.length}
              </p>
              {visible.length < filtered.length && (
                <button
                  className="button button-dark"
                  onClick={() => commit({ ...state, limit: state.limit + 12 })}
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter & Sort"
        side="bottom"
        className="filter-sheet"
      >
        <SortSelect
          value={draft.sort}
          onChange={(sort) => setDraft((old) => ({ ...old, sort }))}
        />
        <FilterControls
          state={draft}
          onChange={(changes) => setDraft((old) => ({ ...old, ...changes }))}
          products={products}
        />
        <div className="filter-sheet-actions">
          <button
            className="text-link"
            onClick={() => setDraft(clearListing(draft))}
          >
            Clear all
          </button>
          <button
            className="button button-dark"
            disabled={invalidPrice(draft)}
            onClick={() => {
              commit({ ...draft, limit: 12 });
              setSheetOpen(false);
            }}
          >
            Apply
          </button>
        </div>
      </Drawer>
    </section>
  );
}
