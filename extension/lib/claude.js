/* I consigli di stasera, scritti da Claude.

   Vive solo nel service worker: la chiave non passa mai per la pagina che stai
   guardando, che è esattamente quel che promette il testo delle Impostazioni.
   Senza chiave non fallisce: si scende in modalità demo (lib/rank.js). */

import Anthropic from "../vendor/anthropic.js";
import { proposteLocali } from "./rank.js";

export const MODEL = "claude-opus-5";

/* La risposta non è testo libero: è questa forma, o non è. Così la schermata
   Stasera non deve mai indovinare, e non c'è HTML del modello da eseguire.

   ATTENZIONE — gli structured output accettano un sottoinsieme di JSON Schema.
   `maxItems`, `minimum` e `maximum` NON sono supportati e fanno fallire l'intera
   richiesta con un 400 «For 'array' type…»; `minItems` vale solo 0 oppure 1.
   I limiti veri stanno due posti più in là, dove contano: scritti nel prompt,
   perché il modello li rispetti, e applicati in `pulisci()`, perché valgano
   comunque. Lo schema dice la FORMA, non la misura.
   Il test `tools/test/claude.test.mjs` non lascia rientrare queste chiavi. */
const SCHEMA = {
  type: "object",
  properties: {
    proposte: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          year: { type: "string" },
          genre: { type: "string" },
          runtime: { type: "string", description: "Per esempio «113 min»" },
          rating: { type: "string", description: "Per esempio «VM14» o «T»" },
          aff: { type: "integer", description: "Da 0 a 100." },
          reason: {
            type: "string",
            description: "Due o tre frasi, in italiano, che citano i titoli in libreria da cui nasce il consiglio. Testo semplice, senza HTML."
          },
          highlight: {
            type: "array",
            items: { type: "string" },
            description: "I titoli citati dentro reason, così l'interfaccia li può mettere in evidenza. Al massimo quattro."
          },
          chips: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Da una a tre etichette brevi maiuscole col peso, per esempio «CINEMA ITALIANO +34»."
          }
        },
        required: ["title", "year", "genre", "runtime", "rating", "aff", "reason", "highlight", "chips"],
        additionalProperties: false
      }
    }
  },
  required: ["proposte"],
  additionalProperties: false
};

/** Le chiavi che gli structured output rifiutano. Il test le cerca nello SCHEMA. */
export const CHIAVI_VIETATE = ["maxItems", "minimum", "maximum", "minLength", "maxLength", "multipleOf", "pattern", "prefixItems"];
export { SCHEMA };

const SYSTEM = `Sei il motore di consiglio di Fosforo, un'estensione che ricorda cosa guarda una persona e le dice cosa guardare stasera.

Ti do la sua libreria: cosa ha amato, cosa gli è piaciuto, cosa no, cosa aspetta in lista. Proponi sei titoli per stasera, ordinati dal più affine al meno.

Regole:
- Non proporre titoli che ha già in libreria come visti o votati; un titolo «IN LISTA» invece va benissimo, è roba che aspetta.
- Il campo «aff» è quanto quel titolo somiglia a ciò che ha amato: 0-100, e deve essere onesto. Se il sesto titolo è un azzardo, dàgli 55, non 80.
- «reason» è il cuore: due o tre frasi in italiano, seconda persona singolare, che dicono da QUALI suoi titoli nasce il consiglio, citandoli per nome. Concreta, niente pubblicità, niente aggettivi da retrocopertina. Se proponi un azzardo, dillo.
- In «highlight» metti i titoli citati dentro «reason», scritti identici.
- «chips» sono le affinità misurate, in maiuscolo col peso: «CINEMA ITALIANO +34», «POLITICA +21».
- Scrivi sempre in italiano, anche se la libreria ha titoli in altre lingue.`;

/** La libreria come la vede Claude: solo quel che serve a decidere. */
function libreriaPerClaude(library) {
  return library
    .filter((t) => t.title)
    .map((t) => [t.title, t.year, t.director, t.serie ? "serie" : null, t.state].filter(Boolean).join(" · "))
    .join("\n");
}

/**
 * Le sei proposte. Con chiave: le scrive Claude. Senza: modalità demo.
 * Restituisce { items, source, error }.
 */
export async function proposte(library, settings) {
  if (!settings.anthropicKey) {
    return { items: proposteLocali(library), source: "demo", error: null };
  }

  const client = new Anthropic({
    apiKey: settings.anthropicKey,
    dangerouslyAllowBrowser: true   // siamo in un service worker, non su una pagina web
  });

  try {
    const risposta = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Questa è la mia libreria:\n\n${libreriaPerClaude(library)}\n\nCosa guardo stasera?`
        }
      ]
    });

    if (risposta.stop_reason === "refusal") {
      return {
        items: proposteLocali(library),
        source: "demo",
        error: "Claude ha declinato la richiesta. Intanto ti ordino la libreria da solo."
      };
    }

    const testo = risposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const dati = JSON.parse(testo);
    /* Il tetto di sei sta qui, non nello schema: `maxItems` lo farebbe rifiutare. */
    const items = (dati.proposte || []).slice(0, 6).map(pulisci);

    if (!items.length) throw new Error("nessuna proposta nella risposta");
    return { items, source: "claude", error: null };
  } catch (err) {
    /* Nella barra ci sta poco e il messaggio viene tagliato: quello intero va in
       console, se no un 400 che dice PERCHÉ resta illeggibile. */
    console.error("[fosforo] Claude ha rifiutato la richiesta:", err);
    return { items: proposteLocali(library), source: "demo", error: messaggio(err) };
  }
}

/* Quel che arriva dal modello è dato, non codice: niente HTML, niente numeri fuori scala. */
function pulisci(p) {
  const testo = (v, max) => String(v == null ? "" : v).replace(/<[^>]*>/g, "").slice(0, max);
  return {
    title: testo(p.title, 120),
    year: testo(p.year, 4),
    genre: testo(p.genre, 40),
    runtime: testo(p.runtime, 20),
    rating: testo(p.rating, 10),
    aff: Math.max(0, Math.min(100, Math.round(Number(p.aff) || 0))),
    reason: testo(p.reason, 600),
    highlight: [].concat(p.highlight || []).slice(0, 4).map((h) => testo(h, 120)),
    chips: [].concat(p.chips || []).slice(0, 3).map((c) => testo(c, 40)),
    poster: null
  };
}

/**
 * La chiave funziona? Si chiede al registro dei modelli: è una GET, non costa token.
 */
export async function verificaChiave(settings) {
  if (!settings.anthropicKey) return { ok: false, error: "Nessuna chiave" };
  const client = new Anthropic({ apiKey: settings.anthropicKey, dangerouslyAllowBrowser: true });
  try {
    await client.models.retrieve(MODEL);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: messaggio(err) };
  }
}

/** Errori che si possono leggere nella barra, invece di un vuoto. */
function messaggio(err) {
  const status = err && err.status;
  if (status === 401) return "La chiave di Claude non è valida: controllala nelle Impostazioni.";
  if (status === 429) return "Hai finito le richieste per ora. Riprova più tardi.";
  if (status === 400) return "Claude ha rifiutato la richiesta: " + (err.message || "").slice(0, 120);
  if (status >= 500) return "Claude non risponde in questo momento.";
  if (err && /Failed to fetch|NetworkError/i.test(err.message || "")) return "Nessuna rete verso Claude.";
  return "Consigli non disponibili: " + String((err && err.message) || err).slice(0, 140);
}
