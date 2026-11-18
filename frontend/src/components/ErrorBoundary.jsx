import Heading from "./Heading";
import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    console.error("Storefront error", error, info);
  }
  render() {
    return this.state.failed ? (
      <main className="section-shell" role="alert">
        <Heading>Something went wrong.</Heading>
        <p>Please reload the page to try again.</p>
        <button
          className="button button-dark"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
