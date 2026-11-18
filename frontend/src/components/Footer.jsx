import { useState } from "react";
import { Link } from "react-router-dom";
import { cats, wa } from "../utils/store";
import { HELP_TOPICS } from "../config/storefront";
import Drawer from "./Drawer";
import Icon from "./Icon";
import NewsletterForm from "./NewsletterForm";
export default function Footer() {
  const [topic, setTopic] = useState(null);
  const help = HELP_TOPICS[topic];
  function toTop(e) {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    document.getElementById("top")?.focus({ preventScroll: true });
  }
  return (
    <>
      <footer className="site-footer">
        <div className="footer-brand">
          <Link to="/" className="wordmark">
            Vastré<span>.</span>
          </Link>
          <p>
            Men’s essentials.
            <br />
            Everyday, elevated.
          </p>
          <a
            href={wa("Hello Vastré, I have an enquiry.")}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp us <Icon name="arrow" width="16" height="16" />
          </a>
          <a href="tel:+917019023964">+91 7019023964</a>
        </div>
        <nav className="footer-column" aria-label="Shop">
          <h2>Shop</h2>
          <Link to="/shop">All clothing</Link>
          {cats.map((c) => (
            <Link key={c} to={`/shop/${encodeURIComponent(c)}`}>
              {c}
            </Link>
          ))}
          <Link to="/coupons">Offers & coupons</Link>
        </nav>
        <nav className="footer-column" aria-label="Help">
          <h2>Help</h2>
          {Object.entries(HELP_TOPICS).map(([key, item]) => (
            <button
              className="text-link"
              key={key}
              onClick={() => setTopic(key)}
            >
              {item.title}
            </button>
          ))}
          <Link to="/account?tab=orders">Your orders</Link>
        </nav>
        <div className="footer-newsletter">
          <h2>
            A little more Vastré<span className="orange">.</span>
          </h2>
          <p>New arrivals, considered edits, and offers.</p>
          <NewsletterForm />
          <div className="payment-hints" aria-label="Payment methods">
            <span className="badge">UPI</span>
            <span className="badge">Cards</span>
            <span className="badge">Netbanking</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Vastré · Made for India</span>
          <a href="#top" onClick={toTop}>
            Back to top <Icon name="up" width="16" height="16" />
          </a>
        </div>
      </footer>
      <Drawer
        open={Boolean(help)}
        onClose={() => setTopic(null)}
        title={help?.title || "Help"}
      >
        {help && (
          <>
            <p>{help.copy}</p>
            <a
              className="button button-dark"
              href={wa(
                `Hello Vastré, I need help with ${help.title.toLowerCase()}.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              Ask on WhatsApp <Icon name="arrow" />
            </a>
            <p>
              <a className="text-link" href="tel:+917019023964">
                Call +91 7019023964
              </a>
            </p>
          </>
        )}
      </Drawer>
    </>
  );
}
