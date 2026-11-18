import { useLocation } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext";
import usePageMeta from "../hooks/usePageMeta";
import { pageMetadata } from "../utils/metadata";
export default function PageMetadata() {
  const { pathname, search } = useLocation();
  const { products, loading } = useCatalog();
  usePageMeta(
    pageMetadata(pathname, search, products, loading, window.location.origin),
  );
  return null;
}
