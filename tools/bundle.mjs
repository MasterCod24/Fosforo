/* Impacchetta l'SDK Anthropic in extension/vendor/anthropic.js.
   Il file prodotto è committato: chi carica l'estensione non compila niente.
   Si rilancia solo per aggiornare l'SDK — `npm run build`. */

import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const versione = JSON.parse(readFileSync("node_modules/@anthropic-ai/sdk/package.json", "utf8")).version;

await build({
  entryPoints: ["tools/vendor-entry.js"],
  outfile: "extension/vendor/anthropic.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["safari16", "chrome110"],
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: `/* @anthropic-ai/sdk ${versione} — generato da tools/bundle.mjs, non modificare a mano */` }
});

const out = readFileSync("extension/vendor/anthropic.js", "utf8");
writeFileSync("extension/vendor/VERSION", versione + "\n");
console.log(`SDK ${versione} impacchettato: ${(out.length / 1024).toFixed(0)} KB`);
