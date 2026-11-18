import Icon from "../Icon";
export default function CheckoutSteps({ step }) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="checkout-steps">
        {["Bag", "Address", "Payment"].map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={index < step ? "complete" : ""}
          >
            <span aria-hidden="true">
              {index < step ? (
                <Icon name="check" width="16" height="16" />
              ) : (
                index + 1
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
