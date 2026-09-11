/* FOSFORO — Stasera / Libreria / Impostazioni.
   La grafica è quella del disegno; i dati non sono più finti. */

import { Store } from "../lib/store.js";
import { ask, isExtension } from "../lib/platform.js";
import { proposteLocali } from "../lib/rank.js";

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

/* ═══════════════════════════ IMPOSTAZIONI ═══ */

const SORGENTI = [
  { id: "site", label: "Dal sito che guardi", note: "Zero richieste esterne. È l'immagine che il sito già mostra." },
  { id: "tmdb", label: "TMDB", note: "Locandine complete e pulite. Una richiesta per titolo." },
  { id: "none", label: "Nessuna", note: "Solo tipografia. La più veloce, e non chiede niente a nessuno." }
];
const INTERRUTTORI = [
  ["autoRecord", "Registra da solo cosa guardo", "Fosforo riconosce film e serie sulle pagine che apri e li mette in attesa di conferma. Niente esce dal tuo Mac."],
  ["overlay", "Pannello sulla pagina video", "La pillola in basso a destra mentre guardi. Spegnendola, registra comunque in silenzio."],
  ["askVote", "Chiedimi il voto quando finisco", "Un voto vale più di dieci titoli senza voto: è quello che rende utili i consigli."],
  ["english", "Interfaccia in inglese", "Cambia solo le parole dell'interfaccia. I consigli restano nella lingua in cui scrivi le note."]
];

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

  $("#toggles").innerHTML = INTERRUTTORI.map(([id, label, note]) => `
    <div class="toggle-row">
      <div>
        <p class="toggle-label">${label}</p>
        <p class="toggle-note">${note}</p>
      </div>
      <button class="switch" type="button" role="switch" data-id="${id}" aria-pressed="${Boolean(s[id])}" aria-label="${label}">
        <span class="knob"></span>
      </button>
    </div>`).join("");

  const lib = await Store.library();
  const voti = lib.filter((t) => t.state !== "DA VOTARE" && t.state !== "IN LISTA").length;
  $("#data-note").textContent =
    `${lib.length} titoli, ${voti} voti, ${(s.mutedHosts || []).length} siti zittiti. Niente account, niente sincronizzazione, niente server.`;
}

$("#poster-opts").addEventListener("click", async (e) => {
  const b = e.target.closest(".poster-opt");
  if (!b) return;
  $$("#poster-opts .poster-opt").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  $("#tmdb-row").hidden = b.dataset.id !== "tmdb";
  await Store.patchSettings({ posterSource: b.dataset.id });
});

$("#toggles").addEventListener("click", async (e) => {
  const s = e.target.closest(".switch");
  if (!s) return;
  const on = s.getAttribute("aria-pressed") !== "true";
  s.setAttribute("aria-pressed", String(on));
  await Store.patchSettings({ [s.dataset.id]: on });
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
  await caricaLibreria();
  $("#titoli-count").textContent = libreria.length + " titoli";
  await mostra(location.hash.slice(1) || "stasera");
  await caricaProposte();
})();
