import { useId } from "react";
import { useToast } from "../context/ToastContext";
import Button from "./Button";
import Icon from "./Icon";
export default function NewsletterForm({
  label = "Email address",
  action = "Join newsletter",
}) {
  const id = useId(),
    { notify } = useToast();
  function subscribe(event) {
    event.preventDefault();
    event.currentTarget.reset();
    notify(
      "Thanks for your interest! Newsletter signup is a preview; your email has not been saved.",
      "success",
    );
  }
  return (
    <form onSubmit={subscribe}>
      <label htmlFor={id}>{label}</label>
      <div className="newsletter-field">
        <input
          id={id}
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Button type="submit" aria-label={action}>
          {action === "Join newsletter" ? (
            <Icon name="arrow" />
          ) : (
            <>
              {action}
              <Icon name="arrow" />
            </>
          )}
        </Button>
      </div>
      <small className="muted">Preview only. No email is stored or sent.</small>
    </form>
  );
}
