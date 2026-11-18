import { wa } from "../utils/store";
import { useLocation } from "react-router-dom";
export default function WhatsAppButton() {
  const { pathname } = useLocation();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return (
    <a
      className={`whatsapp-float${pathname.startsWith("/products/") ? " is-product-page" : ""}`}
      href={wa("Hello Vastré, I have an enquiry.")}
      target="_blank"
      rel="noreferrer"
    >
      WhatsApp ↗
    </a>
  );
}
