import assets from "../config/imageAssets.js";
const widths = { card: 600, detail: 1200, thumbnail: 160 };
const available = new Set(assets);
function localName(source) {
  const match = source.match(/^\/images\/mens\/(photo-[\w-]+)\.jpg(?:\?.*)?$/);
  return match && available.has(match[1]) ? match[1] : null;
}
export function imageUrl(source, variant = "card") {
  if (typeof source !== "string" || !source) return source;
  const width = typeof variant === "number" ? variant : widths[variant] || 600;
  const name = localName(source);
  if (name) return `/images/mens/optimized/${name}-${width}.webp`;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.hostname !== "images.unsplash.com")
      return source;
    url.searchParams.set("w", String(width));
    url.searchParams.set("auto", "format");
    return url.href;
  } catch {
    return source;
  }
}

export function responsiveImage(
  source,
  sizes = "(max-width: 600px) 50vw, 25vw",
) {
  const supported =
    typeof source === "string" &&
    (localName(source) || /^https:\/\/images\.unsplash\.com\//.test(source));
  return {
    src: imageUrl(source),
    ...(supported
      ? {
          srcSet: [160, 600, 1200]
            .map((width) => `${imageUrl(source, width)} ${width}w`)
            .join(", "),
          sizes,
        }
      : {}),
  };
}
