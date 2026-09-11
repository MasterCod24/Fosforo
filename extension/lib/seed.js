/* Il seme: quel che c'è in libreria la prima volta che apri Fosforo, perché una
   dashboard vuota non dice niente. «Cancella tutto» lo porta via e non torna.
   Sono i titoli del progetto, con regista e voto — nient'altro è inventato. */

import { idFor } from "./title.js";

const righe = [
  ["Il Divo", "2008", "Sorrentino", "AMATO"],
  ["Salò", "1975", "Pasolini", "AMATO"],
  ["L'Amica Geniale", "2018", "Serie", "AMATO"],
  ["Gomorra", "2014", "Serie", "AMATO"],
  ["La Grande Bellezza", "2013", "Sorrentino", "AMATO"],
  ["Romanzo Criminale", "2005", "Placido", "PIACIUTO"],
  ["È stata la mano di Dio", "2021", "Sorrentino", "AMATO"],
  ["Mio fratello è figlio unico", "2007", "Luchetti", "PIACIUTO"],
  ["Il traditore", "2019", "Bellocchio", "PIACIUTO"],
  ["Suburra", "2015", "Sollima", "NELLA MEDIA"],
  ["Lazzaro Felice", "2018", "Rohrwacher", "PIACIUTO"],
  ["Dogman", "2018", "Garrone", "DA VOTARE"],
  ["Le otto montagne", "2022", "Van Groeningen", "DA VOTARE"],
  ["Nostalgia", "2022", "Martone", "DA VOTARE"],
  ["Corpo Celeste", "2011", "Rohrwacher", "IN LISTA"],
  ["Vermiglio", "2024", "Delpero", "IN LISTA"]
];

export const SEED = righe.map(([title, year, director, state]) => ({
  id: idFor(title, year),
  title,
  year,
  director: director === "Serie" ? null : director,
  serie: director === "Serie",
  state,
  poster: null,
  host: null,
  addedAt: null
}));

export const DEFAULTS = {
  anthropicKey: "",
  tmdbKey: "",
  posterSource: "site",   // site | tmdb | none
  autoRecord: true,       // «Registra da solo cosa guardo»
  overlay: true,          // «Pannello sulla pagina video»
  askVote: true,          // «Chiedimi il voto quando finisco»
  english: false,         // «Interfaccia in inglese»
  mutedHosts: []          // «Non registrare su questo sito»
};

/** Gli stati che un titolo può avere, dal più amato al meno. */
export const STATES = ["AMATO", "PIACIUTO", "NELLA MEDIA", "NO", "DA VOTARE", "IN LISTA"];
