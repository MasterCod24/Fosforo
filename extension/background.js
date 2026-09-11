/* Il service worker: l'unico che parla con la rete e l'unico che vede le chiavi.
   Tutto il resto — pagina guardata, dashboard, overlay — gli chiede le cose. */

import { api } from "./lib/platform.js";
import { Store } from "./lib/store.js";
import { cleanPageTitle, yearFrom, idFor } from "./lib/title.js";
import { posterFor } from "./lib/poster.js";
import { proposte, verificaChiave } from "./lib/claude.js";

const VOTI = { "Amato": "AMATO", "Piaciuto": "PIACIUTO", "Nella media": "NELLA MEDIA", "No": "NO" };

/* ── Cosa stai guardando ─────────────────────────────────────── */

async function visto(seen) {
  const settings = await Store.settings();
  if (settings.guest) return { mount: false };          // ospite: non guarda e non compare
  if (!settings.autoRecord) return { mount: false };
  if ((settings.mutedHosts || []).includes(seen.host)) return { mount: false };

  const title = cleanPageTitle(seen.title, seen.host) || cleanPageTitle(seen.pageTitle, seen.host);
  if (!title || title.length < 2) return { mount: false };

  const year = seen.year || yearFrom(seen.rawTitle, seen.pageTitle);
  const id = idFor(title, year);

  const stato = await Store.load();
  if ((stato.declined || []).includes(id)) return { mount: false };     // l'hai già tolto una volta

  /* Se è già in libreria hai già risposto una volta: non si ricomincia da capo.
     Il voto si dà dalla pillola finché resta aperta, o dalla Libreria. */
  if (stato.library.some((t) => t.id === id)) return { mount: false };

  const poster = await posterFor({ title, year, pagePoster: seen.poster }, settings);

  const item = {
    id, title, year,
    genre: seen.genre || null,
    director: seen.director || null,
    serie: Boolean(seen.serie),
    host: seen.host,
    poster
  };

  /* «Pannello sulla pagina video» spento: registra comunque, in silenzio. */
  if (!settings.overlay) {
    await Store.remember({ ...item, state: "DA VOTARE", addedAt: Date.now() });
    return { mount: false };
  }

  await Store.addPending(item);
  return { mount: true, item, askVote: settings.askVote };
}

/* ── Le sei proposte di stasera ──────────────────────────────── */

async function stasera({ force } = {}) {
  const salvate = await Store.proposals();
  const oggi = new Date().toISOString().slice(0, 10);
  if (!force && salvate && salvate.day === oggi) return salvate;

  const [library, settings] = [await Store.library(), await Store.settings()];
  const { items, source, error } = await proposte(library, settings);

  // Ogni proposta si porta la sua locandina, se si riesce a trovarla.
  for (const p of items) {
    if (!p.poster) p.poster = await posterFor({ title: p.title, year: p.year }, settings);
  }

  const salvato = await Store.saveProposals(items, source);
  return { ...salvato, error };
}

/* ── Chi chiede cosa ─────────────────────────────────────────── */

const azioni = {
  seen: ({ seen }) => visto(seen),

  confirm: async ({ id }) => {
    const in_attesa = (await Store.pending()).find((p) => p.id === id);
    if (in_attesa) {
      await Store.remember({ ...in_attesa, state: "DA VOTARE", addedAt: Date.now() });
      await Store.dropPending(id);
    }
    return { ok: true };
  },

  discard: async ({ id }) => {
    await Store.dropPending(id);
    await Store.forget(id);
    return { ok: true };
  },

  vote: async ({ id, vote }) => {
    const stato = VOTI[vote];
    if (!stato) return { ok: false };
    const in_attesa = (await Store.pending()).find((p) => p.id === id);
    if (in_attesa) {
      await Store.remember({ ...in_attesa, addedAt: Date.now() });
      await Store.dropPending(id);
    }
    await Store.vote(id, stato);
    return { ok: true, state: stato };
  },

  mute: async ({ host, on }) => {
    const s = await Store.settings();
    const hosts = new Set(s.mutedHosts || []);
    on ? hosts.add(host) : hosts.delete(host);
    await Store.patchSettings({ mutedHosts: [...hosts] });
    return { ok: true };
  },

  proposals: ({ force }) => stasera({ force }),

  verifyKey: async () => verificaChiave(await Store.settings()),

  poster: async ({ title, year, pagePoster }) => {
    const settings = await Store.settings();
    return { url: await posterFor({ title, year, pagePoster }, settings) };
  }
};

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const azione = msg && azioni[msg.type];
  if (!azione) return false;
  Promise.resolve(azione(msg, sender))
    .then(sendResponse)
    .catch((err) => {
      console.error("[fosforo]", msg.type, err);
      sendResponse({ error: String(err && err.message || err) });
    });
  return true;   // la risposta arriva dopo: tenere aperto il canale
});

/* Il primo avvio prepara l'archivio, così la dashboard non trova il vuoto. */
api.runtime.onInstalled.addListener(() => { Store.load(); });

/* Il marchio nella barra apre la dashboard a tutta pagina: è quella la casa. */
api.action.onClicked.addListener(() => {
  api.tabs.create({ url: api.runtime.getURL("pages/dashboard.html") });
});
