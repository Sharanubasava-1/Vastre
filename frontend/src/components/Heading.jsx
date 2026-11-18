import { Children, Fragment } from "react";
// Keep heading copy intact while applying the brand accent to its final full stop.
export default function Heading({ as: Tag = "h1", children, ...props }) {
  const parts = Children.toArray(children);
  return (
    <Tag {...props}>
      {parts.map((part, index) =>
        index === parts.length - 1 &&
        typeof part === "string" &&
        part.endsWith(".") ? (
          <Fragment key={index}>
            {part.slice(0, -1)}
            <span className="orange">.</span>
          </Fragment>
        ) : (
          part
        ),
      )}
    </Tag>
  );
}
