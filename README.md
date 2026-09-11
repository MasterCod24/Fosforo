# Fosforo

Estensione che ricorda cosa guardi e ti dice cosa guardare stasera.

---

## ⬇︎ Scarica e installa

**[Scarica fosforo-2.6.0.zip](https://github.com/MasterCod24/Fosforo/releases/latest/download/fosforo-2.6.0.zip)** — 211 KB, è l'unico file che ti serve.

### Chrome, Edge, Arc, Brave

1. Scarica lo zip col link qui sopra e **scompattalo** (doppio clic). Viene fuori una
   cartella che si chiama `fosforo`.
2. Apri `chrome://extensions` e accendi **Modalità sviluppatore**, in alto a destra.
3. Clic su **Carica estensione non pacchettizzata**.
4. Scegli la cartella **`fosforo`** — quella che contiene `manifest.json`.

> ⚠️ Il passo 4 è quello che frega tutti: Chrome vuole **la cartella**, non lo zip e non
> un file dentro la cartella. Se hai saltato lo scompattamento, torna al passo 1.

Fatto: il cerchio bianco compare nella barra degli strumenti. Cliccalo e si apre la
dashboard.

### Safari (macOS)

Safari non carica cartelle: va prima convertita in un'app, e serve Xcode.

```bash
unzip fosforo-2.6.0.zip
xcrun safari-web-extension-converter fosforo --project-location ~/fosforo-safari
```

Apri il progetto che ti crea, premi Esegui, poi Safari → Impostazioni → Estensioni →
abilita Fosforo. (Per tenerla installata stabilmente serve un ID sviluppatore Apple;
per provarla no.)

### Appena installata

Apri la dashboard → **Impostazioni** e incolla la tua **chiave di Claude** (`sk-ant-…`):
è quella che fa scrivere i consigli. Senza, Fosforo funziona lo stesso in modalità
demo — registra quel che guardi e lo ordina da solo, e te lo dice in chiaro.

**La libreria parte vuota.** Si riempie da sola guardando qualcosa, oppure con
«＋ Aggiungi un titolo». Nessun titolo di esempio: quel che c'è dentro l'hai messo tu,
e i consigli nascono dai tuoi gusti e non da quelli di qualcun altro.

---

Riconosce film e serie sulle pagine video che apri, li tiene in una libreria che
resta sul tuo computer, e da quella libreria fa scrivere a **Claude** le sei proposte
della sera, con un punteggio di affinità e il motivo — che cita i titoli che hai
amato davvero.

L'interfaccia è la direzione **SALA**: la locandina è la superficie, l'interfaccia è
vetro che ci galleggia sopra. Grafite `#0E1012`, Helvetica bianca, forme a pillola,
zero cromature e zero ciano. Gli artboard da cui nasce sono in [`design/`](design/).

## Cosa si fa dentro

**Stasera** — un titolo alla volta, la locandina a tutta altezza, l'affinità che sale
da zero. Le altre cinque proposte sono il nastro in basso; «Rigenera» le rifà.

**Libreria** — il muro di locandine. Un clic su una locandina cambia il voto; la
ricerca cerca per titolo, regista e anno. I titoli aggiunti a mano cercano la loro
locandina come tutti gli altri. **＋ Aggiungi un titolo** serve quando
Fosforo non ha visto passare un film: basta il titolo, anno e tipo si correggono dopo.

**Impostazioni** — quattro schede, raggruppate per conseguenza e non per categoria:

| Scheda | Cosa c'è |
|---|---|
| **Consigli** | la chiave di Claude e da dove arrivano le locandine |
| **Registrazione** | i tre interruttori, i siti dove non registrare, la modalità ospite |
| **Aspetto** | quanti titoli per riga, locandina grande su Stasera, animazioni |
| **I tuoi dati** | quanto pesa quel che hai, esporta, cancella tutto |

La **modalità ospite** è un interruttore solo: finché è acceso il service worker non
registra niente e la pillola non compare. Quel che è già in libreria resta dov'è.

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
  pages/dashboard.html Stasera · Libreria · Impostazioni (quattro schede)
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
npm run e2e:dash # la dashboard in Chromium: aggiungi un titolo, schede, densità, ospite
npm run icons   # rigenera le icone dal marchio
npm run shots   # fotografa le cinque superfici a 1160px
npm run pack    # rifà dist/fosforo-2.6.0.zip, il pacchetto da scaricare
```

Dopo ogni modifica a `extension/` va rifatto il pacchetto con `npm run pack`, se no
quel che si scarica dal link in cima non è quel che c'è nel repo.

## Cosa è stato provato, e cosa no

Provato davvero, offline, in Chromium con l'estensione caricata:

- **La catena** (`npm run e2e`, 11 passi) — riconosce il titolo dal JSON-LD di una
  pagina video, monta l'overlay, «È giusto» mette il titolo in libreria **con la
  locandina presa dalla pagina**, i conteggi si aggiornano, e tutto è ancora lì dopo
  un riavvio del browser.
- **La dashboard** (`npm run e2e:dash`, 34 passi) — la libreria parte vuota e dice
  come si riempie, aggiungere un titolo a mano lo fa
  comparire in cima alla libreria con lo stato scelto, lo stesso titolo due volte non
  fa due righe, il toast se ne va da solo, le quattro schede mostrano una cosa alla
  volta, un sito zittito **finisce davvero in `chrome.storage.local`**, la modalità
  ospite accende il flag che il service worker legge, la densità cambia la colonna del
  muro, le animazioni spente non lasciano nessuna animazione attiva. E su Stasera:
  i tre bottoni fanno quello che dicono — «Salva per stasera» mette in lista, «Non
  mi interessa» scarta e non ripropone nemmeno dopo un ricarico — e restano
  cliccabili anche con un «perché» lungo il triplo del normale. Zero errori
  JavaScript in tutta la sessione.

Tutti e 45 i passi sono stati rifatti **sulla cartella scompattata dallo zip** qui
sopra, non sui sorgenti: quel che scarichi è esattamente quel che è stato provato. La
chiamata a Claude è verificata nella forma — modello, schema della risposta,
intestazioni, compresa `anthropic-dangerous-direct-browser-access` — con la rete finta
(`npm test`, 25 test) — e tre di quei test tengono lo schema dentro il sottoinsieme
di JSON Schema che gli structured output accettano, perché `maxItems` e `minimum`
non sono supportati e fanno fallire l'intera richiesta con un 400.

Se Playwright non ha il suo Chromium, `FOSFORO_CHROME=/percorso/al/binario` fa usare
quello che hai già: serve il browser intero, l'headless shell non carica le estensioni.

**Non** provato, perché va provato sul tuo Mac con le tue chiavi:

1. una locandina vera da TMDB;
2. un sito video vero (RaiPlay, Prime, YouTube): il riconoscimento è scritto sui dati
   che quei siti dichiarano, ma ogni sito ha le sue stranezze;
3. i consigli veri di Claude, che costano token.

## I tuoi dati

Restano in `chrome.storage.local`, sul tuo computer. Niente account, niente
sincronizzazione, nessun server nostro. **Esporta** te li dà in JSON; **Cancella
tutto** li cancella davvero. I siti su cui hai detto «non registrare»
non fanno più montare niente.
