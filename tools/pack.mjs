/* Fa il pacchetto da scaricare: extension/ e basta, dentro una cartella «fosforo».
   Non si modifica a mano — si rifà con `npm run pack` dopo ogni cambiamento
   a extension/, se no quel che scarichi non è quel che c'è nel repo. */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, statSync, cpSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const versione = JSON.parse(readFileSync("extension/manifest.json", "utf8")).version;
const nome = `fosforo-${versione}.zip`;
const destinazione = resolve("dist", nome);

mkdirSync("dist", { recursive: true });
rmSync(destinazione, { force: true });

/* Si comprime da una copia rinominata «fosforo», così scompattando esce una
   cartella col nome giusto e il manifest al primo livello: è quella che Chrome vuole. */
const tmp = mkdtempSync(join(tmpdir(), "pack-"));
cpSync("extension", join(tmp, "fosforo"), { recursive: true });
execFileSync("zip", ["-r", "-q", "-X", destinazione, "fosforo"], { cwd: tmp });
rmSync(tmp, { recursive: true, force: true });

const kb = (statSync(destinazione).size / 1024).toFixed(0);
console.log(`dist/${nome} — ${kb} KB`);
console.log(execFileSync("unzip", ["-l", destinazione], { encoding: "utf8" }).split("\n").slice(0, 6).join("\n"));
