const fields = [
  {
    name: "fullName",
    label: "Full name",
    autoComplete: "shipping name",
    maxLength: 80,
  },
  {
    name: "phone",
    label: "Mobile number",
    autoComplete: "shipping tel-national",
    inputMode: "tel",
    maxLength: 10,
    type: "tel",
  },
  {
    name: "line1",
    label: "Address line 1",
    autoComplete: "shipping address-line1",
    maxLength: 200,
    wide: true,
  },
  {
    name: "line2",
    label: "Address line 2 (optional)",
    autoComplete: "shipping address-line2",
    maxLength: 200,
    wide: true,
  },
  {
    name: "city",
    label: "City",
    autoComplete: "shipping address-level2",
    maxLength: 80,
  },
  {
    name: "state",
    label: "State",
    autoComplete: "shipping address-level1",
    maxLength: 80,
  },
  {
    name: "pin",
    label: "PIN code",
    autoComplete: "shipping postal-code",
    inputMode: "numeric",
    maxLength: 6,
  },
];
export default function AddressForm({
  value,
  onChange,
  errors,
  onBlur,
  disabled,
  title = "Delivery address",
}) {
  return (
    <fieldset className="address-fields" disabled={disabled}>
      <legend>{title}</legend>
      <p className="muted">
        Where should we send your order? All fields except address line 2 are
        required.
      </p>
      <div className="address-grid">
        {fields.map((field) => (
          <div key={field.name} className={field.wide ? "address-wide" : ""}>
            <label htmlFor={`address-${field.name}`}>{field.label}</label>
            <input
              id={`address-${field.name}`}
              name={field.name}
              type={field.type || "text"}
              autoComplete={field.autoComplete}
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              required={field.name !== "line2"}
              value={value[field.name]}
              aria-invalid={!!errors[field.name]}
              aria-describedby={
                errors[field.name] ? `error-${field.name}` : undefined
              }
              onChange={(e) => onChange(field.name, e.target.value)}
              onBlur={() => onBlur(field.name)}
            />
            <span
              id={`error-${field.name}`}
              className="field-error"
              aria-live="polite"
            >
              {errors[field.name] || ""}
            </span>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
