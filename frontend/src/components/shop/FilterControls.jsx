import { useId } from "react";
import { cats } from "../../utils/store";
import { FILTER_TAGS, invalidPrice } from "../../utils/listing";
export default function FilterControls({ state, onChange, products }) {
  const id = useId(),
    error = invalidPrice(state);
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const sizes = [
    ...new Set(products.flatMap((product) => product.sizes || [])),
  ].sort((a, b) => {
    const x = sizeOrder.indexOf(a),
      y = sizeOrder.indexOf(b);
    return x < 0 || y < 0 ? a.localeCompare(b) : x - y;
  });
  const toggle = (key, value) =>
    onChange({
      [key]: state[key].includes(value)
        ? state[key].filter((item) => item !== value)
        : [...state[key], value],
    });
  return (
    <div className="filter-controls">
      <fieldset>
        <legend>Category</legend>
        {cats.map((category) => (
          <label className="filter-option" key={category}>
            <input
              type="checkbox"
              checked={state.categories.includes(category)}
              onChange={() => toggle("categories", category)}
            />
            <span>{category}</span>
            <small>
              {
                products.filter((product) => product.category === category)
                  .length
              }
            </small>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Price (₹)</legend>
        <div className="price-inputs">
          <label htmlFor={`${id}-min`}>
            Minimum
            <input
              id={`${id}-min`}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={state.min}
              placeholder="0"
              onChange={(event) => onChange({ min: event.target.value })}
              aria-invalid={error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </label>
          <label htmlFor={`${id}-max`}>
            Maximum
            <input
              id={`${id}-max`}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={state.max}
              placeholder="Any"
              onChange={(event) => onChange({ max: event.target.value })}
              aria-invalid={error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </label>
        </div>
        {error && (
          <p id={`${id}-error`} className="field-error">
            Minimum price must not exceed maximum price.
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend>Size</legend>
        <div className="filter-sizes">
          {sizes.map((size) => (
            <button
              type="button"
              key={size}
              className="chip"
              aria-pressed={state.sizes.includes(size)}
              onClick={() => toggle("sizes", size)}
            >
              {size}
            </button>
          ))}
        </div>
        {!sizes.length && (
          <p className="muted">Sizes will appear with the collection.</p>
        )}
      </fieldset>
      <fieldset>
        <legend>Collection edit</legend>
        {FILTER_TAGS.map((tag) => (
          <label className="filter-option" key={tag}>
            <input
              type="checkbox"
              checked={state.tags.includes(tag)}
              onChange={() => toggle("tags", tag)}
            />
            <span>{tag}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
