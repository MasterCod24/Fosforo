/* Come si chiama un titolo, e come si riconosce che due nomi sono lo stesso film. */

const RUMORE = /\b(guarda|guardare|vedi|watch|streaming|online|gratis|full\s?hd|hd|4k|ita|sub\s?ita|episodio|stagione|puntata|video)\b/gi;

/** Toglie accenti, articoli e punteggiatura: serve solo a confrontare, non si mostra mai. */
export function normalize(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(il|lo|la|i|gli|le|l'|the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** La chiave con cui un titolo si ritrova in libreria e in cache. */
export function idFor(title, year) {
  const n = normalize(title);
  return year ? `${n}|${year}` : n;
}

/** Ripulisce il titolo che arriva da una pagina web: via il nome del sito e il rumore.
    Il titolo è quasi sempre il primo pezzo — «Il Conformista - Guarda streaming | RaiPlay» —
    quindi si tiene il primo che sopravvive alla ripulitura, non il più lungo. */
export function cleanPageTitle(raw, host) {
  const marchio = normalize((host || "").replace(/^www\./, "").split(".")[0]);

  const pezzi = String(raw || "")
    .split(/\s+[|—–·»]\s+|\s+-\s+/)
    .map((p) => p.replace(RUMORE, "").replace(/\(\s*\)|\[\s*\]/g, "").replace(/\s{2,}/g, " ").trim())
    .map((p) => p.replace(/[\s\-–—|:,.]+$/, "").trim())
    .filter(Boolean);

  const senzaMarchio = pezzi.filter((p) => !marchio || normalize(p).replace(/ /g, "") !== marchio);
  // Se resta solo il nome del sito, quella pagina non ha un titolo: meglio niente.
  const scelto = senzaMarchio[0] || "";

  // L'anno tra parentesi lo legge `yearFrom`: nel titolo non ci serve.
  return scelto.replace(/\s*[\(\[]\s*(19[0-9]{2}|20[0-9]{2})\s*[\)\]]\s*$/, "").trim();
}

/** L'anno, se la pagina lo dice da qualche parte. */
export function yearFrom(...candidates) {
  for (const c of candidates) {
    const m = String(c || "").match(/\b(19[0-9]{2}|20[0-9]{2})\b/);
    if (m) return m[1];
  }
  return null;
}
