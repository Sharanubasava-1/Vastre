import { productFacts } from "../../utils/productFacts";

export default function ProductFacts({ product }) {
  const { fit, colors, rating, reviews } = productFacts(product);
  return (
    <>
      {rating !== null && (
        <p className="pdp-rating">
          Rated {rating} / 5{reviews !== null && ` (${reviews} reviews)`}
        </p>
      )}
      {fit && (
        <p className="pdp-fit">
          <strong>Fit:</strong> {fit}
        </p>
      )}
      {colors.length > 0 && (
        <div className="pdp-colors">
          <p>
            <strong>Colour palette</strong>
          </p>
          {/* Display-only palette references. Colour is deliberately absent from
          cart/quote/order payloads; these are never selectable controls. */}
          <ul>
            {colors.map((color) => (
              <li key={color.name + color.hex}>
                <span
                  className="color-swatch"
                  style={{ "--swatch-color": color.hex }}
                  aria-hidden="true"
                />
                {color.name}
              </li>
            ))}
          </ul>
          <p className="muted">
            Reference only. Colour is not selected or saved with your order.
          </p>
        </div>
      )}
    </>
  );
}
