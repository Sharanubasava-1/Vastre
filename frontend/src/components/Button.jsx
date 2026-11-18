export default function Button({
  children,
  loading = false,
  disabled = false,
  variant = "dark",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
