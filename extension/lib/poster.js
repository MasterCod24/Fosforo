/* Da dove arriva la locandina.
   Gira solo nel service worker: è l'unico posto con i permessi di rete, e l'unico
   che sa quale sorgente hai scelto. Regola che vale sopra a tutto: non si mostra
   mai un riquadro rotto — se non si trova niente resta il pozzetto rigato. */

import { Store } from "./store.js";
import { idFor } from "./title.js";

/* Indirizzi in chiaro: i test locali li puntano altrove, in produzione restano questi. */
export const endpoints = {
  tmdb: "https://api.themoviedb.org/3",
  images: "https://image.tmdb.org/t/p/w500"
};

const TTL = 30 * 24 * 60 * 60 * 1000;   // un mese: le locandine non cambiano spesso

/** L'immagine che il sito già mostra. Zero richieste a terzi: è solo un URL da tenere. */
function dallaPagina(pagePoster) {
  if (!pagePoster) return null;
  try {
    const u = new URL(pagePoster, "https://x.invalid");
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

/** TMDB: una richiesta per titolo, e poi mai più grazie alla cache. */
async function daTmdb(title, year, tmdbKey) {
  if (!tmdbKey) return null;

  const url = new URL(endpoints.tmdb + "/search/multi");
  url.searchParams.set("query", title);
  url.searchParams.set("language", "it-IT");
  url.searchParams.set("include_adult", "false");

  const headers = { Accept: "application/json" };
  // Le chiavi v4 sono token JWT e vanno in intestazione; le v3 restano in query.
  if (/^ey[A-Za-z0-9_-]+\./.test(tmdbKey)) headers.Authorization = "Bearer " + tmdbKey;
  else url.searchParams.set("api_key", tmdbKey);

  const risposta = await fetch(url, { headers });
  if (!risposta.ok) throw new Error("TMDB ha risposto " + risposta.status);

  const dati = await risposta.json();
  const candidati = (dati.results || []).filter((r) => r.poster_path);
  if (!candidati.length) return null;

  // A parità di titolo vince l'anno giusto; se l'anno non lo sappiamo, il più popolare.
  const scelto =
    (year && candidati.find((r) => (r.release_date || r.first_air_date || "").startsWith(year))) ||
    candidati[0];

  return endpoints.images + scelto.poster_path;
}

/**
 * Risolve la locandina di un titolo secondo l'impostazione scelta, con ripiego.
 * Ogni esito — anche «non trovata» — finisce in cache: un titolo si cerca una volta sola.
 */
export async function posterFor({ title, year, pagePoster }, settings, { force = false } = {}) {
  if (!title) return null;

  const key = idFor(title, year);
  if (!force) {
    const salvata = await Store.poster(key);
    if (salvata && Date.now() - salvata.at < TTL) return salvata.url;
  }

  const ordine =
    settings.posterSource === "none" ? [] :
    settings.posterSource === "tmdb" ? ["tmdb", "sito"] :
    ["sito", "tmdb"];

  let url = null;
  for (const sorgente of ordine) {
    try {
      url = sorgente === "sito" ? dallaPagina(pagePoster) : await daTmdb(title, year, settings.tmdbKey);
    } catch (err) {
      console.warn("[fosforo] locandina da", sorgente, "non riuscita:", err.message);
      url = null;
    }
    if (url) break;
  }

  await Store.rememberPoster(key, url);
  return url;
}
