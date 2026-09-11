/* Dove gira questo codice.
   Dentro l'estensione: Safari e Chrome espongono `browser`/`chrome`.
   Fuori (pagina aperta con doppio clic, per rivedere la grafica): niente di tutto ciò,
   e allora si ripiega su localStorage e si spegne la rete. */

export const api = globalThis.browser ?? globalThis.chrome ?? null;
export const isExtension = Boolean(api && api.runtime && api.runtime.id);

/** URL di una risorsa dell'estensione, o percorso relativo fuori da essa. */
export function assetUrl(path) {
  return isExtension ? api.runtime.getURL(path) : "../" + path;
}

/** Manda un messaggio al service worker. Fuori dall'estensione non c'è nessuno: null. */
export async function ask(message) {
  if (!isExtension) return null;
  try {
    return await api.runtime.sendMessage(message);
  } catch (err) {
    console.warn("[fosforo] nessuna risposta dal service worker:", err && err.message);
    return null;
  }
}
