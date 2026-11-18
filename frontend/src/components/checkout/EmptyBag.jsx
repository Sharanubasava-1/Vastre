import { Link } from "react-router-dom";
import { cats } from "../../utils/store";
import Icon from "../Icon";
export default function EmptyBag({ onNavigate }) {
  return (
    <div className="empty-bag">
      <Icon name="bag" width="48" height="48" />
      <h2>
        A little room for something good<span className="orange">.</span>
      </h2>
      <p>Your bag is empty. Find your next everyday favourite.</p>
      <Link className="button button-dark" to="/shop" onClick={onNavigate}>
        Explore the collection
      </Link>
      <div className="empty-bag-categories">
        {cats.map((category) => (
          <Link
            className="chip"
            key={category}
            to={`/shop/${encodeURIComponent(category)}`}
            onClick={onNavigate}
          >
            {category}
          </Link>
        ))}
      </div>
    </div>
  );
}
