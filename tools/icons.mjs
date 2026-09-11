/* Le icone nascono dal marchio, non da un disegno a parte:
   due cerchi concentrici, interno al 29% del totale, su grafite.
   `node tools/icons.mjs` le rigenera tutte. */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const MISURE = [16, 32, 48, 128, 512];
mkdirSync("extension/icons", { recursive: true });

const pagina = (px) => `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  .icona {
    width: ${px}px; height: ${px}px;
    border-radius: ${Math.max(2, Math.round(px * 0.22))}px;
    background: linear-gradient(158deg, #2b3034, #0e1012 62%);
    display: flex; align-items: center; justify-content: center;
  }
  /* Il disco pieno col centro vuoto: l'unica forma del marchio. */
  .marchio { position: relative; width: ${Math.round(px * 0.5)}px; height: ${Math.round(px * 0.5)}px; }
  .marchio::before, .marchio::after { content: ""; position: absolute; border-radius: 50%; }
  .marchio::before { inset: 0; background: #f2f4f6; }
  .marchio::after { inset: 29%; background: #0e1012; }
</style>
<div class="icona"><span class="marchio"></span></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });

for (const px of MISURE) {
  await page.setContent(pagina(px));
  await page.locator(".icona").screenshot({
    path: `extension/icons/icon-${px}.png`,
    omitBackground: true
  });
  console.log(`icon-${px}.png`);
}

await browser.close();
