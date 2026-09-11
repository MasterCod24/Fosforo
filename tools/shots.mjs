/* Le cinque superfici, fotografate dal codice vero a 1160px.
   Serve a controllare che il lavoro sotto non abbia spostato niente sopra.
   La locandina qui è una fixture locale — l'estensione vera la risolve da sola. */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const RADICE = resolve("extension");
const PORTA = 8792;
const FUORI = "tools/shots";
mkdirSync(FUORI, { recursive: true });

const TIPI = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp" };

const server = createServer((req, res) => {
  const percorso = decodeURIComponent(req.url.split("?")[0]);
  const file = percorso.startsWith("/fixtures/")
    ? resolve("tools" + percorso)
    : join(RADICE, percorso);
  try {
    const corpo = readFileSync(file);
    res.writeHead(200, { "content-type": TIPI[extname(file)] || "application/octet-stream" });
    res.end(corpo);
  } catch {
    res.writeHead(404).end("non c'è");
  }
}).listen(PORTA);

const base = `http://localhost:${PORTA}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1160, height: 725 }, deviceScaleFactor: 1 });

const errori = [];
page.on("pageerror", (e) => errori.push(e.message));
page.on("console", (m) => m.type() === "error" && errori.push(m.text()));

/* Locandine già risolte, come le avrebbe messe il risolutore: le mettiamo sui
   titoli che finiranno fra le proposte, così si vede la locandina a tutta altezza. */
await page.goto(base + "/pages/dashboard.html");
await page.waitForTimeout(900);              // lasciamo finire l'avvio, se no ci scrive sopra
await page.evaluate((url) => {
  const stato = JSON.parse(localStorage.getItem("fosforo"));
  for (const t of stato.library) {
    if (t.state === "IN LISTA" || t.state === "DA VOTARE") t.poster = url;
  }
  stato.proposals = null;                     // si rifanno con le locandine dentro
  localStorage.setItem("fosforo", JSON.stringify(stato));
}, base + "/fixtures/poster-demo.webp");

const scatti = [
  ["2a-stasera", "/pages/dashboard.html#stasera", 725, 2600],
  ["2b-libreria", "/pages/dashboard.html#libreria", 725, 1500],
  ["2c-impostazioni", "/pages/dashboard.html#impostazioni", 725, 1400],
  ["2d-overlay", "/pages/overlay-demo.html", 725, 1400],
  ["2e-marchio", "/pages/brand.html", 470, 1000]
];

for (const [nome, percorso, altezza, attesa] of scatti) {
  await page.setViewportSize({ width: 1160, height: altezza });
  await page.goto(base + percorso);
  await page.reload();          // con la sola ancora il documento non si ricarica
  await page.waitForTimeout(attesa);
  await page.screenshot({ path: `${FUORI}/${nome}.png` });
  console.log(nome + ".png");
}

await browser.close();
server.close();
if (errori.length) { console.error("\nerrori in pagina:\n" + errori.join("\n")); process.exit(1); }
console.log("\nnessun errore in pagina");
