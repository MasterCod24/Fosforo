/* Riconosce che stai guardando qualcosa, e cosa.
   Gira su ogni pagina, quindi deve essere prudente: se non riconosce un titolo
   non fa nulla e non monta niente. Non legge impostazioni né chiavi — quelle
   stanno nel service worker, che è l'unico a poterle vedere. */

(function () {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const TIPI_VIDEO = ["Movie", "TVSeries", "TVEpisode", "VideoObject", "Episode", "CreativeWork"];

  /* ── Quel che la pagina dichiara di sé ───────────────────────── */

  function meta(...nomi) {
    for (const n of nomi) {
      const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
      const v = el && el.getAttribute("content");
      if (v) return v.trim();
    }
    return null;
  }

  /* I siti veri (RaiPlay, Prime, YouTube) espongono JSON-LD: è la fonte migliore,
     perché è il sito stesso a dire titolo, anno, regista e locandina. */
  function fromJsonLd() {
    const blocchi = document.querySelectorAll('script[type="application/ld+json"]');
    for (const b of blocchi) {
      let dati;
      try { dati = JSON.parse(b.textContent); } catch { continue; }

      const coda = Array.isArray(dati) ? [...dati] : [dati];
      while (coda.length) {
        const n = coda.shift();
        if (!n || typeof n !== "object") continue;
        if (Array.isArray(n["@graph"])) coda.push(...n["@graph"]);
        if (n.itemListElement) coda.push(...[].concat(n.itemListElement).map((x) => x.item || x));

        const tipo = [].concat(n["@type"] || []).find((t) => TIPI_VIDEO.includes(t));
        if (!tipo || !n.name) continue;

        const parte = n.partOfSeries || n.partOfSeason;
        return {
          title: String(parte && parte.name ? parte.name : n.name).trim(),
          year: (n.datePublished || n.uploadDate || n.dateCreated || "").slice(0, 4) || null,
          director: [].concat(n.director || [])[0]?.name || null,
          genre: [].concat(n.genre || [])[0] || null,
          poster: primaImmagine(n.image) || primaImmagine(n.thumbnailUrl),
          serie: tipo === "TVSeries" || tipo === "TVEpisode" || tipo === "Episode",
          fonte: "json-ld"
        };
      }
    }
    return null;
  }

  function primaImmagine(v) {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return primaImmagine(v[0]);
    return v.url || v.contentUrl || null;
  }

  function fromOpenGraph() {
    const tipo = meta("og:type") || "";
    const titolo = meta("og:title", "twitter:title");
    if (!titolo) return null;
    const video = /video|movie|episode|tv_show/i.test(tipo) || Boolean(document.querySelector("video"));
    if (!video) return null;
    return {
      title: titolo,
      year: null,
      poster: meta("og:image", "og:image:secure_url", "twitter:image"),
      fonte: "open-graph"
    };
  }

  function fromTitolo() {
    if (!document.querySelector("video")) return null;   // niente player, niente da registrare
    return { title: document.title, year: null, poster: meta("og:image", "twitter:image"), fonte: "titolo" };
  }

  /** Quel che questa pagina sembra essere. Il service worker decide se vale. */
  function osserva() {
    const trovato = fromJsonLd() || fromOpenGraph() || fromTitolo();
    if (!trovato || !trovato.title) return null;
    return {
      ...trovato,
      rawTitle: trovato.title,
      pageTitle: document.title,
      host: location.hostname,
      url: location.href
    };
  }

  /* ── L'overlay, montato solo se il service worker dice di sì ── */

  let montato = null;
  let ultimaChiave = null;

  async function proponi() {
    const visto = osserva();
    if (!visto) return;

    const chiave = visto.host + "|" + visto.rawTitle;
    if (chiave === ultimaChiave) return;      // stessa pagina, stesso titolo: già fatto
    ultimaChiave = chiave;

    let risposta;
    try {
      risposta = await api.runtime.sendMessage({ type: "seen", seen: visto });
    } catch { return; }                        // service worker addormentato o estensione ricaricata
    if (!risposta || !risposta.mount) return;

    const item = risposta.item;
    if (montato) montato.remove();
    montato = window.FosforoOverlay.mount({
      title: item.title,
      meta: [item.year, item.genre, item.host].filter(Boolean).join(" · "),
      site: item.host,
      poster: item.poster,
      open: true,
      askVote: risposta.askVote,
      onConfirm: () => api.runtime.sendMessage({ type: "confirm", id: item.id }),
      onDiscard: () => api.runtime.sendMessage({ type: "discard", id: item.id }),
      onVote: (voto) => api.runtime.sendMessage({ type: "vote", id: item.id, vote: voto }),
      onMute: (on) => api.runtime.sendMessage({ type: "mute", host: item.host, on })
    });
  }

  /* Netflix, Prime e YouTube non ricaricano la pagina quando cambi titolo:
     cambia solo l'indirizzo. Quindi si guarda l'indirizzo, non il caricamento. */
  function sorveglia() {
    let href = location.href;
    const controlla = () => {
      if (location.href === href) return;
      href = location.href;
      if (montato) { montato.remove(); montato = null; }
      ultimaChiave = null;
      setTimeout(proponi, 900);   // il tempo che la pagina nuova si dichiari
    };
    setInterval(controlla, 1000);
    new MutationObserver(controlla).observe(document.head, { childList: true, subtree: true });
  }

  if (document.readyState === "complete") proponi();
  else window.addEventListener("load", () => setTimeout(proponi, 600));
  sorveglia();
})();
