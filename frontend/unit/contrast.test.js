import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(
  new URL("../src/styles/tokens.css", import.meta.url),
  "utf8",
);
const parse = (source) =>
  Object.fromEntries(
    [...source.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(
      ([, key, value]) => [key, value],
    ),
  );
const light = parse(css.split("@media")[0]);
const dark = { ...light, ...parse(css.split(':root[data-theme="dark"]')[1]) };
function luminance(hex) {
  return hex
    .slice(1)
    .match(/../g)
    .map((pair) => parseInt(pair, 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    .reduce((sum, n, index) => sum + n * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [theme, tokens] of Object.entries({ light, dark }))
  test(`${theme}: semantic text and controls meet AA contrast`, () => {
    for (const [foreground, background, min] of [
      ["ink", "paper", 4.5],
      ["muted", "paper", 4.5],
      ["muted", "white", 4.5],
      ["accent-text", "paper", 4.5],
      ["on-accent", "orange", 4.5],
      ["success", "success-surface", 4.5],
      ["error", "error-surface", 4.5],
      ["info", "info-surface", 4.5],
      ["control-border", "white", 3],
      ["control-border", "paper", 3],
      ["focus-color", "paper", 3],
      ["focus-color", "surface-subtle", 3],
      ["muted", "surface-subtle", 4.5],
    ]) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      assert.ok(
        ratio >= min,
        `${foreground}/${background}: ${ratio.toFixed(2)} < ${min}`,
      );
    }
  });
