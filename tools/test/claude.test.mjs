/* La chiamata a Claude, senza spendere un token: `fetch` è finto.
   Qui si controlla la forma della richiesta — modello, schema, intestazioni —
   e che una risposta storta non lasci mai la schermata vuota. */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { proposte, MODEL, SCHEMA, CHIAVI_VIETATE } from "../../extension/lib/claude.js";
import { SEED } from "../../extension/lib/seed.js";

let richiesta = null;

function rispondi(corpo, stato = 200) {
  globalThis.fetch = async (url, init) => {
    richiesta = { url: String(url), init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify(corpo), {
      status: stato,
      headers: { "content-type": "application/json" }
    });
  };
}

const RISPOSTA_BUONA = {
  id: "msg_1", type: "message", role: "assistant", model: MODEL,
  stop_reason: "end_turn", stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
  content: [{
    type: "text",
    text: JSON.stringify({
      proposte: [{
        title: "Le mani sulla città", year: "1963", genre: "Drammatico", runtime: "105 min",
        rating: "T", aff: 81, reason: "Hai amato Il Divo: Rosi lavora la stessa materia.",
        highlight: ["Il Divo"], chips: ["CINEMA ITALIANO +34"]
      }]
    })
  }]
};

beforeEach(() => { richiesta = null; });

test("chiama Opus 5 con lo schema della schermata Stasera", async () => {
  rispondi(RISPOSTA_BUONA);
  const esito = await proposte(SEED, { anthropicKey: "sk-ant-finta" });

  assert.equal(esito.source, "claude");
  assert.equal(esito.items[0].title, "Le mani sulla città");
  assert.equal(esito.items[0].aff, 81);

  assert.match(richiesta.url, /api\.anthropic\.com\/v1\/messages/);
  assert.equal(richiesta.body.model, "claude-opus-5");
  assert.equal(richiesta.body.thinking.type, "adaptive");
  assert.equal(richiesta.body.output_config.format.type, "json_schema");
  const campi = richiesta.body.output_config.format.schema.properties.proposte.items.required;
  assert.deepEqual(campi.sort(), ["aff", "chips", "genre", "highlight", "rating", "reason", "runtime", "title", "year"]);
});

test("dal browser manda l'intestazione che l'API pretende", async () => {
  rispondi(RISPOSTA_BUONA);
  await proposte(SEED, { anthropicKey: "sk-ant-finta" });
  const h = new Headers(richiesta.init.headers);
  assert.equal(h.get("anthropic-dangerous-direct-browser-access"), "true");
  assert.equal(h.get("anthropic-version"), "2023-06-01");
  assert.equal(h.get("x-api-key"), "sk-ant-finta");
});

test("la libreria arriva a Claude con i voti, non nuda", async () => {
  rispondi(RISPOSTA_BUONA);
  await proposte(SEED, { anthropicKey: "sk-ant-finta" });
  const testo = richiesta.body.messages[0].content;
  assert.match(testo, /Il Divo · 2008 · Sorrentino · AMATO/);
  assert.match(richiesta.body.system, /seconda persona singolare/);
});

test("senza chiave non chiama nessuno e passa in modalità demo", async () => {
  globalThis.fetch = async () => { throw new Error("non si deve chiamare"); };
  const esito = await proposte(SEED, { anthropicKey: "" });
  assert.equal(esito.source, "demo");
  assert.ok(esito.items.length > 0, "la demo propone comunque qualcosa");
  assert.ok(esito.items.every((p) => p.aff >= 40 && p.aff <= 100));
});

