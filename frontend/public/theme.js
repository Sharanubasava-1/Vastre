try {
  const theme = localStorage.getItem("vastre-theme");
  if (theme === "light" || theme === "dark")
    document.documentElement.dataset.theme = theme;
} catch {}

// Discover Home's responsive hero before the application bundle executes.
// Other routes do not download an unrelated hero image.
if (location.pathname === "/") {
  const font = document.createElement("link");
  font.rel = "preload";
  font.as = "font";
  font.type = "font/woff2";
  font.crossOrigin = "anonymous";
  font.href =
    "/fonts/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_pqTbtY.woff2";
  document.head.append(font);
  const image = document.createElement("link");
  image.rel = "preload";
  image.as = "image";
  image.href = "/images/mens/hero-1200.webp";
  image.imageSrcset =
    "/images/mens/hero-600.webp 600w, /images/mens/hero-1200.webp 1200w, /images/mens/hero-1800.webp 1800w";
  image.imageSizes = "100vw";
  image.fetchPriority = "high";
  document.head.append(image);
}
