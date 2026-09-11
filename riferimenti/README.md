# Riferimenti — non è codice attivo

Niente qui dentro viene caricato dall'estensione. È materiale salvato dal vecchio
progetto Safari (`fosforo-app`, fermo all'8 agosto 2026, cancellato l'11 settembre)
perché conteneva lavoro che non si rifà in dieci minuti.

## `i18n-safari.js`

La lingua dell'interfaccia commutabile **a runtime**, con ~150 coppie `[it, en]` in
una tabella sola e una `audit()` che trova le voci incomplete.

Il pezzo che vale non è la tabella — quelle stringhe sono di un'altra interfaccia e
non corrispondono a niente qui — ma la ragione scritta in cima al file: `browser.i18n`
risolve contro la lingua **del browser** e `getMessage()` non è sovrascrivibile a
runtime, quindi «interfaccia in inglese» come preferenza dell'utente non si può
costruire sopra `_locales`. Chi rifarà la lingua qui si risparmia di scoprirlo da solo.

`messages-it.json` / `messages-en.json` sono le uniche tre voci che restavano a
`_locales`: nome e descrizione nel manifest, che li legge il sistema.

## Se l'inglese non si fa mai

Questa cartella si cancella senza conseguenze: `git rm -r riferimenti/`.
