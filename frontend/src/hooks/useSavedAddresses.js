import { useOwnerData } from "../context/OwnerDataContext";
import { ownerId, ownerStorageKey } from "../utils/ownerStorage";
export function addressStorageKey(user) {
  return ownerStorageKey("addresses", ownerId(user));
}
export default function useSavedAddresses() {
  const { addresses, saveAddresses } = useOwnerData();
  return { addresses, save: saveAddresses };
}
