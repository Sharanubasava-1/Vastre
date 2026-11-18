import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <section className="section-shell">
      <h1 className="page-title">Page not found</h1>
      <p>The page you’re looking for could not be found.</p>
      <Link className="button button-dark" to="/shop">
        Explore the collection
      </Link>
    </section>
  );
}
