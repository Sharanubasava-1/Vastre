import { createContext, useContext, useEffect, useState } from "react";
const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(() => {
    try {
      const stored = localStorage.getItem("vastre-theme");
      return ["light", "dark"].includes(stored) ? stored : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const theme = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (e) => setSystemDark(e.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (choice === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
  }, [choice]);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setChoice(next);
    try {
      localStorage.setItem("vastre-theme", next);
    } catch {
      /* The current session still gets the chosen theme. */
    }
  }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
