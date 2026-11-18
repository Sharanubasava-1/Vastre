import { useId } from "react";
import Icon from "./Icon";
export default function QuantityStepper({
  value,
  onChange,
  disabled = false,
  label = "Quantity",
}) {
  const id = useId();
  return (
    <div className="quantity-stepper">
      <label htmlFor={id}>{label}</label>
      <div className="stepper-controls">
        <button
          type="button"
          className="icon-button"
          aria-label="Decrease quantity"
          disabled={disabled || value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <Icon name="minus" />
        </button>
        <input
          id={id}
          type="number"
          min="1"
          max="10"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= 10) onChange(n);
          }}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Increase quantity"
          disabled={disabled || value >= 10}
          onClick={() => onChange(value + 1)}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
