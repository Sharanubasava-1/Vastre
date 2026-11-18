import { useOwnerData } from "./OwnerDataContext";
import { EMPTY_ADDRESS, formatAddress } from "../utils/checkout";
import { createContext, useContext, useEffect, useState } from "react";
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
export function CartProvider({ children }) {
  const { cart, setCart } = useOwnerData();
  const [coupon, setCoupon] = useState(""),
    [quote, setQuote] = useState(null),
    [addressFields, setAddressFields] = useState(EMPTY_ADDRESS),
    [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    setQuote(null);
  }, [cart]);
  function add(product, size, quantity = 1) {
    setCart((old) => {
      const existing = old.find(
        (i) => i.product_id === product.id && i.size === size,
      );
      return existing
        ? old.map((i) =>
            i === existing
              ? { ...i, quantity: Math.min(i.quantity + quantity, 10) }
              : i,
          )
        : [
            ...old,
            { product_id: product.id, size, quantity: Math.min(quantity, 10) },
          ];
    });
  }
  function clearPurchased(purchased) {
    setCart((old) =>
      old
        .map((item) => {
          const paid = purchased.find(
            (p) => p.product_id === item.product_id && p.size === item.size,
          );
          return paid
            ? { ...item, quantity: item.quantity - paid.quantity }
            : item;
        })
        .filter((item) => item.quantity > 0),
    );
  }
  function update(productId, size, quantity) {
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 10)
      setCart((old) =>
        old.map((i) =>
          i.product_id === productId && i.size === size
            ? { ...i, quantity }
            : i,
        ),
      );
  }
  function remove(productId, size) {
    setCart((old) =>
      old.filter((i) => !(i.product_id === productId && i.size === size)),
    );
  }
  return (
    <CartContext.Provider
      value={{
        cart,
        add,
        update,
        remove,
        clear: () => setCart([]),
        coupon,
        setCoupon,
        quote,
        setQuote,
        address: formatAddress(addressFields),
        addressFields,
        setAddressFields,
        clearPurchased,
        drawerOpen,
        setDrawerOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
