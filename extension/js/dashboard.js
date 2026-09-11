/* FOSFORO — Stasera / Libreria / Impostazioni.
   La grafica è quella del disegno; i dati non sono più finti. */

import { Store } from "../lib/store.js";
import { ask, isExtension } from "../lib/platform.js";
import { proposteLocali } from "../lib/rank.js";
import { idFor } from "../lib/title.js";

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Quel che arriva da fuori — modello, siti, libreria — è testo, mai codice. */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Mette in grassetto i titoli citati, senza far passare markup del modello. */
function conEvidenza(testo, titoli) {
  let out = esc(testo);
  for (const t of (titoli || []).filter(Boolean)) {
    const e = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(e, "g"), (m) => `<b>${m}</b>`);
  }
  return out;
}

function replay(el) {
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}

/* ═══════════════════════════════════ TOAST ═══ */

/* Dice cos'è appena successo e se ne va da solo. Va tolto dal DOM da qui:
   lasciato al solo CSS resterebbe a schermo a bloccare i clic. */
let toastTimer = null;
function flash(messaggio) {
  const t = $("#toast");
  $("#toast-text").textContent = messaggio;
  t.hidden = false;
  replay(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ═══════════════════════════════ STASERA ═══ */

let proposte = [];
let current = 0;
let countTimer = null, countRaf = null;

/* Il numero sale una volta sola, in sincrono con la barra sotto
   (ritardo 700ms, durata 1100ms). Curva out: arriva con enfasi e si ferma. */
function countUp(target) {
  const el = $("#aff-score");
  clearTimeout(countTimer);
  cancelAnimationFrame(countRaf);
  if (reduced()) { el.textContent = target; return; }

  el.textContent = "0";
  countTimer = setTimeout(() => {
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1100);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) countRaf = requestAnimationFrame(step);
    };
    countRaf = requestAnimationFrame(step);
  }, 700);
}

function renderHero(i, animate) {
  const f = proposte[i];
  if (!f) return;
  current = i;

  $("#hero-title").textContent = f.title;
  $("#hero-meta").innerHTML =
    [f.year, f.genre, f.runtime].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join('<span class="sep"></span>') +
    (f.rating ? '<span class="sep"></span><span class="vm">' + esc(f.rating) + "</span>" : "");

  $("#aff-reason").innerHTML = conEvidenza(f.reason, f.highlight);
  $("#aff-chips").innerHTML = (f.chips || []).map((c) => `<span class="g-thin">${esc(c)}</span>`).join("");

  const fill = $("#aff-fill");
  fill.style.width = f.aff + "%";
  replay(fill);

  /* La locandina è la superficie: se non ce n'è una, resta il pozzetto rigato. */
  const img = $("#hero-poster");
  const tex = $("#hero-poster-fallback");
  if (f.poster) { img.src = f.poster; img.hidden = false; tex.hidden = true; }
  else { img.removeAttribute("src"); img.hidden = true; tex.hidden = false; }
  replay($(".poster-panel"));

  if (animate) $$("#hero [data-anim]").forEach(replay);
  countUp(f.aff);
  renderStrip();
  renderStepper();
}

function renderStrip() {
  const altre = proposte.map((f, i) => ({ f, i })).filter((x) => x.i !== current);
  $("#strip-count").textContent = altre.length === 1 ? "Un'altra proposta" : `Altre ${altre.length} proposte`;
  $("#strip").innerHTML = altre.map((x, n) => `
    <button class="strip-card g-pill" type="button" data-index="${x.i}" style="animation-delay: ${560 + n * 80}ms;">
      <span class="strip-thumb" aria-hidden="true"${x.f.poster ? ` style="background-image: url('${esc(x.f.poster)}')"` : ""}></span>
      <span class="strip-text">
        <span class="strip-title">${esc(x.f.title)}</span>
        <span class="strip-aff">
          <span class="strip-match">${x.f.aff}</span>
          <span class="strip-bar"><i style="width: ${x.f.aff}%"></i></span>
        </span>
      </span>
    </button>`).join("");
}

