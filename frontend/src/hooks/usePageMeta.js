import { useEffect } from "react";
import { SITE_NAME } from "../utils/metadata";
export default function usePageMeta(meta) {
  useEffect(() => {
    document.title = meta.title;
    const tags = {
      description: meta.description,
      robots: meta.noindex ? "noindex, follow" : "index, follow",
      "twitter:card": "summary_large_image",
      "twitter:title": meta.title,
      "twitter:description": meta.description,
      "twitter:image": meta.image,
      "og:title": meta.title,
      "og:description": meta.description,
      "og:type": meta.product ? "product" : "website",
      "og:url": meta.canonical,
      "og:image": meta.image,
      "og:image:alt":
        meta.product?.alt || meta.product?.name || "Vastré menswear",
      "og:site_name": SITE_NAME,
      ...(meta.product
        ? {
            "product:price:amount": String(meta.product.price),
            "product:price:currency": "INR",
          }
        : {}),
    };
    const remove = [];
    for (const [key, value] of Object.entries(tags)) {
      const attribute =
        key.startsWith("og:") || key.startsWith("product:")
          ? "property"
          : "name";
      let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.append(element);
        remove.push(element);
      }
      element.content = value || "";
    }
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = meta.canonical;
    document.head.append(canonical);
    remove.push(canonical);
    if (meta.data.length) {
      // Inert JSON data, never executable code/innerHTML. Keep CSP enforcing.
      const structured = document.createElement("script");
      structured.type = "application/ld+json";
      structured.dataset.pageMeta = "true";
      structured.textContent = JSON.stringify(meta.data).replace(
        /</g,
        "\\u003c",
      );
      document.head.append(structured);
      remove.push(structured);
    }
    return () => remove.forEach((element) => element.remove());
  }, [
    meta.title,
    meta.description,
    meta.canonical,
    meta.noindex,
    meta.image,
    meta.product,
    JSON.stringify(meta.data),
  ]);
}
