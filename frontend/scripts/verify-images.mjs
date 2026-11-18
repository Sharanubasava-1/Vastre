// Decode every catalogue original and generated candidate without a database.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const products = JSON.parse(
  await readFile(
    new URL("../../backend/catalogue.json", import.meta.url),
    "utf8",
  ),
);
const originals = [...new Set(products.flatMap((p) => p.images))];
const out = new URL("../test-results-stage2/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const rows = [];
try {
  const page = await browser.newPage();
  for (const original of originals) {
    for (const file of [
      original,
      ...[160, 600, 1200].map((w) =>
        original.replace(/\/([^/]+)\.jpg$/, `/optimized/$1-${w}.webp`),
      ),
    ]) {
      const data = await readFile(new URL("../public" + file, import.meta.url));
      const dimensions = await page.evaluate(
        async ({ data, webp }) => {
          const image = new Image();
          image.src = `data:image/${webp ? "webp" : "jpeg"};base64,${data}`;
          await image.decode();
          return { width: image.naturalWidth, height: image.naturalHeight };
        },
        { data: data.toString("base64"), webp: file.endsWith(".webp") },
      );
      if (!dimensions.width || !dimensions.height)
        throw Error("Image failed to decode: " + file);
      rows.push({ file, bytes: data.length, ...dimensions });
    }
  }
  await writeFile(
    new URL("image-verification.json", out),
    JSON.stringify(rows, null, 2),
  );
  console.log(
    `${originals.length} originals and ${rows.length - originals.length} WebP candidates decoded successfully.`,
  );
} finally {
  await browser.close();
}