function renderStepper() {
  const ticks = proposte.map((_, i) => `<span class="tick${i === current ? " is-on" : ""}"></span>`).join("");
  const n = String(proposte.length).padStart(2, "0");
  $("#stepper").innerHTML = proposte.length > 1
    ? `<span class="num">01</span>${ticks}<span class="num last">${n}</span>` : "";
}

/** Vuota la scena quando non c'è niente da proporre, invece di mentire. */
function heroVuoto(messaggio) {
  $("#hero-title").textContent = "Niente per stasera";
  $("#hero-meta").innerHTML = "";
  $("#aff-reason").textContent = messaggio;
  $("#aff-chips").innerHTML = "";
  $("#aff-score").textContent = "0";
  $("#aff-fill").style.width = "0%";
  $("#hero-poster").hidden = true;
  $("#hero-poster-fallback").hidden = false;
  $("#strip").innerHTML = "";
  $("#stepper").innerHTML = "";
  $("#strip-count").textContent = "Nessuna proposta";
}

async function caricaProposte({ force = false } = {}) {
  const nota = $("#stasera-nota");
  nota.textContent = force ? "sto pensando…" : "";

  let esito;
  if (isExtension) {
    esito = await ask({ type: "proposals", force });
  } else {
    // Fuori dall'estensione non c'è rete né chiave: si vede la modalità demo.
    esito = { items: proposteLocali(await Store.library()), source: "demo", error: null };
  }

  proposte = (esito && esito.items) || [];
  nota.textContent = esito && esito.error ? esito.error
    : esito && esito.source === "demo" ? "modalità demo · consigli non generati"
    : "";
  nota.classList.toggle("is-warn", Boolean(esito && esito.error));

  if (!proposte.length) {
    heroVuoto("La libreria non ha ancora titoli da proporre. Guarda qualcosa, oppure aggiungilo alla lista.");
    return;
  }
  renderHero(0, true);
}

$("#strip").addEventListener("click", (e) => {
  const card = e.target.closest(".strip-card");
  if (card) renderHero(Number(card.dataset.index), true);
});
$("#rigenera").addEventListener("click", () => caricaProposte({ force: true }));

/* ═══════════════════════════════ LIBRERIA ═══ */

const FILTRI = [
  { label: "Tutti", match: () => true },
  { label: "Amati", match: (t) => t.state === "AMATO" },
  { label: "Piaciuti", match: (t) => t.state === "PIACIUTO" },
  { label: "Da votare", match: (t) => t.state === "DA VOTARE" },
  { label: "In lista", match: (t) => t.state === "IN LISTA" },
  { label: "Serie", match: (t) => t.serie }
];
const CICLO = ["AMATO", "PIACIUTO", "NELLA MEDIA", "NO", "DA VOTARE"];
const dotFor = (s) => s === "AMATO" ? "#f2f4f6" : s === "PIACIUTO" ? "rgba(242,244,246,.7)"
  : s === "IN LISTA" ? "rgba(242,244,246,.45)" : "rgba(242,244,246,.3)";

let filtro = 0;
let libreria = [];

async function caricaLibreria() {
  libreria = await Store.library();
  renderFiltri();
  renderWall();
}

function renderFiltri() {
  $("#lib-filters").innerHTML = FILTRI.map((f, i) => {
    const n = libreria.filter(f.match).length;
    return `<button class="filter g-thin" type="button" data-index="${i}" aria-pressed="${i === filtro}">${f.label} · ${n}</button>`;
  }).join("");
}

