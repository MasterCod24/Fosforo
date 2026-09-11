# Fosforo

Estensione che ricorda cosa guardi e ti dice cosa guardare stasera.

Riconosce film e serie sulle pagine video che apri, li tiene in una libreria che
resta sul tuo computer, e da quella libreria fa scrivere a **Claude** le sei proposte
della sera, con un punteggio di affinità e il motivo — che cita i titoli che hai
amato davvero.

L'interfaccia è la direzione **SALA**: la locandina è la superficie, l'interfaccia è
vetro che ci galleggia sopra. Grafite `#0E1012`, Helvetica bianca, forme a pillola,
zero cromature e zero ciano. Gli artboard da cui nasce sono in [`design/`](design/).

## Installare

**Chrome / Edge / Arc** — `chrome://extensions` → *Modalità sviluppatore* → *Carica
estensione non pacchettizzata* → scegli la cartella `extension/`. Non c'è niente da
compilare: l'SDK è già impacchettato in `extension/vendor/`.

**Safari (macOS)** — `extension/` è una cartella MV3 pura, quindi:

```bash
xcrun safari-web-extension-converter extension --project-location ../fosforo-safari
```

poi apri il progetto Xcode, esegui, e abilita Fosforo in Safari → Impostazioni →
Estensioni. (Per usarla stabilmente serve un ID sviluppatore Apple; per provarla no.)

## Le due chiavi

Stanno in **Impostazioni**, dentro la dashboard, e non escono dal tuo computer: le
richieste partono solo dal service worker, mai dalla pagina che stai guardando.

| Chiave | A cosa serve | Senza |
|---|---|---|
| **Claude** (`sk-ant-…`) | Scrive le sei proposte di stasera e i motivi | Modalità demo: registra e ordina per regista ed epoca, e te lo dice |
| **TMDB** (v3 o token v4) | Locandine, quando scegli TMDB come sorgente | Resta la locandina del sito che guardi |

«Verifica» controlla la chiave di Claude interrogando il registro dei modelli: è una
richiesta gratuita, non consuma token.

## Le locandine, da sole

La voce **Da dove arrivano le locandine** nelle Impostazioni decide davvero:

- **Dal sito che guardi** *(predefinito)* — l'immagine che il sito già mostra, letta
  dai suoi stessi dati (JSON-LD, `og:image`). **Zero richieste a terzi.**
- **TMDB** — una richiesta per titolo, con la tua chiave. Locandine complete.
- **Nessuna** — niente immagini, solo tipografia.

La sorgente scelta prova per prima; se non trova nulla si scende alla successiva, e
in fondo resta il pozzetto rigato: non si vede mai un riquadro rotto. Ogni esito
finisce in cache — anche «non trovata» — quindi un titolo si cerca **una volta sola**.

## Com'è fatta

```
extension/
  manifest.json        MV3
  background.js        service worker: l'unico che parla con la rete e vede le chiavi
  lib/store.js         chrome.storage.local ⇄ localStorage
  lib/poster.js        il risolutore delle locandine
  lib/claude.js        le proposte (claude-opus-5, risposta vincolata a uno schema)
  lib/rank.js          la modalità demo: affinità calcolata in locale
  lib/title.js         come si riconosce che due nomi sono lo stesso film
  content/detect.js    riconosce il titolo sulla pagina
  content/overlay.*    la pillola di vetro sul player
  pages/dashboard.html Stasera · Libreria · Impostazioni
  pages/brand.html     il foglio del marchio (non si spedisce: genera le icone)
  vendor/anthropic.js  SDK ufficiale impacchettato — rigenerato da `npm run build`
```

Fuori dall'estensione `pages/dashboard.html` si apre anche con doppio clic: ripiega su
`localStorage`, niente rete, modalità demo. Serve a rivedere la grafica.

## Sviluppo

```bash
npm install
npm run build   # reimpacchetta l'SDK Anthropic in extension/vendor/
npm test        # logica: titoli, locandine, chiamata a Claude (rete finta)
npm run e2e     # carica l'estensione vera in Chromium su una pagina video finta
npm run icons   # rigenera le icone dal marchio
npm run shots   # fotografa le cinque superfici a 1160px
```

## Cosa è stato provato, e cosa no

Provato davvero, offline: l'estensione caricata in Chromium riconosce il titolo dal
JSON-LD di una pagina video, monta l'overlay, «È giusto» mette il titolo in libreria
**con la locandina presa dalla pagina**, i conteggi si aggiornano, e tutto è ancora lì
dopo un riavvio del browser (`npm run e2e`, 11 passi). La chiamata a Claude è
verificata nella forma — modello, schema della risposta, intestazioni, compresa
`anthropic-dangerous-direct-browser-access` — con la rete finta (`npm test`, 19 test).

**Non** provato, perché va provato sul tuo Mac con le tue chiavi:

1. una locandina vera da TMDB;
2. un sito video vero (RaiPlay, Prime, YouTube): il riconoscimento è scritto sui dati
   che quei siti dichiarano, ma ogni sito ha le sue stranezze;
3. i consigli veri di Claude, che costano token.

## I tuoi dati

Restano in `chrome.storage.local`, sul tuo computer. Niente account, niente
sincronizzazione, nessun server nostro. **Esporta** te li dà in JSON; **Cancella
tutto** li cancella davvero, seme compreso. I siti su cui hai detto «non registrare»
non fanno più montare niente.
