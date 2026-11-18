import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import { useToast } from "./ToastContext";
const CatalogContext = createContext(null);
export const useCatalog = () => useContext(CatalogContext);
export function CatalogProvider({ children }) {
  const [products, setProducts] = useState([]),
    [offers, setOffers] = useState([]),
    [loading, setLoading] = useState(true),
    [offersLoading, setOffersLoading] = useState(true);
  const { notify } = useToast();
  useEffect(() => {
    api("/products")
      .then(setProducts)
      .catch((e) => notify(e.message, "error"))
      .finally(() => setLoading(false));
    api("/coupons")
      .then(setOffers)
      .catch(() => {})
      .finally(() => setOffersLoading(false));
  }, [notify]);
  return (
    <CatalogContext.Provider
      value={{ products, offers, loading, offersLoading }}
    >
      {children}
    </CatalogContext.Provider>
  );
}
