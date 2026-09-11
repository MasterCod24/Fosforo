/* La dashboard caricata davvero in Chromium: le cose che si toccano con le mani.
   `npm run e2e:dash`. L'altra prova (`e2e.mjs`) copre la catena pagina → libreria;
   questa copre quel che si fa dentro la dashboard: aggiungere un titolo a mano,
   le schede delle impostazioni, la densità, i siti zittiti, l'ospite. */

import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const EXT = resolve(process.argv[2] || "extension");
const profilo = mkdtempSync(join(tmpdir(), "fosforo-dash-"));

const passi = [];
const ok = (nome, condizione, dettaglio = "") => {
  passi.push({ nome, esito: Boolean(condizione) });
  console.log((condizione ? "  ok  " : "FALLITO") + "  " + nome + (dettaglio ? "  — " + dettaglio : ""));
};

/* Di norma il Chromium di Playwright; con FOSFORO_CHROME si punta un binario già
   sul disco. Le estensioni vogliono il browser intero: l'headless shell non le carica. */
const context = await chromium.launchPersistentContext(profilo, {
  ...(process.env.FOSFORO_CHROME ? { executablePath: process.env.FOSFORO_CHROME } : { channel: "chromium" }),
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
});

try {
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  const id = new URL(sw.url()).host;
  const url = (h) => `chrome-extension://${id}/pages/dashboard.html#${h}`;

  const dash = await context.newPage();
  const errori = [];
  dash.on("pageerror", (e) => errori.push(String(e)));

  /* ── 1. Aggiungere un titolo a mano ── */
  await dash.goto(url("libreria"));
  await dash.locator("#wall .wall-card").first().waitFor({ timeout: 15000 });
  const primaDi = await dash.locator(".wall-card").count();

  await dash.locator("#add-open").click();
  await dash.locator("#add-scrim .modal").waitFor({ timeout: 5000 });
  ok("il modale si apre dalla barra", await dash.locator("#add-scrim").isVisible());

  ok("senza titolo non si può aggiungere", await dash.locator("#add-confirm").isDisabled());

  await dash.locator("#add-title").fill("Il Conformista");
  await dash.locator("#add-year").fill("19a70xx");
  const anno = await dash.locator("#add-year").inputValue();
  ok("l'anno accetta solo quattro cifre", anno === "1970", anno);

  ok("col titolo il bottone si accende", await dash.locator("#add-confirm").isEnabled());

  await dash.locator('#add-state .seg-btn[data-state="AMATO"]').click();
  await dash.locator("#add-confirm").click();
  await dash.waitForTimeout(800);

  ok("il modale si chiude dopo l'aggiunta", !(await dash.locator("#add-scrim").isVisible()));

  const dopo = await dash.locator(".wall-card").count();
  ok("il titolo è entrato in libreria", dopo === primaDi + 1, `${primaDi} → ${dopo}`);

  const primo = await dash.locator(".wall-card").first().locator(".wall-title").textContent();
  ok("il titolo aggiunto sta in cima", primo.trim() === "Il Conformista", primo.trim());

  const stato = await dash.locator(".wall-card").first().locator(".wall-state .mono").textContent();
  ok("prende lo stato che hai scelto", stato.trim() === "AMATO", stato.trim());

  ok("il toast dice cos'è successo", await dash.locator("#toast").isVisible());
  await dash.waitForTimeout(2800);
  ok("il toast se ne va da solo", !(await dash.locator("#toast").isVisible()));

  /* Lo stesso titolo due volte non fa due righe: l'id è lo stesso. */
  await dash.locator("#add-open").click();
  await dash.locator("#add-title").fill("Il Conformista");
  await dash.locator("#add-year").fill("1970");
  await dash.locator("#add-confirm").click();
  await dash.waitForTimeout(700);
  ok("lo stesso titolo non entra due volte", (await dash.locator(".wall-card").count()) === dopo);

  /* ── 2. Le schede delle impostazioni ── */
  await dash.goto(url("impostazioni"));
  await dash.locator("#set-menu").waitFor({ timeout: 10000 });

  ok("all'apertura si vede solo Consigli",
    await dash.locator('[data-panel="consigli"]').isVisible() &&
    !(await dash.locator('[data-panel="aspetto"]').isVisible()));

  await dash.locator('.set-menu-item[data-tab="registrazione"]').click();
  ok("la scheda Registrazione si apre",
    await dash.locator('[data-panel="registrazione"]').isVisible() &&
    !(await dash.locator('[data-panel="consigli"]').isVisible()));

  const interruttori = await dash.locator("#toggles-rec .switch").count();
  ok("Registrazione ha i suoi tre interruttori", interruttori === 3, String(interruttori));

  /* ── 3. Siti dove non registro ── */
  await dash.locator("#host-new").fill("https://www.raiplay.it/qualcosa");
  await dash.locator("#host-add").click();
  await dash.waitForTimeout(600);
  const chip = await dash.locator(".host-chip").allTextContents();
  ok("l'indirizzo incollato diventa un host", chip.some((c) => c.includes("raiplay.it")), chip.join(", "));

  const salvati = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    return got.fosforo.settings.mutedHosts;
  });
  ok("il sito zittito è finito su disco", salvati.includes("raiplay.it"), salvati.join(", "));

  await dash.locator('.host-x[data-host="raiplay.it"]').click();
  await dash.waitForTimeout(600);
  ok("e si toglie", (await dash.locator(".host-chip").count()) === 0);

  /* ── 4. Modalità ospite ── */
  await dash.locator("#guest-toggle").click();
  await dash.waitForTimeout(500);
  const guest = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    return got.fosforo.settings.guest;
  });
  ok("l'ospite è acceso davvero, non solo a schermo", guest === true);
  ok("e il bottone lo dice", (await dash.locator("#guest-toggle").textContent()).includes("Esci"));
  await dash.locator("#guest-toggle").click();
  await dash.waitForTimeout(400);

  /* ── 5. Aspetto: densità e movimento ── */
  await dash.locator('.set-menu-item[data-tab="aspetto"]').click();
  await dash.locator('#density .seg-btn[data-density="10"]').click();
  await dash.waitForTimeout(500);
  ok("la densità va sul body", (await dash.locator("body").getAttribute("data-density")) === "10");

  await dash.goto(url("libreria"));
  await dash.locator("#wall .wall-card").first().waitFor({ timeout: 10000 });
  const colonna = await dash.locator("#wall").evaluate((el) => getComputedStyle(el).getPropertyValue("--col-min").trim());
  ok("e la libreria la usa davvero", colonna === "92px", colonna);

  await dash.goto(url("impostazioni"));
  await dash.locator('.set-menu-item[data-tab="aspetto"]').click();
  await dash.locator('#toggles-asp .switch[data-id="motion"]').click();
  await dash.waitForTimeout(500);
  ok("le animazioni si spengono", (await dash.locator("body").getAttribute("data-motion")) === "off");

  const ferma = await dash.locator(".set-card").first().evaluate((el) => getComputedStyle(el).animationName);
  ok("spente, non resta nessuna animazione attiva", ferma === "none", ferma);

  /* ── 6. Le scelte resistono alla riapertura ── */
  await dash.goto(url("stasera"));
  await dash.waitForTimeout(800);
  ok("il movimento spento vale anche sulle altre viste",
    (await dash.locator("body").getAttribute("data-motion")) === "off");

  ok("nessun errore JavaScript in tutta la sessione", errori.length === 0, errori[0] || "");

  const falliti = passi.filter((p) => !p.esito).length;
  console.log(`\n${passi.length - falliti}/${passi.length} passi a posto.`);
  process.exitCode = falliti ? 1 : 0;
} finally {
  await context.close();
  rmSync(profilo, { recursive: true, force: true });
}
