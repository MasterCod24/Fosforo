/* L'archivio. Un solo posto che scrive su disco, così la dashboard, il service
   worker e l'overlay non possono divergere.

   Dentro l'estensione: chrome.storage.local (resta tra un riavvio e l'altro,
   non esce dal Mac). Fuori: localStorage, per poter riguardare la grafica. */

import { api, isExtension } from "./platform.js";
import { SEED, DEFAULTS } from "./seed.js";

const KEY = "fosforo";

const backend = isExtension
  ? {
      async read() {
        const got = await api.storage.local.get(KEY);
        return got[KEY] || null;
      },
      async write(state) {
        await api.storage.local.set({ [KEY]: state });
      }
    }
  : {
      async read() {
        try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
      },
      async write(state) {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota: pazienza */ }
      }
    };

function empty() {
  return { library: [], pending: [], settings: { ...DEFAULTS }, posters: {}, proposals: null, seeded: false };
}

let cache = null;
const listeners = new Set();

/** Alla prima apertura la libreria non è vuota: c'è il seme, così si vede com'è fatta. */
async function load() {
  if (cache) return cache;
  const saved = await backend.read();
  if (saved) {
    cache = { ...empty(), ...saved, settings: { ...DEFAULTS, ...(saved.settings || {}) } };
  } else {
    cache = { ...empty(), library: SEED.map((t) => ({ ...t })), seeded: true };
    await backend.write(cache);
  }
  return cache;
}

async function commit() {
  await backend.write(cache);
  listeners.forEach((fn) => { try { fn(cache); } catch (e) { console.error(e); } });
}

export const Store = {
  load,

  /** Si iscrive ai cambiamenti, anche a quelli fatti da un'altra pagina. */
  watch(fn) {
    listeners.add(fn);
    if (isExtension && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes[KEY]) return;
        cache = changes[KEY].newValue;
        fn(cache);
      });
    }
    return () => listeners.delete(fn);
  },

  async settings() { return (await load()).settings; },

  async patchSettings(patch) {
    const s = await load();
    s.settings = { ...s.settings, ...patch };
    await commit();
    return s.settings;
  },

  async library() { return (await load()).library; },

  /** Aggiunge se non c'è già; se c'è, aggiorna quel che è arrivato di nuovo. */
  async remember(item) {
    const s = await load();
    const i = s.library.findIndex((x) => x.id === item.id);
    if (i >= 0) s.library[i] = { ...s.library[i], ...item };
    else s.library.unshift({ state: "DA VOTARE", addedAt: Date.now(), ...item });
    await commit();
    return s.library;
  },

  async forget(id) {
    const s = await load();
    s.library = s.library.filter((x) => x.id !== id);
    s.declined = [...(s.declined || []), id];
    await commit();
  },

  async vote(id, state) {
    const s = await load();
    const t = s.library.find((x) => x.id === id);
    if (t) { t.state = state; t.votedAt = Date.now(); }
    await commit();
  },

  async pending() { return (await load()).pending; },

  async addPending(item) {
    const s = await load();
    if (!s.pending.some((x) => x.id === item.id)) s.pending.push(item);
    await commit();
  },

  async dropPending(id) {
    const s = await load();
    s.pending = s.pending.filter((x) => x.id !== id);
    await commit();
  },

  /** Una locandina si risolve una volta sola: anche il buco nero si ricorda. */
  async poster(key) {
    const s = await load();
    return s.posters[key];
  },

  async rememberPoster(key, url) {
    const s = await load();
    s.posters[key] = { url: url || null, at: Date.now() };
    await commit();
  },

  async proposals() { return (await load()).proposals; },

  async saveProposals(items, source) {
    const s = await load();
    s.proposals = { day: new Date().toISOString().slice(0, 10), source, items };
    await commit();
    return s.proposals;
  },

  /** «Cancella tutto» cancella davvero: niente seme che rispunta. */
  async wipe() {
    cache = { ...empty(), seeded: true };
    await commit();
    return cache;
  }
};
