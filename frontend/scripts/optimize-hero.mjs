// Deterministic resizing/encoding of our existing photograph; no image content changes.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const directory = new URL("../public/images/mens/", import.meta.url);
const data = await readFile(
  new URL("photo-1617137968427-85924c800a22.jpg", directory),
);
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  for (const width of [600, 1200, 1800]) {
    const url = await page.evaluate(
      async ({ base64, width }) => {
        const image = new Image();
        image.src = "data:image/jpeg;base64," + base64;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = Math.round((image.height * width) / image.width);
        canvas
          .getContext("2d")
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.82).split(",")[1];
      },
      { base64: data.toString("base64"), width },
    );
    const bytes = Buffer.from(url, "base64");
    await writeFile(new URL(`hero-${width}.webp`, directory), bytes);
    console.log(`hero-${width}.webp: ${bytes.length} bytes`);
  }
} finally {
  await browser.close();
}
