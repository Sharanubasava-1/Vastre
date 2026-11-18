import { useState } from "react";
import { ANNOUNCEMENT } from "../config/storefront";
import Icon from "./Icon";
export default function AnnouncementBar() {
  const key = "vastre-announcement:" + ANNOUNCEMENT;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === "dismissed";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(key, "dismissed");
    } catch {
      /* Dismiss for this session. */
    }
  }
  return (
    <aside className="announcement-bar" aria-label="Store announcement">
      <p>{ANNOUNCEMENT}</p>
      <button
        className="icon-button"
        aria-label="Dismiss announcement"
        onClick={dismiss}
      >
        <Icon name="close" />
      </button>
    </aside>
  );
}
