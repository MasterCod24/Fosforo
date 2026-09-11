import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPageTitle, yearFrom, idFor, normalize } from "../../extension/lib/title.js";

test("il titolo è il primo pezzo utile, non il più lungo", () => {
  assert.equal(cleanPageTitle("Il Conformista - Guarda streaming | RaiPlay", "www.raiplay.it"), "Il Conformista");
  assert.equal(cleanPageTitle("RaiPlay - Il Conformista", "www.raiplay.it"), "Il Conformista");
  assert.equal(cleanPageTitle("Gomorra - Stagione 1 Episodio 3 | Sky", "www.sky.it"), "Gomorra");
});

test("l'anno esce dal titolo e non ci resta dentro", () => {
  assert.equal(cleanPageTitle("Il Conformista (1970) – Prime Video", "www.primevideo.com"), "Il Conformista");
  assert.equal(yearFrom("Il Conformista (1970)"), "1970");
  assert.equal(yearFrom("nessun anno qui"), null);
});

test("una pagina che si chiama solo come il sito non è un titolo", () => {
  assert.equal(cleanPageTitle("YouTube", "www.youtube.com"), "");
  assert.equal(cleanPageTitle("", "www.raiplay.it"), "");
});

test("due scritture dello stesso film danno la stessa chiave", () => {
  assert.equal(idFor("Il Conformista", "1970"), idFor("il conformista", "1970"));
  assert.equal(normalize("È stata la mano di Dio"), "e stata la mano di dio");
  assert.notEqual(idFor("Gomorra", "2014"), idFor("Gomorra", "2008"));
});
