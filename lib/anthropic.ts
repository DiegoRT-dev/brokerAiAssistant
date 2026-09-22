import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let cliente: Anthropic | null = null;

/**
 * Cliente de Anthropic compartido, creado la primera vez que se usa.
 *
 * La construcción es perezosa a propósito: en modo DEMO nunca se llama, así
 * que el SDK no llega a instanciarse y la app funciona sin ninguna clave.
 *
 * Lee `ANTHROPIC_API_KEY` del entorno (`.env.local`). La clave nunca se
 * hardcodea ni se expone al navegador: el import de `server-only` hace que la
 * compilación falle si algún día este módulo acaba importado desde un Client
 * Component por error.
 */
export function getAnthropic(): Anthropic {
  cliente ??= new Anthropic();
  return cliente;
}

/**
 * Sin clave, el SDK no falla al construirse ni lanza `AuthenticationError`:
 * lanza un error genérico al hacer la petición, que la UI mostraría como
 * "error inesperado". Como es el tropiezo más probable en la primera
 * ejecución, se comprueba antes de llamar para dar un mensaje accionable.
 */
export function tieneApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Modelo usado para generar las recomendaciones. */
export const MODEL = "claude-opus-5";

/**
 * Techo de tokens de salida. La respuesta completa (6 secciones + tabla +
 * email) cabe de sobra; un valor más bajo truncaría el email final.
 */
export const MAX_TOKENS = 16000;