function renderWall() {
  const q = $("#lib-search").value.trim().toLowerCase();
  const righe = libreria
    .filter(FILTRI[filtro].match)
    .filter((t) => !q || (t.title + " " + (t.director || "") + " " + (t.year || "")).toLowerCase().includes(q));

  $("#wall").innerHTML = righe.map((t, n) => `
    <button class="wall-card" type="button" data-id="${esc(t.id)}" title="Clic per cambiare il voto" style="animation-delay: ${140 + n * 44}ms;">
      <span class="wall-poster"${t.poster ? ` style="background-image: url('${esc(t.poster)}'); background-size: cover; background-position: center;"` : ""}>
        <span class="wall-state">
          <span class="wall-dot" style="background: ${dotFor(t.state)}"></span>
          <span class="mono">${esc(t.state)}</span>
        </span>
      </span>
      <span class="wall-title">${esc(t.title)}</span>
      <span class="wall-meta">${esc([t.year, t.director || (t.serie ? "Serie" : null)].filter(Boolean).join(" · "))}</span>
    </button>`).join("");

  $("#wall-empty").hidden = righe.length > 0;

  const votati = libreria.filter((t) => ["AMATO", "PIACIUTO", "NELLA MEDIA", "NO"].includes(t.state)).length;
  const lista = libreria.filter((t) => t.state === "IN LISTA").length;
  const daVotare = libreria.filter((t) => t.state === "DA VOTARE").length;
  $("#lib-count").textContent = q || filtro
    ? `${righe.length} ${righe.length === 1 ? "titolo" : "titoli"} su ${libreria.length}`
    : `${libreria.length} titoli · ${votati} votati · ${lista} in lista · ${daVotare} da confermare`;
}

$("#lib-filters").addEventListener("click", (e) => {
  const b = e.target.closest(".filter");
  if (!b) return;
  filtro = Number(b.dataset.index);
  $$("#lib-filters .filter").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderWall();
});
$("#lib-search").addEventListener("input", renderWall);

/* Un clic sulla locandina cambia il voto: il punto e la scritta si aggiornano subito. */
$("#wall").addEventListener("click", async (e) => {
  const card = e.target.closest(".wall-card");
  if (!card) return;
  const t = libreria.find((x) => x.id === card.dataset.id);
  if (!t) return;
  t.state = CICLO[(CICLO.indexOf(t.state) + 1) % CICLO.length];
  await Store.vote(t.id, t.state);
  renderFiltri();
  renderWall();
});

/* ─────────────────────── Aggiungi un titolo a mano ─── */

/* Serve quando Fosforo non ha visto passare un film: un titolo basta,
   anno e tipo si correggono dopo dalla Libreria. */

const scrim = $("#add-scrim");
const campoTitolo = $("#add-title");
const campoAnno = $("#add-year");

function segScelto(gruppo) {
  const b = $('[aria-checked="true"]', $(gruppo));
  return b ? b.dataset : {};
}

function segClick(gruppo) {
  $(gruppo).addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn");
    if (!b) return;
    $$(".seg-btn", $(gruppo)).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  });
}
segClick("#add-kind");
segClick("#add-state");

/* Il bottone resta spento finché non c'è un titolo: non si aggiunge il vuoto. */
function aggiornaAdd() {
  const ok = campoTitolo.value.trim().length > 1;
  $("#add-confirm").disabled = !ok;
  $("#add-hint").textContent = ok
    ? "Entra subito nella libreria, con lo stato che hai scelto."
    : "Basta il titolo: anno e tipo li puoi correggere dopo.";
}

function apriAdd() {
  campoTitolo.value = "";
  campoAnno.value = "";
  $$("#add-kind .seg-btn").forEach((b, i) => b.setAttribute("aria-checked", String(i === 0)));
  $$("#add-state .seg-btn").forEach((b, i) => b.setAttribute("aria-checked", String(i === 0)));
  aggiornaAdd();
  scrim.hidden = false;
  campoTitolo.focus();
}

function chiudiAdd() { scrim.hidden = true; }

$("#add-open").addEventListener("click", apriAdd);
$("#add-close").addEventListener("click", chiudiAdd);
$("#add-cancel").addEventListener("click", chiudiAdd);
/* Il clic sullo sfondo chiude; quello sulla scheda no. */
scrim.addEventListener("click", (e) => { if (e.target === scrim) chiudiAdd(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !scrim.hidden) chiudiAdd();
  if (e.key === "Enter" && !scrim.hidden && !$("#add-confirm").disabled) confermaAdd();
});

campoTitolo.addEventListener("input", aggiornaAdd);
campoAnno.addEventListener("input", function () {
  this.value = this.value.replace(/[^0-9]/g, "").slice(0, 4);
});

