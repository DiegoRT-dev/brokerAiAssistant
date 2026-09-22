import { normalizar, parseNumero, type Propiedad } from "@/lib/demo/parse";
import { normalizarZona } from "@/lib/demo/zonas";

/**
 * Lectura básica del textarea de Documentos.
 *
 * No entiende el documento: detecta de qué habla, qué cantidades menciona y qué
 * frases expresan una intención del cliente. Es deliberadamente superficial —
 * interpretar un documento de verdad es lo que aportará el modelo real — pero
 * es suficiente para que el texto pegado deje de ignorarse.
 */

export type AnalisisDocumentos = {
  vacio: boolean;
  caracteres: number;
  /** De qué trata el documento, por familias de palabras clave. */
  temas: string[];
  /** Cantidades relevantes encontradas (>= 10,000). */
  montos: number[];
  /** Frases donde el cliente expresa una preferencia o una necesidad. */
  senales: string[];
  /** Frases que expresan un rechazo; se cruzan con cada propiedad. */
  rechazos: string[];
  /** Primeras líneas del texto pegado, para poder citarlo. */
  extracto: string;
  /** Texto normalizado, para buscar menciones de propiedades. */
  normalizado: string;
};

const TEMAS: { nombre: string; patron: RegExp }[] = [
  {
    nombre: "crédito/financiamiento",
    patron:
      /\b(credito|hipotec\w*|infonavit|fovissste|banco|bancaria|tasa|preaprobacion|preaprobado|enganche|mensualidad|plazo de pago)\b/,
  },
  {
    nombre: "escrituración/trámites",
    patron:
      /\b(escritur\w*|notari\w*|predial|avaluo|gravamen|traslado de dominio|libertad de gravamen)\b/,
  },
  {
    nombre: "condominio/reglamento",
    patron:
      /\b(reglamento|condominio|cuota de mantenimiento|mantenimiento|asamblea|administracion|areas comunes)\b/,
  },
  {
    nombre: "plazos/mudanza",
    patron:
      /\b(mudanza|entrega|plazo|fecha limite|se muda|reubicacion|traslado laboral)\b/,
  },
  { nombre: "mascotas", patron: /\b(mascotas?|perros?|gatos?|pet friendly)\b/ },
  {
    nombre: "escuelas/familia",
    patron: /\b(escuelas?|colegios?|universidad|guarderia|hijos?|familia)\b/,
  },
  {
    nombre: "estado del inmueble",
    patron:
      /\b(remodel\w*|obra|reparacion\w*|acabados|pintura|humedad|filtracion\w*|instalacion\w*)\b/,
  },
  {
    nombre: "seguridad",
    patron: /\b(seguridad|vigilancia|caseta|acceso controlado|privada)\b/,
  },
];

/** Verbos que marcan una preferencia explícita del cliente. */
const INTENCION =
  /\b(no\s+quiere|no\s+acepta|no\s+desea|no\s+le\s+gusta|prefiere|necesita|requiere|descarta|le\s+preocupa|insiste\s+en|busca\s+sobre\s+todo|es\s+importante|le\s+urge)\b/;

/** Subconjunto de las anteriores que expresan rechazo. */
const RECHAZO = /\b(no\s+quiere|no\s+acepta|no\s+desea|no\s+le\s+gusta|descarta)\b/;

const VACIO: AnalisisDocumentos = {
  vacio: true,
  caracteres: 0,
  temas: [],
  montos: [],
  senales: [],
  rechazos: [],
  extracto: "",
  normalizado: "",
};

export function analizarDocumentos(texto: string | undefined): AnalisisDocumentos {
  const limpio = (texto ?? "").trim();
  if (!limpio) return VACIO;

  const normalizado = normalizar(limpio);
  const frases = partirEnFrases(limpio);

  const senales: string[] = [];
  const rechazos: string[] = [];

  for (const frase of frases) {
    const n = normalizar(frase);
    if (!INTENCION.test(n)) continue;
    if (senales.length < 6) senales.push(frase);
    if (RECHAZO.test(n)) rechazos.push(frase);
  }

  return {
    vacio: false,
    caracteres: limpio.length,
    temas: TEMAS.filter(({ patron }) => patron.test(normalizado)).map(
      ({ nombre }) => nombre,
    ),
    montos: extraerMontos(limpio),
    senales,
    rechazos,
    extracto: extraerExtracto(limpio),
    normalizado,
  };
}

/**
 * Primeras ~200 letras del texto, cortadas en un límite de palabra.
 *
 * Sirve para citar lo que el broker pegó cuando no se reconoce nada en ello:
 * ver su propio texto de vuelta deja claro que llegó, y responder "no reconocí
 * nada" a secas parece que se ignoró.
 */
function extraerExtracto(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= 200) return limpio;

  const corte = limpio.slice(0, 200);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > 120 ? corte.slice(0, ultimoEspacio) : corte).trim()}…`;
}

function partirEnFrases(texto: string): string[] {
  return texto
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((f) => f.trim().replace(/^[-*•\s]+/, ""))
    .filter((f) => f.length > 10);
}

function extraerMontos(texto: string): number[] {
  const encontrados = texto.match(
    /\$?\s?\d[\d.,]*\s*(?:mxn|pesos|millones?|mdp)?/gi,
  );
  if (!encontrados) return [];

  const montos = encontrados
    .map((m) => parseNumero(m))
    .filter((n): n is number => n !== null && n >= 10_000);

  return [...new Set(montos)].sort((a, b) => b - a).slice(0, 5);
}

/**
 * ¿Los documentos mencionan esta propiedad? Se busca por calle y por colonia,
 * que es como el broker se referiría a ella en sus notas.
 *
 * Se quita el número exterior antes de comparar: en unas notas se escribe
 * "la de Paseo de la Loma", no "Paseo de la Loma 145".
 */
export function mencionaPropiedad(
  analisis: AnalisisDocumentos,
  propiedad: Propiedad,
): boolean {
  if (analisis.vacio) return false;

  return [propiedad.calle, propiedad.colonia]
    .filter((v): v is string => Boolean(v))
    .some((valor) => {
      const aguja = sinNumeroExterior(normalizarZona(valor));
      return aguja.length > 4 && analisis.normalizado.includes(aguja);
    });
}

function sinNumeroExterior(texto: string): string {
  return texto.replace(/\s+(?:num\.?|no\.?|#)?\s*\d+[a-z]?$/, "").trim();
}
