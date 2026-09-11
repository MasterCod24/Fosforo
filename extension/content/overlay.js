/* FOSFORO — pannello sulla pagina video.
   Una sola pillola di vetro in basso a destra che si apre in scheda.
   Non è una finestra dell'estensione trapiantata: non copre i controlli del
   player, non ha bordi luminosi, e dice in chiaro cos'ha registrato. */

(function (global) {
  "use strict";

  const VOTES = ["Amato", "Piaciuto", "Nella media", "No"];

  function build(opts) {
    const o = Object.assign({
      title: "Il Conformista",
      meta: "1970 · Drammatico · raiplay.it",
      site: "raiplay.it",
      poster: null,
      open: true,
      askVote: true,
      // Quel che i bottoni fanno davvero. Senza, l'overlay è solo una vetrina.
      onConfirm: () => {},
      onDiscard: () => {},
      onVote: () => {},
      onMute: () => {},
      onClose: () => {}
    }, opts);

    const root = document.createElement("div");
    root.id = "fosforo-overlay";
    root.innerHTML = `
      <div class="fsf-card fsf-glass" id="fsf-card">
        <div class="fsf-head">
          <span class="fsf-mark" aria-hidden="true"></span>
          <span class="fsf-wordmark">FOSFORO</span>
          <button class="fsf-close" type="button" id="fsf-close" aria-label="Chiudi il pannello">✕</button>
        </div>

        <div class="fsf-body">
          <p class="fsf-eyebrow">Registrato ora</p>
          <div class="fsf-title-row">
            <span class="fsf-thumb" aria-hidden="true"${o.poster ? ` style="background-image: url('${o.poster}')"` : ""}></span>
            <div style="min-width: 0;">
              <p class="fsf-title">${o.title}</p>
              <p class="fsf-meta">${o.meta}</p>
              <p class="fsf-said">È entrato in libreria. Se non è lui, toglilo: non lo riproporrò.</p>
            </div>
          </div>

          <div class="fsf-actions">
            <button class="fsf-btn fsf-btn-primary" type="button" id="fsf-ok">È giusto</button>
            <button class="fsf-btn fsf-btn-glass" type="button" id="fsf-no">Toglilo</button>
          </div>

          <div class="fsf-rate"${o.askVote ? "" : " hidden"}>
            <p class="fsf-eyebrow">Quando finisci, com'era?</p>
            <div class="fsf-rate-row" id="fsf-votes" role="group" aria-label="Voto">
              ${VOTES.map((v) => `<button class="fsf-vote" type="button" aria-pressed="false">${v}</button>`).join("")}
            </div>
          </div>
        </div>

        <div class="fsf-foot">
          <span class="fsf-foot-label">Non registrare su ${o.site}</span>
          <button class="fsf-switch" type="button" role="switch" aria-pressed="false" aria-label="Non registrare su ${o.site}">
            <span class="fsf-knob"></span>
          </button>
        </div>
      </div>

      <button class="fsf-pill fsf-glass" type="button" id="fsf-pill" aria-expanded="${o.open}" aria-controls="fsf-card">
        <span class="fsf-mark" aria-hidden="true"></span>
        <span class="fsf-pill-label">Sto registrando</span>
      </button>`;

    const card = root.querySelector("#fsf-card");
    const pill = root.querySelector("#fsf-pill");

    function setOpen(open) {
      card.hidden = !open;
      pill.setAttribute("aria-expanded", String(open));
      /* Riparte dall'inizio: la scheda entra da destra, non appare e basta. */
      if (open) { card.style.animation = "none"; void card.offsetWidth; card.style.animation = ""; }
    }

    pill.addEventListener("click", () => setOpen(card.hidden));
    root.querySelector("#fsf-close").addEventListener("click", () => { setOpen(false); o.onClose(); });

    /* «È giusto» lo tiene in libreria e la scheda si richiude: hai già risposto. */
    root.querySelector("#fsf-ok").addEventListener("click", () => {
      o.onConfirm();
      said("Tenuto in libreria.");
      setOpen(false);
    });

    /* «Toglilo» lo toglie davvero, e sparisce tutto: non lo riproporrò. */
    root.querySelector("#fsf-no").addEventListener("click", () => {
      o.onDiscard();
      root.remove();
    });

    root.querySelector("#fsf-votes").addEventListener("click", (e) => {
      const b = e.target.closest(".fsf-vote");
      if (!b) return;
      root.querySelectorAll(".fsf-vote").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      o.onVote(b.textContent.trim());
      said("Voto registrato: " + b.textContent.trim().toLowerCase() + ".");
    });

    root.querySelector(".fsf-switch").addEventListener("click", function () {
      const on = this.getAttribute("aria-pressed") !== "true";
      this.setAttribute("aria-pressed", String(on));
      o.onMute(on);
      if (on) said("Su " + o.site + " non registro più.");
    });

    /* La riga che dice cos'è successo: l'overlay non deve mai lasciarti a indovinare. */
    function said(testo) {
      const p = root.querySelector(".fsf-said");
      if (p) p.textContent = testo;
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !card.hidden) setOpen(false);
    });

    setOpen(o.open);
    return root;
  }

  global.FosforoOverlay = {
    mount(opts) {
      const existing = document.getElementById("fosforo-overlay");
      if (existing) existing.remove();
      const root = build(opts);
      document.body.appendChild(root);
      return root;
    }
  };
})(window);
