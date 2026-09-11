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

/* La dashboard e il service worker sono due mondi separati, ognuno con la sua
   copia in memoria. Chi scrive per ultimo vince — e senza questo ascolto il
   service worker restava con una copia vecchia e la riscriveva sopra a quel che
   la dashboard aveva appena salvato: un titolo aggiunto a mano spariva un
   istante dopo. Prima l'ascolto viveva dentro `watch()`, che il service worker
   non chiama mai: ora si registra all'avvio, in tutti e due i mondi. */
if (isExtension && api.storage.onChanged) {
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY]) return;
    cache = changes[KEY].newValue || null;
    listeners.forEach((fn) => { try { fn(cache); } catch (e) { console.error(e); } });
  });
}

/** La libreria parte VUOTA. Sedici titoli che l'utente non ha mai messo sono
    indistinguibili da un errore: li legge come roba sua, e i primi consigli
    nascono da gusti di qualcun altro. Il seme resta solo per la dimostrazione
    fuori dall'estensione (`pages/dashboard.html` aperta a mano), dove non c'è
    niente da sporcare e serve a far vedere com'è fatta. */
async function load() {
  if (cache) return cache;
  const saved = await backend.read();
  if (saved) {
    cache = { ...empty(), ...saved, settings: { ...DEFAULTS, ...(saved.settings || {}) } };
    await togliIlSeme();
  } else {
    cache = { ...empty(), library: isExtension ? [] : SEED.map((t) => ({ ...t })), seeded: true };
    await backend.write(cache);
  }
  return cache;
}

/* Chi ha aperto Fosforo prima dell'11 set 2026 si è ritrovato sedici titoli in
   libreria senza averli messi. Qui se ne vanno, una volta sola — ma solo quelli
   MAI TOCCATI: se ne hai votato uno, quel voto è tuo e resta, e resta tutto
   quello che hai aggiunto (ha `addedAt`). Si può togliere quando nessuno apre
   più una copia installata prima di quella data. */
async function togliIlSeme() {
  if (!isExtension || cache.semeTolto) return;
  const delSeme = new Set(SEED.map((t) => t.id));
  cache.library = cache.library.filter(
    (t) => !(delSeme.has(t.id) && !t.addedAt && !t.votedAt)
  );
  cache.semeTolto = true;
  await backend.write(cache);
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

  /** «Non mi interessa»: non è in libreria, quindi non c'è niente da togliere —
      si segna soltanto che non va più riproposto, né qui né sulle pagine video. */
  async decline(id) {
    const s = await load();
    if (!(s.declined || []).includes(id)) s.declined = [...(s.declined || []), id];
    await commit();
    return s.declined;
  },

  async declined() { return (await load()).declined || []; },

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
