import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
// Native dialogs make the background inert; explicit Tab wrapping keeps keyboard focus inside the panel.
export default function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  className = "",
  initialFocusRef,
}) {
  const ref = useRef(null),
    titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current,
      previousOverflow = document.body.style.overflow,
      trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef]);
  // Closed panels contain no interactive/size-picker subtree. This matters on
  // collection pages with many cards and keeps hidden dialogs out of the DOM.
  if (!open) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`drawer drawer-${side} ${className}`}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (element) =>
            element.getClientRects().length > 0 && element.tabIndex >= 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="drawer-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
          autoFocus
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="drawer-body">{children}</div>
    </dialog>,
    document.body,
  );
}
