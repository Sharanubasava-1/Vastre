import { Link } from "react-router-dom";
import { cats, money, wa } from "../utils/store";
import { useCatalog } from "../context/CatalogContext";
import ProductGrid from "../components/ProductGrid";
import Icon from "../components/Icon";
import NewsletterForm from "../components/NewsletterForm";
import ProductCarousel from "../components/home/ProductCarousel";
import HomeSkeleton from "../components/home/HomeSkeleton";
import { DELIVERY_COPY } from "../config/storefront";
import { responsiveImage } from "../utils/images";
const image = (name) => `/images/mens/${name}.jpg`;
const categoryImages = {
  Sportswear: image("photo-1554139844-af2fc8ad3a3a"),
  Shirts: image("photo-1603252110481-7ba873bf42ab"),
  "T-shirts": image("photo-1521572163474-6864f9cf17ab"),
  Trousers: image("photo-1624378439575-d8705ad7ae80"),
  Jeans: image("photo-1542272604-787c3835535d"),
  Hoodies: image("photo-1556821840-3a63f95609a7"),
};
const hasTag = (product, tag) => product.tag?.trim().toLowerCase() === tag;
const heroImage = "/images/mens/hero-1200.webp";
function EmptyCollection({ children }) {
  return (
    <p className="home-empty">
      {children}{" "}
      <Link className="text-link" to="/shop">
        Explore all clothing <Icon name="arrow" width="16" height="16" />
      </Link>
    </p>
  );
}
export default function Home() {
  const { products, offers, loading, offersLoading } = useCatalog();
  const newIn = products.filter((product) => hasTag(product, "new in"));
  const bestsellers = products.filter((product) =>
    hasTag(product, "bestseller"),
  );
  // Prefer six different photographs, while retaining the correct product destination.
  const seen = new Set();
  const lookbook = products
    .filter((product) => {
      if (!product.image || seen.has(product.image)) return false;
      seen.add(product.image);
      return true;
    })
    .slice(0, 6);
  if (lookbook.length < 6)
    lookbook.push(
      ...products
        .filter((product) => product.image && !lookbook.includes(product))
        .slice(0, 6 - lookbook.length),
    );
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <img
          decoding="async"
          className="home-hero-image"
          src={heroImage}
          srcSet="/images/mens/hero-600.webp 600w, /images/mens/hero-1200.webp 1200w, /images/mens/hero-1800.webp 1800w"
          sizes="100vw"
          alt="Man wearing a navy suit and white shirt"
          fetchPriority="high"
          width="2200"
          height="3301"
        />
        <div className="home-hero-content">
          <h1 id="home-title">
            Everyday<span className="orange">.</span>
            <br />
            <em>
              Elevated<span className="orange">.</span>
            </em>
          </h1>
          <p>
            Considered essentials. Effortless style.
            <br />A wardrobe that feels like you.
          </p>
          <div className="hero-actions">
            <Link to="/shop" className="button button-light">
              Shop the collection <Icon name="arrow" width="18" height="18" />
            </Link>
            <a href="#new-in" className="button hero-secondary">
              Shop new in <Icon name="arrow" width="18" height="18" />
            </a>
          </div>
        </div>
        <span className="hero-signature" aria-hidden="true">
          Vastré / The everyday collection
        </span>
      </section>
      <section className="home-trust" aria-label="Shopping benefits">
        <div>
          <Icon name="delivery" />
          <span>
            {DELIVERY_COPY}
            <small>No minimum spend</small>
          </span>
        </div>
        <div>
          <Icon name="returns" />
          <span>
            Easy 7-day returns<small>A little more peace of mind</small>
          </span>
        </div>
        <div>
          <Icon name="shield" />
          <span>
            Secure payments<small>UPI, cards & netbanking</small>
          </span>
        </div>
        <a
          href={wa("Hello Vastré, I have an enquiry.")}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="chat" />
          <span>
            WhatsApp support<small>A real conversation</small>
          </span>
        </a>
      </section>
      <section
        className="home-section home-categories"
        aria-labelledby="categories-title"
        aria-busy={loading}
      >
        <div className="home-heading">
          <h2 id="categories-title">
            Your everyday, by category<span className="orange">.</span>
          </h2>
          <Link to="/shop" className="text-link">
            View all clothing <Icon name="arrow" width="16" height="16" />
          </Link>
        </div>
        {loading ? (
          <>
            <span className="sr-only" role="status">
              Loading categories…
            </span>
            <HomeSkeleton variant="categories" count={cats.length} />
          </>
        ) : (
          <div className="home-category-grid">
            {cats.map((category) => {
              const collection = products.filter(
                (p) => p.category === category,
              );
              const photo =
                collection.find((p) => p.image)?.image ||
                categoryImages[category];
              return (
                <Link
                  key={category}
                  className="home-category"
                  to={`/shop/${encodeURIComponent(category)}`}
                >
                  <div className="home-category-image">
                    <img
                      decoding="async"
                      {...responsiveImage(
                        photo,
                        "(max-width: 600px) 50vw, 20vw",
                      )}
                      alt={`Men’s ${category}`}
                      loading="lazy"
                      width="600"
                      height="800"
                    />
                    <span className="category-arrow">
                      <Icon name="arrow" />
                    </span>
                  </div>
                  <div className="category-caption">
                    <h3>{category}</h3>
                    <span>
                      {collection.length}{" "}
                      {collection.length === 1 ? "product" : "products"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <section
        className="home-section home-new"
        id="new-in"
        aria-labelledby="new-in-title"
        aria-busy={loading}
      >
        <div className="home-heading">
          <div>
            <h2 id="new-in-title">
              New in<span className="orange">.</span>
            </h2>
            <p>The latest additions to your rotation.</p>
          </div>
        </div>
        {loading ? (
          <>
            <span className="sr-only" role="status">
              Loading new arrivals…
            </span>
            <HomeSkeleton />
          </>
        ) : newIn.length ? (
          <ProductCarousel products={newIn} />
        ) : (
          <EmptyCollection>New arrivals are on their way.</EmptyCollection>
        )}
      </section>
      <section
        className="home-section home-bestsellers"
        aria-labelledby="bestsellers-title"
        aria-busy={loading}
      >
        <div className="bestseller-intro">
          <h2 id="bestsellers-title">
            The ones you
            <br />
            <em>come back to.</em>
          </h2>
          <p>Bestsellers. Ready for another day.</p>
          <Link to="/shop" className="text-link">
            Find your everyday favourite{" "}
            <Icon name="arrow" width="16" height="16" />
          </Link>
        </div>
        <div className="bestseller-products">
          {loading ? (
            <>
              <span className="sr-only" role="status">
                Loading bestsellers…
              </span>
              <HomeSkeleton count={2} />
            </>
          ) : bestsellers.length ? (
            <ProductGrid products={bestsellers} />
          ) : (
            <EmptyCollection>
              Your next favourite is in the collection.
            </EmptyCollection>
          )}
        </div>
      </section>
      <section className="home-story" aria-labelledby="story-title">
        <div className="story-image">
          <img
            decoding="async"
            {...responsiveImage(
              image("photo-1607345366928-199ea26cfe3e"),
              "(max-width: 768px) 100vw, 50vw",
            )}
            alt="Man wearing a checked overshirt over a cotton tee"
            loading="lazy"
            width="1000"
            height="1500"
          />
        </div>
        <div className="story-copy">
          <h2 id="story-title">
            Less overthinking.
            <br />
            <em>More living.</em>
          </h2>
          <p>
            The shirt you reach for. The denim that goes with everything. A
            men’s wardrobe built around easy confidence, from the first coffee
            to the last plan.
          </p>
          <p>Find a little more room for your everyday.</p>
          <Link to="/coupons" className="button button-dark">
            Discover your offers <Icon name="arrow" width="18" height="18" />
          </Link>
        </div>
      </section>
      <section
        className="home-offers home-section"
        aria-labelledby="offers-title"
        aria-busy={offersLoading}
      >
        <h2 id="offers-title">
          A good find.
          <br />
          An even better offer.
        </h2>
        <div className="home-offer-list">
          {offersLoading ? (
            <>
              <span className="sr-only" role="status">
                Loading offers…
              </span>
              <HomeSkeleton variant="offers" count={2} />
            </>
          ) : offers.length ? (
            offers.map((offer) => (
              <Link to="/coupons" className="home-offer" key={offer.code}>
                <span className="offer-value">{offer.percent}% off</span>
                <span>
                  {offer.minimum
                    ? `On orders of ${money(offer.minimum)} or more`
                    : "On your order"}
                  <strong>Use {offer.code}</strong>
                </span>
                <Icon name="arrow" />
              </Link>
            ))
          ) : (
            <p>
              There are no active offers right now.{" "}
              <Link className="text-link" to="/shop">
                Explore the collection
              </Link>
            </p>
          )}
        </div>
      </section>
      <section
        className="home-section home-lookbook"
        aria-labelledby="lookbook-title"
        aria-busy={loading}
      >
        <div className="home-heading">
          <div>
            <h2 id="lookbook-title">
              Worn your way<span className="orange">.</span>
            </h2>
            <p>Six frames. Everyday possibilities.</p>
          </div>
          <span className="lookbook-label">The Vastré lookbook</span>
        </div>
        {loading ? (
          <>
            <span className="sr-only" role="status">
              Loading lookbook…
            </span>
            <HomeSkeleton variant="lookbook" count={6} />
          </>
        ) : lookbook.length ? (
          <div className="lookbook-strip">
            {lookbook.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                aria-label={`Shop ${product.name}`}
              >
                <img
                  decoding="async"
                  {...responsiveImage(
                    product.image,
                    "(max-width: 600px) 50vw, 17vw",
                  )}
                  alt={product.alt || product.name}
                  loading="lazy"
                  width="500"
                  height="500"
                />
                <span>
                  <Icon name="arrow" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyCollection>Our next edit is coming soon.</EmptyCollection>
        )}
      </section>
      <section
        className="home-newsletter home-section"
        aria-labelledby="newsletter-title"
      >
        <div>
          <h2 id="newsletter-title">
            Good things.
            <br />
            <em>In your inbox.</em>
          </h2>
          <p>
            New arrivals, considered edits, and offers.
            <br />A little more Vastré, every now and then.
          </p>
        </div>
        <NewsletterForm label="Your email" action="Sign me up" />
      </section>
    </div>
  );
}
