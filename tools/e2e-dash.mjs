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

  /* ── 1. La libreria parte vuota, e lo dice ── */
  await dash.goto(url("libreria"));
  /* Vuoto, `#wall` è una griglia senza contenuto: presente ma non visibile. */
  await dash.locator("#wall").waitFor({ state: "attached", timeout: 15000 });
  await dash.waitForTimeout(900);
  const primaDi = await dash.locator(".wall-card").count();
  ok("all'installazione la libreria è vuota", primaDi === 0, `${primaDi} titoli`);
  ok("e mostra il primo schermo invece di un cartello d'errore",
    await dash.locator("#vuoto").isVisible() && !(await dash.locator("#wall-empty").isVisible()));
  ok("coi tre passi nell'ordine in cui succedono",
    (await dash.locator(".passi li").count()) === 3,
    (await dash.locator(".passi .passo-t").allTextContents()).join(" · "));
  ok("e senza filtri da filtrare su niente", !(await dash.locator("#lib-filters").isVisible()));

  /* ── 2. Aggiungere un titolo a mano ── */

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

  const stato = await dash.locator(".wall-card").first().locator(".wall-badge .mono").textContent();
  ok("prende lo stato che hai scelto", stato.trim() === "Amato", stato.trim());

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
  ok("e riaggiungerlo non cancella il voto che gli hai dato",
    (await dash.locator(".wall-card").first().locator(".wall-badge .mono").textContent()).trim() === "Amato");

  /* ── 3a: due bersagli distinti, nessun ciclo ── */
  const card = dash.locator(".wall-card").first();

  /* A riposo le pastiglie non ci sono: il muro resta pulito. */
  const opacita = (sel) => card.locator(sel).evaluate((el) => getComputedStyle(el).opacity);
  ok("a riposo il voto non è a schermo", (await opacita(".wall-votes")) === "0");
  ok("e nemmeno l'invito ad aprire", (await opacita(".wall-open")) === "0");

  await card.hover();
  await dash.waitForTimeout(400);
  ok("al passaggio salgono le quattro posizioni",
    (await card.locator(".wall-vote").count()) === 4,
    (await card.locator(".wall-vote").allTextContents()).join(", "));
  ok("e compare il bersaglio per aprire", await card.locator(".wall-open").isVisible());
  ok("la posizione attuale è quella premuta",
    (await card.locator('.wall-vote[aria-pressed="true"]').textContent()).trim() === "Amato");

  /* Si vota per nome: niente giro della ruota. */
  await card.locator('.wall-vote[data-voto="NELLA MEDIA"]').click();
  await dash.waitForTimeout(700);
  const suDisco = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    return got.fosforo.library[0].state;
  });
  ok("la pastiglia scrive proprio quel voto", suDisco === "NELLA MEDIA", suDisco);

  const cardDopo = dash.locator(".wall-card").first();
  ok("«Salvato» e la via d'uscita compaiono", await cardDopo.locator(".wall-saved").isVisible());

  /* «Annulla» riporta al voto di prima, non al successivo di una lista. */
  await cardDopo.locator(".wall-undo").click();
  await dash.waitForTimeout(700);
  const tornato = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    return got.fosforo.library[0].state;
  });
  ok("«Annulla» rimette il voto di prima", tornato === "AMATO", tornato);

  /* Il bersaglio per aprire è la banda in alto: a 119px di colonna il pannello
     del voto copre il centro dell'immagine, quindi «tutta la locandina» non è
     geometricamente disponibile. */
  await dash.locator(".wall-card").first().hover();
  await dash.locator(".wall-card").first().locator(".wall-open").click();
  await dash.waitForTimeout(600);
  ok("la locandina apre la scheda del titolo", await dash.locator("#scheda-scrim").isVisible());
  ok("che mostra il titolo giusto",
    (await dash.locator("#scheda-titolo").textContent()).trim() === "Il Conformista");

  const campi = await dash.locator("#scheda-dati dt").allTextContents();
  ok("e i dati che Fosforo ha davvero", campi.length >= 2, campi.join(", "));
  ok("nessun campo vuoto col trattino",
    !(await dash.locator("#scheda-dati dd").allTextContents()).some((v) => !v.trim() || v.trim() === "—"));

  /* Si vota anche da qui, e il muro dietro si aggiorna. */
  await dash.locator('#scheda-voti .voto[data-voto="PIACIUTO"]').click();
  await dash.waitForTimeout(600);
  ok("dalla scheda si vota", (await dash.locator('#scheda-voti .voto[aria-pressed="true"]').textContent()).trim() === "Piaciuto");

  await dash.keyboard.press("Escape");
  await dash.waitForTimeout(400);
  ok("Esc chiude la scheda", !(await dash.locator("#scheda-scrim").isVisible()));
  /* E anche il titolo sotto la locandina apre: due bersagli, nessuna caccia. */
  await dash.locator(".wall-card").first().locator(".wall-title").click();
  await dash.waitForTimeout(500);
  ok("anche il titolo sotto apre la scheda", await dash.locator("#scheda-scrim").isVisible());
  await dash.keyboard.press("Escape");
  await dash.waitForTimeout(300);

  ok("e il muro dietro è aggiornato",
    (await dash.locator(".wall-card").first().locator(".wall-badge .mono").textContent()).trim() === "Piaciuto");
  await dash.waitForTimeout(2600);

  /* ── I tre bottoni di Stasera, che erano solo disegnati ── */

  /* Con un titolo solo non c'è niente da proporre: la modalità demo ragiona su
     quel che hai votato, quindi qui gli si dà una libreria vera da masticare. */
  await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    const s = got.fosforo;
    const righe = [
      ["Il Divo", "2008", "Sorrentino", "AMATO"], ["Salò", "1975", "Pasolini", "AMATO"],
      ["La Grande Bellezza", "2013", "Sorrentino", "AMATO"], ["Gomorra", "2014", null, "AMATO"],
      ["Romanzo Criminale", "2005", "Placido", "PIACIUTO"], ["Il traditore", "2019", "Bellocchio", "PIACIUTO"],
      ["Suburra", "2015", "Sollima", "NELLA MEDIA"], ["Dogman", "2018", "Garrone", "DA VOTARE"],
      ["Nostalgia", "2022", "Martone", "DA VOTARE"], ["Vermiglio", "2024", "Delpero", "DA VOTARE"]
    ];
    s.library = righe.map(([title, year, director, state]) => ({
      id: title.toLowerCase() + "|" + year, title, year, director, serie: false,
      state, poster: null, host: null, addedAt: Date.now(), votedAt: Date.now()
    }));
    s.proposals = null;
    await chrome.storage.local.set({ fosforo: s });
  });

  /* Cambiare solo l'ancora non rigenera le proposte: serve un ricarico vero. */
  await dash.goto(url("stasera"));
  await dash.reload();
  await dash.locator("#hero-title").waitFor({ timeout: 15000 });
  await dash.waitForTimeout(2600);

  const titoloProposto = (await dash.locator("#hero-title").textContent()).trim();

  /* Il testo del «perché» è di lunghezza libera: uno lungo spingeva i bottoni
     sotto il nastro, che sta più in alto nella pila, e non si cliccavano più. */
  await dash.locator("#aff-reason").evaluate((el) => {
    el.textContent = "Frase lunga per far crescere la scheda. ".repeat(30);
  });
  await dash.waitForTimeout(400);

  const raggiungibile = await dash.locator("#hero-salva").evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) return "fuori dallo schermo";
    const sopra = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(sopra) || el === sopra ? "ok" : "coperto da " + (sopra && sopra.className);
  });
  ok("col perché lungo i bottoni restano cliccabili", raggiungibile === "ok", raggiungibile);

  /* «Salva per stasera» mette davvero in lista */
  await dash.locator("#hero-salva").click();
  await dash.waitForTimeout(900);
  const inLista = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    return got.fosforo.library.filter((t) => t.state === "IN LISTA").map((t) => t.title);
  });
  ok("«Salva per stasera» mette il titolo in lista", inLista.includes(titoloProposto), inLista.join(", ") || "niente");

  /* «Non mi interessa» lo toglie e non lo fa più tornare */
  const primaDiScartare = (await dash.locator("#hero-title").textContent()).trim();
  await dash.locator("#hero-scarta").click();
  await dash.waitForTimeout(900);
  const dopoScarto = (await dash.locator("#hero-title").textContent()).trim();
  ok("«Non mi interessa» cambia proposta", dopoScarto !== primaDiScartare, `${primaDiScartare} → ${dopoScarto}`);

  const scartati = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get("fosforo");
    return got.fosforo.declined || [];
  });
  ok("e lo scarto è scritto su disco", scartati.length > 0, scartati.join(", "));

  await dash.reload();
  await dash.waitForTimeout(2400);
  ok("dopo un ricarico non lo ripropone",
    (await dash.locator("#hero-title").textContent()).trim() !== primaDiScartare);

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
