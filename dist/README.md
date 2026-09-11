# Pacchetto pronto

`fosforo-2.6.0.zip` è **generato**, non scritto a mano: contiene solo `extension/`,
rinominata `fosforo` perché scompattandola esca la cartella che Chrome si aspetta.

Dopo ogni modifica a `extension/` va rifatto, se no quel che si scarica non è quel
che c'è nel repo:

```bash
npm run pack
```

La prova che il pacchetto è buono si fa caricando in Chromium **la cartella
scompattata**, non i sorgenti:

```bash
unzip dist/fosforo-2.6.0.zip -d /tmp/prova && node tools/e2e.mjs /tmp/prova/fosforo
```
