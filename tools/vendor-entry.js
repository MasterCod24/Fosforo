// Punto d'ingresso del bundle: espone l'SDK ufficiale come modulo unico,
// così il service worker lo importa senza avere npm sotto.
export { default } from "@anthropic-ai/sdk";
export * from "@anthropic-ai/sdk";
