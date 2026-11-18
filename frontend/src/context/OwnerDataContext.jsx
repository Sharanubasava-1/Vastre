import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useLocation } from "react-router-dom";
import {
  mergeGuest,
  ownerId,
  persistOwner,
  readOwner,
  writeOwner,
  normalizeAddresses,
} from "../utils/ownerStorage";

const OwnerDataContext = createContext(null);
export const useOwnerData = () => useContext(OwnerDataContext);
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
export function OwnerDataProvider({ children }) {
  const { user } = useAuth(),
    owner = ownerId(user);
  const location = useLocation();
  const currentOwner = useRef(owner);
  const [data, setData] = useState(() => {
    const stored = readOwner(browserStorage(), owner);
    return owner === "guest"
      ? stored
      : mergeGuest(stored, readOwner(browserStorage(), "guest"));
  });
  // Adjust before descendants render: no frame displays the previous owner.
  // Reads have no side effects; migrations are persisted only after commit.
  if (data.owner !== owner) {
    const stored = readOwner(browserStorage(), owner);
    const guest =
      data.owner === "guest" ? data : readOwner(browserStorage(), "guest");
    setData({
      ...(owner === "guest" ? stored : mergeGuest(stored, guest)),
      resetLocationKey: location.key,
    });
  }
  useLayoutEffect(() => {
    currentOwner.current = data.owner;
    persistOwner(browserStorage(), data);
  }, [data]);
  const update = useCallback(
    (field, value) => {
      setData((old) =>
        old.owner === owner
          ? {
              ...old,
              [field]: typeof value === "function" ? value(old[field]) : value,
            }
          : old,
      );
    },
    [owner],
  );
  const setCart = useCallback((value) => update("cart", value), [update]);
  const setIds = useCallback((value) => update("ids", value), [update]);
  const saveAddresses = useCallback(
    (value) => {
      if (currentOwner.current !== owner) return false;
      const next = normalizeAddresses(value);
      update("addresses", next);
      return writeOwner(browserStorage(), "addresses", owner, next);
    },
    [owner, update],
  );
  return (
    <OwnerDataContext.Provider
      value={{ ...data, setCart, setIds, saveAddresses }}
    >
      {/* Reset drawers, forms, pending quotes/payment UI and async lifetimes. */}
      <Fragment key={owner}>{children}</Fragment>
    </OwnerDataContext.Provider>
  );
}
