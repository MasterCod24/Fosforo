/* Il punteggio di affinità quando Claude non c'è — la «modalità demo» che le
   Impostazioni promettono: registra e riordina, ma non spiega niente che non
   possa dimostrare. Nessun numero inventato: ogni punto ha una riga qui sotto. */

const PESO_STATO = { AMATO: 3, PIACIUTO: 2, "NELLA MEDIA": 0, NO: -2 };

/** Quanto conta un titolo già visto, per quello che stiamo valutando. */
function affinitaCon(candidato, visto) {
  const peso = PESO_STATO[visto.state];
  if (!peso) return { punti: 0, motivi: [] };

  const motivi = [];
  let punti = 0;

  if (candidato.director && visto.director && candidato.director === visto.director) {
    punti += peso * 12;
    motivi.push({ tipo: "regista", valore: visto.director, titolo: visto.title });
  }
  if (candidato.year && visto.year && Math.abs(Number(candidato.year) - Number(visto.year)) <= 10) {
    punti += peso * 3;
    motivi.push({ tipo: "epoca", valore: String(visto.year).slice(0, 3) + "0", titolo: visto.title });
  }
  if (candidato.serie === visto.serie) punti += peso;

  return { punti, motivi };
}

/**
 * Ordina per affinità quel che non hai ancora votato, e scrive il perché
 * con i titoli veri che l'hanno prodotto.
 */
export function proposteLocali(library, quante = 6) {
  const visti = library.filter((t) => PESO_STATO[t.state] !== undefined);
  const daVedere = library.filter((t) => t.state === "IN LISTA" || t.state === "DA VOTARE");

  const valutati = daVedere.map((c) => {
    let punti = 0;
    const motivi = [];
    for (const v of visti) {
      const r = affinitaCon(c, v);
      punti += r.punti;
      motivi.push(...r.motivi);
    }
    return { c, punti, motivi };
  });

  const massimo = Math.max(1, ...valutati.map((v) => v.punti));

  return valutati
    .sort((a, b) => b.punti - a.punti)
    .slice(0, quante)
    .map(({ c, punti, motivi }) => {
      const registi = [...new Set(motivi.filter((m) => m.tipo === "regista").map((m) => m.titolo))].slice(0, 2);
      const epoche = [...new Set(motivi.filter((m) => m.tipo === "epoca").map((m) => m.valore))].slice(0, 1);

      // 40 è il pavimento: sotto, non lo proporrei affatto.
      const aff = Math.max(40, Math.round(40 + (punti / massimo) * 55));

      const reason = registi.length
        ? `Stesso regista di ${registi.join(" e ")}, che hai in libreria. Senza chiave di Claude questo è tutto quello che posso dirti: il punteggio viene da regista ed epoca, non da un giudizio.`
        : `Sta in lista e assomiglia per epoca a quello che guardi${epoche.length ? " — anni " + epoche[0] : ""}. Senza chiave di Claude il punteggio viene da regista ed epoca, non da un giudizio.`;

      return {
        id: c.id,
        title: c.title,
        year: c.year || "",
        genre: c.serie ? "Serie" : "",
        runtime: "",
        rating: "",
        aff,
        reason,
        highlight: registi,
        chips: [
          c.director ? c.director.toUpperCase() : null,
          epoche.length ? "ANNI " + epoche[0].slice(2) : null,
          c.state === "IN LISTA" ? "IN LISTA" : null
        ].filter(Boolean),
        poster: c.poster || null
      };
    });
}
