import { useState } from "react";
import { estimateDelivery } from "../../services/delivery";
export default function DeliveryChecker() {
  const [pin, setPin] = useState(""),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  function check(e) {
    e.preventDefault();
    try {
      setResult(estimateDelivery(pin.trim()));
      setError("");
    } catch (e) {
      setResult(null);
      setError(e.message);
    }
  }
  return (
    <form className="delivery-checker" onSubmit={check} noValidate>
      <label htmlFor="delivery-pin">
        Delivery estimate <span className="muted">· UI preview</span>
      </label>
      <div className="delivery-input">
        <input
          id="delivery-pin"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Enter PIN code"
          value={pin}
          aria-invalid={!!error}
          aria-describedby="delivery-feedback"
          onChange={(e) => {
            setPin(e.target.value);
            setResult(null);
            setError("");
          }}
        />
        <button className="button button-light" type="submit">
          Check
        </button>
      </div>
      <p
        id="delivery-feedback"
        className={error ? "pdp-error" : "muted"}
        role="status"
      >
        {error ||
          (result ? `Demo estimate: ${result.from}–${result.to}. ` : "")}
        {!error &&
          "Preview only. Serviceability and delivery dates have not been checked."}
      </p>
    </form>
  );
}
