import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resuelve el alias `@/` de tsconfig cuando el código corre en Node a secas.
 *
 * TypeScript y Next entienden `@/lib/...`, pero el runner de pruebas no: sin
 * esto, importar cualquier módulo de `lib/demo/` falla con ERR_MODULE_NOT_FOUND.
 * Se carga con `node --import ./test/alias-loader.mjs`.
 */
const RAIZ = pathToFileURL(path.resolve(import.meta.dirname, "..") + path.sep)
  .href;

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith("@/")) {
      return siguiente(
        new URL(`${especificador.slice(2)}.ts`, RAIZ).href,
        contexto,
      );
    }
    return siguiente(especificador, contexto);
  },
});
