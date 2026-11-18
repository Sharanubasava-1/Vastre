import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
export default function ScrollToTop() {
  const location = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (!location.hash && !document.querySelector("dialog[open]"))
      document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return null;
}
