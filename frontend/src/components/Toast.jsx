import { useEffect } from "react";
import Icon from "./Icon";
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 4000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);
  return (
    <div
      className={`toast toast-${toast.type}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon
        name={
          toast.type === "success"
            ? "check"
            : toast.type === "error"
              ? "error"
              : "info"
        }
      />
      <span>{toast.message}</span>
      <button
        className="icon-button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <Icon name="close" width="18" height="18" />
      </button>
    </div>
  );
}