async function confermaAdd() {
  const title = campoTitolo.value.trim();
  if (title.length < 2) return;
  const year = campoAnno.value.trim() || null;
  const serie = segScelto("#add-kind").kind === "serie";
  const state = segScelto("#add-state").state || "IN LISTA";

  await Store.remember({
    id: idFor(title, year),
    title, year, serie, state,
    director: null, poster: null, host: null,
    addedAt: Date.now()
  });

  chiudiAdd();
  await caricaLibreria();
  flash(`«${title}» è in libreria.`);
}

$("#add-confirm").addEventListener("click", confermaAdd);

/* ═══════════════════════════ IMPOSTAZIONI ═══ */

const SORGENTI = [
  { id: "site", label: "Dal sito che guardi", note: "Zero richieste esterne. È l'immagine che il sito già mostra." },
  { id: "tmdb", label: "TMDB", note: "Locandine complete e pulite. Una richiesta per titolo." },
  { id: "none", label: "Nessuna", note: "Solo tipografia. La più veloce, e non chiede niente a nessuno." }
];
/* Raggruppati per conseguenza, non per categoria tecnica: quel che riguarda
   la registrazione sta con la registrazione, quel che si vede sta con l'aspetto. */
const INTERRUTTORI_REC = [
  ["autoRecord", "Registra da solo cosa guardo", "Fosforo riconosce film e serie sulle pagine che apri e li mette in attesa di conferma. Niente esce dal tuo Mac."],
  ["overlay", "Pannello sulla pagina video", "La pillola in basso a destra mentre guardi. Spegnendola, registra comunque in silenzio."],
  ["askVote", "Chiedimi il voto quando finisco", "Un voto vale più di dieci titoli senza voto: è quello che rende utili i consigli."]
];
const INTERRUTTORI_ASP = [
  ["english", "Interfaccia in inglese", "Cambia solo le parole dell'interfaccia. I consigli restano nella lingua in cui scrivi le note."],
  ["bigPoster", "Locandina grande su Stasera", "Spenta, la schermata diventa solo tipografia: più veloce, meno cinema."],
  ["motion", "Animazioni", "Le entrate e il numero che sale. Spegnile se preferisci che tutto compaia già fermo."]
];

const switchHTML = (s) => ([id, label, note]) => `
  <div class="toggle-row">
    <div>
      <p class="toggle-label">${label}</p>
      <p class="toggle-note">${note}</p>
    </div>
    <button class="switch" type="button" role="switch" data-id="${id}" aria-pressed="${Boolean(s[id])}" aria-label="${label}">
      <span class="knob"></span>
    </button>
  </div>`;

/** Quel che si vede si applica al body: densità, locandina e movimento. */
function applicaAspetto(s) {
  document.body.dataset.density = String(s.density || 8);
  document.body.dataset.bigPoster = s.bigPoster === false ? "off" : "on";
  document.body.dataset.motion = s.motion === false ? "off" : "on";
}

function renderHosts(hosts) {
  $("#hosts").innerHTML = (hosts || []).map((h) => `
    <span class="host-chip g-thin">${esc(h)}<button class="host-x" type="button" data-host="${esc(h)}" aria-label="Togli ${esc(h)}">✕</button></span>`).join("");
}

