import { createContext, useContext } from "react";
import { useOwnerData } from "./OwnerDataContext";
const WishlistContext = createContext(null);
export const useWishlist = () => useContext(WishlistContext);
export function WishlistProvider({ children }) {
  const { ids, setIds } = useOwnerData();
  function toggle(id) {
    setIds((old) =>
      old.includes(id) ? old.filter((item) => item !== id) : [...old, id],
    );
  }
  function remove(id) {
    setIds((old) => old.filter((item) => item !== id));
  }
  return (
    <WishlistContext.Provider value={{ ids, toggle, remove }}>
      {children}
    </WishlistContext.Provider>
  );
}
