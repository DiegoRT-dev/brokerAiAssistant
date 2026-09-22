import { normalizar, type Propiedad } from "@/lib/demo/parse";

/**
 * Decide si una propiedad está realmente en alguna de las zonas preferidas.
 *
 * La versión anterior hacía `bloqueCompleto.includes(zona)`, lo que fallaba en
 * los dos sentidos: daba por buena una casa en El Marqués cuya descripción
 * decía "a 10 minutos de Juriquilla", y rechazaba "Refugio Country" cuando el
 * cliente había escrito "El Refugio". Aquí se distingue *dónde* aparece el
 * nombre y se normalizan artículos y prefijos de fraccionamiento.
 */

export type Confianza = "alta" | "media" | "cercania";

export type CoincidenciaZona = {
  /** La zona preferida tal como la escribió el cliente. */
  zona: string;
  confianza: Confianza;
  /** Campo donde se encontró, para poder explicarlo. */
  donde: string | null;
};

/** Prefijos que acompañan al nombre pero no forman parte de él. */
const PREFIJOS =
  /^(?:fracc\.?|fraccionamiento|col\.?|colonia|residencial|privada|priv\.?|condominio|conjunto|unidad habitacional|zona|barrio|sector)\s+/;

/** Artículos iniciales: "El Refugio" y "Refugio" son la misma zona. */
const ARTICULOS = /^(?:el|la|los|las|del|de)\s+/;

/**
 * Frases que indican proximidad, no pertenencia. Se comprueban justo antes de
 * la mención: "a 10 minutos de Juriquilla" no significa estar en Juriquilla.
 */
const CERCANIA =
  /(?:cerca(?:na|no)?\s+(?:de|a|del)|cercania\s+(?:de|a)|a\s+\d+\s*(?:min|mins|minutos?|km|kilometros?)\s*(?:de|del|a)?|junto\s+a|proxim[oa]s?\s+a|camino\s+a|rumbo\s+a|colinda\s+con|vecin[oa]\s+(?:de|a)|acceso\s+(?:a|hacia)|salida\s+a|a\s+un\s+paso\s+de)\s+$/;

/** Cuánto vale cada nivel de certeza al puntuar. */
export const VALOR_POR_CONFIANZA: Record<Confianza, number> = {
  alta: 1,
  media: 0.85,
  cercania: 0.45,
};

/** Valor cuando la propiedad no está en ninguna zona preferida. */
export const VALOR_FUERA_DE_ZONA = 0.15;

/** Quita acentos, prefijos de fraccionamiento y artículos iniciales. */
export function normalizarZona(texto: string): string {
  let s = normalizar(texto)
    .replace(/[.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // En bucle: "Fracc. El Refugio" necesita quitar prefijo y artículo.
  let anterior = "";
  while (s !== anterior) {
    anterior = s;
    s = s.replace(PREFIJOS, "").replace(ARTICULOS, "").trim();
  }
  return s;
}

function tokens(texto: string): string[] {
  return normalizarZona(texto)
    .split(" ")
    .filter((t) => t.length > 1);
}

/** Todos los tokens de la zona están en el campo: "refugio" ⊂ "refugio country". */
function esSubconjunto(zona: string[], campo: string[]): boolean {
  return zona.length > 0 && zona.every((t) => campo.includes(t));
}

export function coincidirZona(
  propiedad: Propiedad,
  zonas: string[],
): CoincidenciaZona | null {
  if (zonas.length === 0) return null;

  // 1. Campos de dirección: la señal más fiable.
  const campos = [
    propiedad.colonia,
    propiedad.municipio,
    propiedad.calle,
    propiedad.estado,
    propiedad.ubicacion,
  ].filter((c): c is string => Boolean(c));

  for (const zona of zonas) {
    const objetivo = tokens(zona);
    for (const campo of campos) {
      if (esSubconjunto(objetivo, tokens(campo))) {
        return { zona, confianza: "alta", donde: campo };
      }
    }
  }

  // 2 y 3. Texto libre del bloque, separando mención directa de cercanía.
  let soloCercania: CoincidenciaZona | null = null;

  for (const zona of zonas) {
    const donde = buscarEnTexto(propiedad.bruto, zona);
    if (donde === "directa") return { zona, confianza: "media", donde: null };
    if (donde === "cercania" && !soloCercania) {
      soloCercania = { zona, confianza: "cercania", donde: null };
    }
  }

  return soloCercania;
}

function buscarEnTexto(
  bruto: string,
  zona: string,
): "directa" | "cercania" | null {
  const aguja = normalizarZona(zona);
  if (!aguja) return null;

  const heno = normalizar(bruto).replace(/\s+/g, " ");
  const patron = new RegExp(`\\b${escaparRegex(aguja)}\\b`, "g");

  let vioCercania = false;
  let encontrado: RegExpExecArray | null;

  while ((encontrado = patron.exec(heno)) !== null) {
    const antes = heno.slice(Math.max(0, encontrado.index - 40), encontrado.index);
    if (CERCANIA.test(antes)) vioCercania = true;
    else return "directa";
  }

  return vioCercania ? "cercania" : null;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
