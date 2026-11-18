import { useEffect, useState } from "react";
function read() {
  try {
    const items = JSON.parse(
      localStorage.getItem("vastre-recently-viewed") || "[]",
    );
    return Array.isArray(items)
      ? items
          .filter((id) => typeof id === "string" || typeof id === "number")
          .map(String)
      : [];
  } catch {
    return [];
  }
}
export default function useRecentlyViewed(id) {
  const [ids, setIds] = useState(read);
  useEffect(() => {
    const previous = read();
    setIds(previous.filter((item) => item !== String(id)));
    try {
      localStorage.setItem(
        "vastre-recently-viewed",
        JSON.stringify(
          [String(id), ...previous.filter((item) => item !== String(id))].slice(
            0,
            12,
          ),
        ),
      );
    } catch {
      /* Storage is optional. */
    }
  }, [id]);
  return ids.filter((item) => item !== String(id));
}
