import Heading from "../Heading";
import { Link } from "react-router-dom";
import { useCatalog } from "../../context/CatalogContext";
import { useWishlist } from "../../context/WishlistContext";
import ProductCard from "../ProductCard";
import Skeleton from "../Skeleton";
import Icon from "../Icon";
export default function WishlistList({ headingLevel = "h3" }) {
  const { products, loading } = useCatalog(),
    { ids, remove } = useWishlist();
  const saved = products.filter((product) => ids.includes(product.id)),
    missing = ids.filter(
      (id) => !products.some((product) => product.id === id),
    );
  if (loading) return <Skeleton />;
  return (
    <>
      {saved.length ? (
        <>
          <p className="muted">
            {saved.length} saved {saved.length === 1 ? "piece" : "pieces"}.
            Choose a size to move a favourite to your bag.
          </p>
          <div className="product-grid wishlist-products">
            {saved.map((product) => (
              <ProductCard key={product.id} product={product} moveToBag />
            ))}
          </div>
        </>
      ) : (
        <div className="account-empty">
          <Icon name="heart" width="40" height="40" />
          <Heading as={headingLevel}>
            {ids.length
              ? "Your saved pieces aren’t available right now."
              : "Keep your favourites close."}
          </Heading>
          <p>
            {ids.length
              ? "They may be missing from the current collection. Your wishlist stays saved."
              : "Use the heart on a product to save it here for later."}
          </p>
          <Link className="button button-dark" to="/shop">
            Explore the collection <Icon name="arrow" />
          </Link>
        </div>
      )}
      {missing.length > 0 && (
        <div className="wishlist-unavailable">
          <p className="muted">
            {missing.length} saved{" "}
            {missing.length === 1 ? "item is" : "items are"} not in the loaded
            collection.
          </p>
          <button className="text-link" onClick={() => missing.forEach(remove)}>
            Remove unavailable items
          </button>
        </div>
      )}
    </>
  );
}
