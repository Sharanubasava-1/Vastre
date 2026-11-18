export const SITE_NAME = "Vastré";
export const DEFAULT_DESCRIPTION =
  "Considered essentials for men. Shop shirts, T-shirts, trousers, jeans, hoodies and sportswear at Vastré. Everyday. Elevated.";
export function absoluteUrl(path, origin) {
  try {
    const url = new URL(path || "/", origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function pageMetadata(pathname, search, products, loading, origin) {
  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const id = pathname.match(/^\/products\/([^/]+)$/)?.[1];
  const product = products.find((item) => String(item.id) === decode(id));
  const category = pathname.startsWith("/shop/")
    ? decode(pathname.split("/")[2])
    : null;
  const pages = {
    "/": "Everyday. Elevated.",
    "/shop": "Shop men’s clothing",
    "/cart": "Your bag",
    "/coupons": "Offers",
    "/login": "Log in",
    "/admin/login": "Admin login",
    "/wishlist": "Your wishlist",
    "/verify-email": "Verify your email",
    "/access-denied": "Access denied",
    "/admin": "Admin",
    "/admin/orders": "Admin orders",
    "/admin/products": "Admin products",
    "/admin/coupons": "Admin coupons",
    "/admin/users": "Admin users",
  };
  const tab = new URLSearchParams(search).get("tab") || "overview";
  const accountTab = [
    "overview",
    "orders",
    "wishlist",
    "addresses",
    "profile",
    "security",
  ].includes(tab)
    ? tab
    : "overview";
  const title =
    product?.name ||
    pages[pathname] ||
    (pathname === "/account"
      ? `${accountTab[0].toUpperCase()}${accountTab.slice(1)} — Your account`
      : category
        ? `${category} — Shop`
        : id && loading
          ? "Product"
          : "Page not found");
  const noindex =
    title === "Page not found" ||
    /^\/(?:login|account|cart|wishlist|verify-email|access-denied|admin)(?:\/|$)/.test(
      pathname,
    ) ||
    (pathname.startsWith("/shop") && new URLSearchParams(search).has("q"));
  const canonical = absoluteUrl(pathname, origin);
  const description = (
    product?.description ||
    (pathname === "/"
      ? DEFAULT_DESCRIPTION
      : `Discover Vastré. ${title}. Everyday essentials for men.`)
  ).slice(0, 160);
  const data = [];
  if (product) {
    const images = [
      ...new Set([product.image, ...(product.images || [])].filter(Boolean)),
    ]
      .map((image) => absoluteUrl(image, origin))
      .filter(Boolean);
    data.push({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: images,
      description: product.description || description,
      sku: String(product.id),
      brand: { "@type": "Brand", name: SITE_NAME },
      offers: {
        "@type": "Offer",
        url: canonical,
        priceCurrency: "INR",
        price: product.price,
        availability: product.sizes?.length
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    });
  }
  if (pathname.startsWith("/shop") || product) {
    const crumbs = [
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
    ];
    const name = product?.category || category;
    if (name) crumbs.push({ name, path: `/shop/${encodeURIComponent(name)}` });
    if (product) crumbs.push({ name: product.name, path: pathname });
    data.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path, origin),
      })),
    });
  }
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    canonical,
    noindex,
    image: absoluteUrl(
      product?.image || "/images/mens/photo-1617137968427-85924c800a22.jpg",
      origin,
    ),
    product,
    data,
  };
}
