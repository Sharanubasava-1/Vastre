import { useId } from "react";
import { SORT_OPTIONS } from "../../utils/listing";
export default function SortSelect({ value, onChange }) {
  const id = useId();
  return (
    <div className="sort-select">
      <label htmlFor={id}>Sort by</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {SORT_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