async function caricaImpostazioni() {
  const s = await Store.settings();

  $("#api-key").value = s.anthropicKey || "";
  $("#tmdb-key").value = s.tmdbKey || "";
  $("#api-state").textContent = s.anthropicKey ? "Collegata" : "Non collegata";
  $("#api-dot").style.opacity = s.anthropicKey ? "1" : ".3";

  $("#poster-opts").innerHTML = SORGENTI.map((p) => `
    <button class="poster-opt" type="button" role="radio" data-id="${p.id}" aria-checked="${s.posterSource === p.id}">
      <span class="label">${p.label}</span>
      <span class="note">${p.note}</span>
    </button>`).join("");
  $("#tmdb-row").hidden = s.posterSource !== "tmdb";

  $("#toggles-rec").innerHTML = INTERRUTTORI_REC.map(switchHTML(s)).join("");
  $("#toggles-asp").innerHTML = INTERRUTTORI_ASP.map(switchHTML(s)).join("");

  renderHosts(s.mutedHosts);

  const g = $("#guest-toggle");
  g.setAttribute("aria-pressed", String(Boolean(s.guest)));
  g.textContent = s.guest ? "Esci dalla modalità ospite" : "Entra in modalità ospite";

  $$("#density .seg-btn").forEach((b) =>
    b.setAttribute("aria-checked", String(Number(b.dataset.density) === Number(s.density || 8))));

  /* Le cifre sono contate adesso, non scritte a mano nel disegno. */
  const stato = await Store.load();
  const lib = stato.library;
  const voti = lib.filter((t) => t.state !== "DA VOTARE" && t.state !== "IN LISTA").length;
  const kb = new Blob([JSON.stringify(stato)]).size / 1024;
  const peso = kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") : Math.round(kb);
  const unita = kb >= 1024 ? "MEGABYTE" : "KILOBYTE";

  $("#stats").innerHTML = [
    [lib.length, "TITOLI"],
    [voti, "VOTI"],
    [(s.mutedHosts || []).length, "SITI ZITTITI"],
    [peso, unita]
  ].map(([n, l]) => `<div><p class="stat-n">${n}</p><p class="stat-l mono">${l}</p></div>`).join("");

  $("#stats-note").textContent =
    `Tutto sta nel contenitore dell'estensione, sul tuo Mac. Non esiste un nostro server: se cancelli, è cancellato davvero.`;

  $("#data-note").textContent =
    `${lib.length} titoli, ${voti} voti, ${(s.mutedHosts || []).length} siti zittiti. Niente account, niente sincronizzazione, niente server.`;

  applicaAspetto(s);
}

/* ── Le quattro schede ── */
$("#set-menu").addEventListener("click", (e) => {
  const b = e.target.closest(".set-menu-item");
  if (!b) return;
  $$("#set-menu .set-menu-item").forEach((x) => {
    const on = x === b;
    x.classList.toggle("is-on", on);
    x.classList.toggle("g-thin", on);
    if (on) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current");
  });
  $$("#set-col .set-panel").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  $$("[data-anim]", $(`[data-panel="${b.dataset.tab}"]`)).forEach(replay);
});

$("#poster-opts").addEventListener("click", async (e) => {
  const b = e.target.closest(".poster-opt");
  if (!b) return;
  $$("#poster-opts .poster-opt").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  $("#tmdb-row").hidden = b.dataset.id !== "tmdb";
  await Store.patchSettings({ posterSource: b.dataset.id });
});

async function cambiaInterruttore(e) {
  const s = e.target.closest(".switch");
  if (!s) return;
  const on = s.getAttribute("aria-pressed") !== "true";
  s.setAttribute("aria-pressed", String(on));
  applicaAspetto(await Store.patchSettings({ [s.dataset.id]: on }));
}
$("#toggles-rec").addEventListener("click", cambiaInterruttore);
$("#toggles-asp").addEventListener("click", cambiaInterruttore);

/* La densità si vede subito: la libreria è già impaginata quando ci torni. */
$("#density").addEventListener("click", async (e) => {
  const b = e.target.closest(".seg-btn");
  if (!b) return;
  $$("#density .seg-btn").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  applicaAspetto(await Store.patchSettings({ density: Number(b.dataset.density) }));
});

/* ── Siti dove non registro ── */

async function zittisci(host) {
  const s = await Store.settings();
  const hosts = new Set(s.mutedHosts || []);
  if (hosts.has(host)) return false;
  hosts.add(host);
  renderHosts([...hosts]);
  await Store.patchSettings({ mutedHosts: [...hosts] });
  return true;
}

$("#host-add").addEventListener("click", async () => {
  const campo = $("#host-new");
  /* Si accetta anche un indirizzo intero incollato: quel che serve è l'host. */
  const host = campo.value.trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!host || !host.includes(".")) { flash("Serve un indirizzo, tipo raiplay.it."); return; }
  campo.value = "";
  if (await zittisci(host)) flash(`Su ${host} non registro più niente.`);
  else flash(`${host} era già zittito.`);
  await caricaImpostazioni();
});