test("una chiave sbagliata lo dice a parole, e intanto propone lo stesso", async () => {
  rispondi({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401);
  const esito = await proposte(SEED, { anthropicKey: "sk-sbagliata" });
  assert.equal(esito.source, "demo");
  assert.match(esito.error, /chiave di Claude non è valida/);
  assert.ok(esito.items.length > 0);
});

test("se Claude declina, la schermata non resta vuota", async () => {
  rispondi({ ...RISPOSTA_BUONA, stop_reason: "refusal", content: [] });
  const esito = await proposte(SEED, { anthropicKey: "sk-ant-finta" });
  assert.equal(esito.source, "demo");
  assert.match(esito.error, /declinato/);
});

test("l'HTML che arrivasse dal modello non entra nella pagina", async () => {
  rispondi({
    ...RISPOSTA_BUONA,
    content: [{ type: "text", text: JSON.stringify({ proposte: [{
      title: "<img src=x onerror=alert(1)>Cattivo", year: "1970", genre: "", runtime: "", rating: "",
      aff: 999, reason: "<script>rubo()</script> testo", highlight: [], chips: []
    }] }) }]
  });
  const esito = await proposte(SEED, { anthropicKey: "sk-ant-finta" });
  const p = esito.items[0];
  // Niente markup sopravvive: quel che resta è testo, e come testo verrà mostrato.
  assert.equal(p.title, "Cattivo");
  assert.doesNotMatch(p.reason, /[<>]/);
  assert.match(p.reason, /testo/);
  assert.equal(p.aff, 100, "l'affinità resta dentro la scala");
});

/* ── Lo schema deve restare dentro quel che gli structured output accettano ──
   Il 400 «output_config.format.schema: For 'array' type…» è arrivato in faccia a
   un utente vero: `maxItems`, `minimum` e `maximum` non sono supportati, e
   `minItems` vale solo 0 o 1. Non si vede provando la forma della richiesta —
   la richiesta parte, è il server che la rifiuta — quindi si controlla qui. */

test("lo schema non usa chiavi che gli structured output rifiutano", () => {
  const trovate = [];
  (function cerca(nodo, dove) {
    if (!nodo || typeof nodo !== "object") return;
    for (const [k, v] of Object.entries(nodo)) {
      if (CHIAVI_VIETATE.includes(k)) trovate.push(`${dove}.${k}`);
      cerca(v, `${dove}.${k}`);
    }
  })(SCHEMA, "schema");

  assert.deepEqual(trovate, [], "chiavi non supportate nello schema: " + trovate.join(", "));
});

test("minItems c'è solo con 0 o 1, gli unici valori ammessi", () => {
  const valori = [];
  (function cerca(nodo) {
    if (!nodo || typeof nodo !== "object") return;
    if ("minItems" in nodo) valori.push(nodo.minItems);
    Object.values(nodo).forEach(cerca);
  })(SCHEMA);

  for (const v of valori) assert.ok(v === 0 || v === 1, `minItems: ${v} non è ammesso`);
});

test("i limiti tolti dallo schema sono applicati lo stesso sulla risposta", async () => {
  /* Il modello manda otto proposte, un'affinità fuori scala e liste troppo lunghe:
     lo schema non lo impedisce più, quindi deve reggere il codice. */
  const troppe = Array.from({ length: 8 }, (_, i) => ({
    title: "Titolo " + i, year: "1970", genre: "Drammatico", runtime: "100 min", rating: "T",
    aff: 140, reason: "Perché sì.",
    highlight: ["a", "b", "c", "d", "e", "f"],
    chips: ["UNO +1", "DUE +2", "TRE +3", "QUATTRO +4"]
  }));
  rispondi({
    id: "msg_2", type: "message", role: "assistant", model: MODEL,
    stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: "text", text: JSON.stringify({ proposte: troppe }) }]
  });

  const esito = await proposte(SEED, { anthropicKey: "sk-ant-finta" });
  assert.equal(esito.source, "claude");
  assert.equal(esito.items.length, 6, "al massimo sei proposte");
  assert.equal(esito.items[0].aff, 100, "l'affinità resta in scala");
  assert.equal(esito.items[0].highlight.length, 4, "al massimo quattro titoli citati");
  assert.equal(esito.items[0].chips.length, 3, "al massimo tre etichette");
});
