/* Le locandine, senza toccare la rete vera: `fetch` è finto e conta le chiamate. */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { posterFor, endpoints } from "../../extension/lib/poster.js";
import { Store } from "../../extension/lib/store.js";

let chiamate = [];
function rispondiTmdb(risultati) {
  globalThis.fetch = async (url) => {
    chiamate.push(String(url));
    return { ok: true, status: 200, json: async () => ({ results: risultati }) };
  };
}

beforeEach(async () => {
  chiamate = [];
  await Store.wipe();
});

const PAGINA = "https://raiplay.it/immagini/conformista.jpg";

test("«dal sito» usa l'immagine della pagina e non chiama nessuno", async () => {
  rispondiTmdb([{ poster_path: "/x.jpg" }]);
  const url = await posterFor({ title: "Il Conformista", year: "1970", pagePoster: PAGINA },
    { posterSource: "site", tmdbKey: "k" });
  assert.equal(url, PAGINA);
  assert.equal(chiamate.length, 0, "nessuna richiesta esterna");
});

test("«dal sito» ripiega su TMDB quando la pagina non ha immagine", async () => {
  rispondiTmdb([{ poster_path: "/abc.jpg", release_date: "1970-01-01" }]);
  const url = await posterFor({ title: "Il Conformista", year: "1970" },
    { posterSource: "site", tmdbKey: "chiave-v3" });
  assert.equal(url, endpoints.images + "/abc.jpg");
  assert.match(chiamate[0], /api_key=chiave-v3/);
  assert.match(chiamate[0], /language=it-IT/);
});

test("TMDB sceglie l'edizione dell'anno giusto", async () => {
  rispondiTmdb([
    { poster_path: "/rifatto.jpg", release_date: "2019-05-01" },
    { poster_path: "/originale.jpg", release_date: "1970-10-22" }
  ]);
  const url = await posterFor({ title: "Il Conformista", year: "1970" },
    { posterSource: "tmdb", tmdbKey: "k" });
  assert.equal(url, endpoints.images + "/originale.jpg");
});

test("un titolo si cerca una volta sola, anche se non si trova niente", async () => {
  rispondiTmdb([]);
  const s = { posterSource: "tmdb", tmdbKey: "k" };
  assert.equal(await posterFor({ title: "Sconosciuto", year: "1999" }, s), null);
  assert.equal(await posterFor({ title: "Sconosciuto", year: "1999" }, s), null);
  assert.equal(chiamate.length, 1, "la seconda volta risponde la cache");
});

test("«nessuna» non chiede niente a nessuno, nemmeno alla pagina", async () => {
  rispondiTmdb([{ poster_path: "/x.jpg" }]);
  const url = await posterFor({ title: "Il Conformista", year: "1970", pagePoster: PAGINA },
    { posterSource: "none", tmdbKey: "k" });
  assert.equal(url, null);
  assert.equal(chiamate.length, 0);
});

test("TMDB che va male non rompe niente: resta il pozzetto", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const url = await posterFor({ title: "Il Conformista", year: "1970" },
    { posterSource: "tmdb", tmdbKey: "sbagliata" });
  assert.equal(url, null);
});

test("una chiave v4 viaggia in intestazione, non nell'indirizzo", async () => {
  let headers = null;
  globalThis.fetch = async (url, opts) => {
    headers = opts.headers;
    chiamate.push(String(url));
    return { ok: true, status: 200, json: async () => ({ results: [{ poster_path: "/v4.jpg" }] }) };
  };
  await posterFor({ title: "Salò", year: "1975" },
    { posterSource: "tmdb", tmdbKey: "eyJhbGciOiJIUzI1NiJ9.abc" });
  assert.match(headers.Authorization, /^Bearer ey/);
  assert.doesNotMatch(chiamate[0], /api_key/);
});

test("un'immagine che non è un indirizzo valido viene scartata", async () => {
  rispondiTmdb([]);
  const url = await posterFor({ title: "Dogman", year: "2018", pagePoster: "javascript:alert(1)" },
    { posterSource: "site", tmdbKey: "" });
  assert.equal(url, null);
});
