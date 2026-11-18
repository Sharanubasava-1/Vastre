import { useState } from "react";
export default function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  let picture = "";
  try {
    const url = new URL(user?.picture);
    if (
      url.protocol === "https:" &&
      (url.hostname === "googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com"))
    )
      picture = url.href;
  } catch {
    /* Initials work without a photo. */
  }
  const initials = (user?.name || user?.email || "V")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className="account-avatar" aria-hidden="true">
      {picture && !failed ? (
        <img
          decoding="async"
          src={picture}
          alt=""
          width="44"
          height="44"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