$("#hosts").addEventListener("click", async (e) => {
  const b = e.target.closest(".host-x");
  if (!b) return;
  const s = await Store.settings();
  await Store.patchSettings({ mutedHosts: (s.mutedHosts || []).filter((h) => h !== b.dataset.host) });
  await caricaImpostazioni();
  flash(`Su ${b.dataset.host} registro di nuovo.`);
});

/* ── Modalità ospite ── */

$("#guest-toggle").addEventListener("click", async function () {
  const on = this.getAttribute("aria-pressed") !== "true";
  await Store.patchSettings({ guest: on });
  this.setAttribute("aria-pressed", String(on));
  this.textContent = on ? "Esci dalla modalità ospite" : "Entra in modalità ospite";
  flash(on ? "Ospite: non registro niente finché non esci." : "Torno a registrare quello che guardi.");
});

$("#api-key").addEventListener("change", async function () {
  await Store.patchSettings({ anthropicKey: this.value.trim() });
  $("#api-state").textContent = this.value.trim() ? "Collegata" : "Non collegata";
  $("#api-dot").style.opacity = this.value.trim() ? "1" : ".3";
});
$("#tmdb-key").addEventListener("change", async function () {
  await Store.patchSettings({ tmdbKey: this.value.trim() });
});

$("#verify-key").addEventListener("click", async function () {
  const b = this;
  b.disabled = true;
  b.textContent = "Verifico…";
  const esito = await ask({ type: "verifyKey" });
  b.textContent = !esito ? "Solo nell'estensione" : esito.ok ? "Funziona" : "Non va";
  $("#api-state").textContent = esito && esito.ok ? "Collegata" : (esito && esito.error) || "Non collegata";
  setTimeout(() => { b.textContent = "Verifica"; b.disabled = false; }, 2400);
});

$("#export").addEventListener("click", async () => {
  const stato = await Store.load();
  const blob = new Blob([JSON.stringify(stato, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fosforo-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("#wipe").addEventListener("click", async () => {
  const lib = await Store.library();
  if (!window.confirm(`Cancellare ${lib.length} titoli e tutte le impostazioni? Non si torna indietro.`)) return;
  await Store.wipe();
  await caricaLibreria();
  await caricaImpostazioni();
  proposte = [];
  heroVuoto("Libreria vuota. Da qui in poi Fosforo impara da quello che guardi.");
});

/* ═════════════════════════ Instradamento ═══ */

const VISTE = ["stasera", "libreria", "impostazioni"];

async function mostra(nome) {
  if (VISTE.indexOf(nome) < 0) nome = "stasera";
  document.body.dataset.view = nome;
  VISTE.forEach((v) => { $("#view-" + v).hidden = v !== nome; });
  window.scrollTo(0, 0);

  /* Ogni ingresso rifà la scena: è il movimento a dire che sei entrato. */
  $$("[data-anim]", $("#view-" + nome)).forEach(replay);

  if (nome === "stasera" && proposte.length) renderHero(current, true);
  if (nome === "libreria") await caricaLibreria();
  if (nome === "impostazioni") await caricaImpostazioni();
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-goto]");
  if (!link) return;
  e.preventDefault();
  location.hash = link.dataset.goto;
});
window.addEventListener("hashchange", () => mostra(location.hash.slice(1)));

/* ═════════════════════════════ Avvio ═══ */

/* Se registri un titolo mentre la dashboard è aperta, la Libreria se ne accorge. */
Store.watch(async () => {
  if (document.body.dataset.view === "libreria") await caricaLibreria();
  $("#titoli-count").textContent = (await Store.library()).length + " titoli";
});

(async function avvio() {
  await Store.load();
  /* L'aspetto si applica prima di disegnare: se no la prima scena parte
     con la densità sbagliata e si riflowa sotto gli occhi. */
  applicaAspetto(await Store.settings());
  await caricaLibreria();
  $("#titoli-count").textContent = libreria.length + " titoli";
  await mostra(location.hash.slice(1) || "stasera");
  await caricaProposte();
})();
