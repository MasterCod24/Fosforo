/* L'estensione caricata davvero in Chromium, su una pagina video finta servita in locale.
   Serve a provare offline la catena intera: riconoscimento → overlay → conferma →
   libreria, con la locandina presa dalla pagina stessa. `npm run e2e`. */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/* Di norma prova i sorgenti; con un argomento prova un'altra cartella —
   serve a verificare che il pacchetto scaricabile sia identico. */
const EXT = resolve(process.argv[2] || "extension");
const PORTA = 8791;

/* Una pagina che si dichiara come farebbe un sito vero: JSON-LD, og:image, un <video>. */
const LOCANDINA = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const PAGINA = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Il Conformista - Guarda streaming | FintoPlay</title>
<meta property="og:type" content="video.movie">
<meta property="og:title" content="Il Conformista">
<meta property="og:image" content="http://localhost:${PORTA}/locandina.png">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Movie","name":"Il Conformista",
 "datePublished":"1970-10-22","genre":"Drammatico",
 "director":{"@type":"Person","name":"Bernardo Bertolucci"},
 "image":"http://localhost:${PORTA}/locandina.png"}
</script>
</head><body style="background:#101214;margin:0">
<video width="640" height="360" muted></video>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url.startsWith("/locandina.png")) {
    res.writeHead(200, { "content-type": "image/png" });
    res.end(LOCANDINA);
  } else {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGINA);
  }
}).listen(PORTA);

const profilo = mkdtempSync(join(tmpdir(), "fosforo-"));
const passi = [];
const ok = (nome, condizione, dettaglio = "") => {
  passi.push({ nome, esito: Boolean(condizione), dettaglio });
  console.log((condizione ? "  ok  " : "FALLITO") + "  " + nome + (dettaglio ? "  — " + dettaglio : ""));
};

const context = await chromium.launchPersistentContext(profilo, {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
});

try {
  /* 1. Il service worker si sveglia da solo */
  let sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  const id = new URL(sw.url()).host;
  ok("il service worker parte", Boolean(id), "da " + EXT.replace(process.cwd() + "/", ""));

  /* 2. La pagina video viene riconosciuta e l'overlay si monta */
  const pagina = await context.newPage();
  await pagina.goto(`http://localhost:${PORTA}/guarda`);
  // La radice dell'overlay è un box senza dimensioni: quel che si vede è la scheda.
  await pagina.locator("#fosforo-overlay .fsf-card").waitFor({ timeout: 15000 });
  const titolo = await pagina.locator("#fosforo-overlay .fsf-title").textContent();
  ok("riconosce il titolo dalla pagina", titolo.trim() === "Il Conformista", titolo.trim());

  const meta = await pagina.locator("#fosforo-overlay .fsf-meta").textContent();
  ok("legge anno e genere dal JSON-LD", /1970/.test(meta) && /Drammatico/.test(meta), meta.trim());

  const sfondo = await pagina.locator("#fosforo-overlay .fsf-thumb").evaluate((el) => getComputedStyle(el).backgroundImage);
  ok("la locandina arriva dalla pagina, senza chiamare nessuno", sfondo.includes("locandina.png"));

  /* 3. «È giusto» lo tiene davvero */
  await pagina.locator("#fsf-ok").click();
  await pagina.waitForTimeout(600);

  /* 4. La dashboard lo trova in libreria */
  const dash = await context.newPage();
  await dash.goto(`chrome-extension://${id}/pages/dashboard.html#libreria`);
  await dash.waitForTimeout(1200);
  const titoli = await dash.locator(".wall-title").allTextContents();
  ok("il titolo confermato è in libreria", titoli.includes("Il Conformista"), titoli.slice(0, 3).join(", ") + "…");

  const card = dash.locator('.wall-card:has-text("Il Conformista")').first();
  const poster = await card.locator(".wall-poster").evaluate((el) => el.getAttribute("style") || "");
  ok("in libreria si vede la locandina della pagina", poster.includes("locandina.png"));

  const conteggio = await dash.locator("#lib-count").textContent();
  ok("i conteggi sono calcolati, non scritti a mano", /^\d+ titoli/.test(conteggio.trim()), conteggio.trim());

  /* 5. Stasera propone, in modalità demo (nessuna chiave) */
  await dash.goto(`chrome-extension://${id}/pages/dashboard.html#stasera`);
  await dash.waitForTimeout(2600);
  const nota = await dash.locator("#stasera-nota").textContent();
  const punteggio = await dash.locator("#aff-score").textContent();
  ok("senza chiave dichiara la modalità demo", /demo/.test(nota), nota.trim());
  ok("l'affinità è arrivata al suo valore", Number(punteggio) > 0, punteggio);

  /* 6. Un sito zittito non fa più montare niente */
  const pagina2 = await context.newPage();
  await pagina2.goto(`http://localhost:${PORTA}/altro`);
  await pagina2.waitForTimeout(1500);
  const montato = await pagina2.locator("#fosforo-overlay .fsf-card").count();
  ok("un titolo già in libreria non viene riproposto", montato === 0);

  /* 7. Quel che è stato salvato resiste alla chiusura del browser */
  await context.close();
  const context2 = await chromium.launchPersistentContext(profilo, {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  const sw2 = context2.serviceWorkers()[0] || await context2.waitForEvent("serviceworker", { timeout: 15000 });
  const id2 = new URL(sw2.url()).host;
  const dash2 = await context2.newPage();
  await dash2.goto(`chrome-extension://${id2}/pages/dashboard.html#libreria`);
  await dash2.waitForTimeout(1200);
  const dopo = await dash2.locator(".wall-title").allTextContents();
  ok("dopo un riavvio del browser è ancora lì", dopo.includes("Il Conformista"));
  await context2.close();
} finally {
  server.close();
  rmSync(profilo, { recursive: true, force: true });
}

const falliti = passi.filter((p) => !p.esito);
console.log(`\n${passi.length - falliti.length}/${passi.length} passi superati`);
process.exit(falliti.length ? 1 : 0);
