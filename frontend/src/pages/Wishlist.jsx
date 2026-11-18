import "../styles/account.css";
import WishlistList from "../components/account/WishlistList";
export default function Wishlist() {
  return (
    <section className="section-shell wishlist-page">
      <h1 className="page-title">
        Your wishlist<span className="orange">.</span>
      </h1>
      <WishlistList headingLevel="h2" />
    </section>
  );
}
