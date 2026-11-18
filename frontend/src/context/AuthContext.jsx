import { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../api/client";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  const version = useRef(0);
  function clearUser() {
    version.current++;
    setUser(null);
    setLoading(false);
  }
  useEffect(() => {
    const expired = (event) => {
      if (event.detail.status === 401) clearUser();
    };
    window.addEventListener("vastre:auth-error", expired);
    return () => window.removeEventListener("vastre:auth-error", expired);
  }, []);
  useEffect(() => {
    let active = true;
    const request = version.current;
    api("/auth/me")
      .then((value) => {
        if (active && request === version.current) setUser(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active && request === version.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function authenticate(endpoint, data) {
    const request = ++version.current;
    try {
      const value = await api(endpoint, data);
      if (request === version.current) setUser(value);
      return value;
    } finally {
      if (request === version.current) setLoading(false);
    }
  }
  async function logout() {
    const request = ++version.current;
    await api("/auth/logout", {});
    if (request === version.current) {
      setUser(null);
      setLoading(false);
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        clearUser,
        acceptGoogle: (value) => {
          version.current++;
          setUser(value);
          setLoading(false);
        },
        login: (data) => authenticate("/auth/login", data),
        register: (data) => authenticate("/auth/register", data),
        logout,
        refresh: async () => {
          const request = ++version.current;
          const value = await api("/auth/me", undefined, {
            authError: "session",
          });
          if (!value?.email)
            throw new Error("Couldn’t refresh your account. Please try again.");
          if (request === version.current) setUser(value);
          return value;
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
