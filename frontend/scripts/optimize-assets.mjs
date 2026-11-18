// Re-encode existing licensed assets only. Product/API data and image content
// are unchanged; originals and OFL notices remain available for reproduction.
import { chromium } from "@playwright/test";
import wawoff2 from "wawoff2";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
const fonts = new URL("../public/fonts/", import.meta.url);
let before = 0,
  after = 0;
for (const file of await readdir(fonts)) {
  if (!file.endsWith(".ttf")) continue;
  const input = await readFile(new URL(file, fonts));
  const output = await wawoff2.compress(input);
  await writeFile(new URL(file.replace(/\.ttf$/, ".woff2"), fonts), output);
  before += input.length;
  after += output.length;
}
console.log(`Fonts: ${before} -> ${after} bytes`);
const images = new URL("../public/images/mens/", import.meta.url);
const optimized = new URL("optimized/", images);
await mkdir(optimized, { recursive: true });
const names = (await readdir(images))
  .filter((file) => file.endsWith(".jpg") && !file.includes("1617137968427"))
  .sort();
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  let bytes = 0;
  for (const file of names) {
    const source = await readFile(new URL(file, images));
    for (const width of [160, 600, 1200]) {
      const base64 = await page.evaluate(
        async ({ source, width }) => {
          const image = new Image();
          image.src = "data:image/jpeg;base64," + source;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(width, image.naturalWidth);
          canvas.height = Math.round(
            (image.naturalHeight * canvas.width) / image.naturalWidth,
          );
          canvas
            .getContext("2d")
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/webp", 0.82).split(",")[1];
        },
        { source: source.toString("base64"), width },
      );
      const output = Buffer.from(base64, "base64");
      bytes += output.length;
      await writeFile(
        new URL(file.replace(/\.jpg$/, `-${width}.webp`), optimized),
        output,
      );
    }
  }
  await writeFile(
    new URL("../src/config/imageAssets.js", import.meta.url),
    "// Existing bundled photographs with generated responsive encodings.\nexport default " +
      JSON.stringify(
        names.map((file) => file.replace(/\.jpg$/, "")),
        null,
        2,
      ) +
      ";\n",
  );
  console.log(
    `${names.length} existing photographs / ${names.length * 3} variants: ${bytes} bytes`,
  );
} finally {
  await browser.close();
}
