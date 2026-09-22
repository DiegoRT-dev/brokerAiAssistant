import {
  mencionaPropiedad,
  type AnalisisDocumentos,
} from "@/lib/demo/documentos";
import { area, moneda } from "@/lib/demo/formato";
import type { Cliente, Propiedad } from "@/lib/demo/parse";
import { normalizar } from "@/lib/demo/parse";
import {
  coincidirZona,
  VALOR_FUERA_DE_ZONA,
  VALOR_POR_CONFIANZA,
  type CoincidenciaZona,
} from "@/lib/demo/zonas";

export type Confianza = "alta" | "media" | "baja";

export type Evaluacion = {
  propiedad: Propiedad;
  /** 1 a 9.7, o `null` si no hubo ningún dato comparable. */
  score: number | null;
  /** Qué proporción de los criterios posibles se pudo evaluar (0 a 1). */
  cobertura: number;
  /** Lectura de `cobertura`: cuánto vale fiarse de este score. */
  confianza: Confianza;
  razonCorta: string;
  pros: string[];
  contras: string[];
  /**
   * Ventajas en dos o tres palabras, para la celda de la tabla comparativa.
   * Recortar los `pros` daba celdas idénticas entre filas y frases cortadas a
   * mitad de cifra; estas se construyen para distinguir de un vistazo.
   */
  etiquetas: string[];
  zona: CoincidenciaZona | null;
  fueraDeZona: boolean;
  /** Restricciones del cliente que la ficha parece contradecir. */
  conflictos: string[];
  /** El pago mensual supera el máximo declarado por el cliente. */
  excedeMensual: boolean;
  descartada: boolean;
  motivoDescarte: string | null;
};

type Criterio = { peso: number; valor: number };

/**
 * Pesos de cada criterio. La suma es el máximo de información que podríamos
 * llegar a tener sobre una propiedad; `cobertura` se mide contra ella.
 */
const PESOS = {
  precio: 3,
  zona: 3,
  mensual: 2,
  habitaciones: 2,
  restricciones: 1.5,
  banos: 1.5,
  area: 1.2,
  pagoInicial: 1.2,
  caracteristicas: 1.2,
  documentos: 0.8,
} as const;

const PESO_TOTAL = Object.values(PESOS).reduce((a, b) => a + b, 0);

/**
 * Regresión a la media: un criterio ficticio de peso K y valor NEUTRO que
 * arrastra el score hacia el centro cuando hay pocos datos.
 *
 * Sin esto, tres campos correctos daban 10/10. Con esto, un score alto
 * significa "encaja bien Y lo sabemos con confianza", que es lo que el broker
 * necesita poder leer de un vistazo.
 */
const K_SUAVIZADO = 5;
const VALOR_NEUTRO = 0.62;

/** Un 10/10 redondo transmitiría una precisión que esta heurística no tiene. */
const TOPE_GLOBAL = 9.7;
/**
 * Escala de topes, de menos a más grave:
 *
 *   9.7  global
 *   8.0  fuera de la zona preferida
 *   7.0  excede la cuota mensual máxima
 *   7.0  posible conflicto con una restricción
 *
 * El orden importa: una casa en la colonia equivocada sigue siendo viable y el
 * cliente puede decidir si le compensa; una cuya mensualidad supera lo que dijo
 * que podía pagar, no lo es hasta que él mismo suba ese tope.
 *
 * El tope se fijó en 7.0 y no en 7.5 midiendo: con 7.5 no llegaba a activarse
 * —la penalización de los criterios ya dejaba el score por debajo— y la
 * diferencia frente a una propiedad fuera de zona se quedaba en una décima.
 */
const TOPE_FUERA_DE_ZONA = 8;
const TOPE_EXCEDE_MENSUAL = 7;
const TOPE_CONFLICTO = 7;

export function evaluar(
  propiedad: Propiedad,
  cliente: Cliente,
  documentos: AnalisisDocumentos,
): Evaluacion {
  const criterios: Criterio[] = [];
  const pros: string[] = [];
  const contras: string[] = [];
  const etiquetas: string[] = [];
  const conflictos: string[] = [];

  let descartada = false;
  let motivoDescarte: string | null = null;
  let excedeMensual = false;

  // ── Tipo de propiedad ──────────────────────────────────────────────────
  if (cliente.tipoPropiedad && propiedad.tipo) {
    const quiere = normalizar(cliente.tipoPropiedad);
    const es = normalizar(propiedad.tipo);
    if (!quiere.includes(es) && !es.includes(quiere)) {
      descartada = true;
      motivoDescarte = `es ${propiedad.tipo.toLowerCase()} y el cliente busca ${cliente.tipoPropiedad.toLowerCase()}`;
    }
  }

  // ── Precio vs presupuesto ──────────────────────────────────────────────
  const { presupuestoMin: min, presupuestoMax: max } = cliente;
  if (propiedad.precio !== null && max !== null) {
    const ratio = propiedad.precio / max;

    if (ratio > 1.25) {
      criterios.push({ peso: PESOS.precio, valor: 0 });
      descartada = true;
      motivoDescarte = `su precio (${moneda(propiedad.precio)}) supera el presupuesto en ${pct(ratio - 1)}`;
    } else {
      criterios.push({ peso: PESOS.precio, valor: valorPrecio(ratio) });

      if (ratio <= 1) {
        const holgura = max - propiedad.precio;
        if (holgura > max * 0.08) {
          etiquetas.push(`${moneda(holgura)} bajo presupuesto`);
        }
        pros.push(
          `Precio de ${moneda(propiedad.precio)}, dentro del presupuesto${
            holgura > max * 0.05
              ? ` con ${moneda(holgura)} de margen`
              : ", aunque en el límite superior"
          }.`,
        );
        if (min !== null && propiedad.precio < min) {
          pros.push(
            `Queda ${moneda(min - propiedad.precio)} por debajo del mínimo del rango: deja liquidez para la mudanza.`,
          );
        }
      } else {
        contras.push(
          `Supera el presupuesto por ${moneda(propiedad.precio - max)} (${pct(ratio - 1)}).`,
        );
      }
    }
  }

  // ── Zona preferida ─────────────────────────────────────────────────────
  const zona = coincidirZona(propiedad, cliente.zonas);
  let fueraDeZona = false;

  if (cliente.zonas.length > 0) {
    if (zona && zona.confianza !== "cercania") {
      criterios.push({
        peso: PESOS.zona,
        valor: VALOR_POR_CONFIANZA[zona.confianza],
      });
      etiquetas.push(`En ${zona.zona}`);
      pros.push(
        zona.confianza === "alta"
          ? `Está en ${zona.zona}, una de las zonas preferidas${zona.donde && zona.donde !== zona.zona ? ` (${zona.donde})` : ""}.`
          : `La descripción la ubica en ${zona.zona}, una de las zonas preferidas. No viene en un campo de dirección, conviene confirmarlo.`,
      );
    } else if (zona) {
      criterios.push({
        peso: PESOS.zona,
        valor: VALOR_POR_CONFIANZA.cercania,
      });
      fueraDeZona = true;
      contras.push(
        `**No está en ${zona.zona}**: el texto solo menciona cercanía${propiedad.ubicacion ? `, y la ubica en ${propiedad.ubicacion}` : ""}. Estar cerca de una zona no es estar en ella.`,
      );
    } else {
      criterios.push({ peso: PESOS.zona, valor: VALOR_FUERA_DE_ZONA });
      fueraDeZona = true;
      contras.push(
        `**Está fuera de la zona preferida** (${cliente.zonas.join(" / ")})${
          propiedad.ubicacion ? `: se ubica en ${propiedad.ubicacion}` : ""
        }.`,
      );
    }
  }

  // ── Habitaciones ───────────────────────────────────────────────────────
  if (propiedad.habitaciones !== null && cliente.habitaciones !== null) {
    const diferencia = propiedad.habitaciones - cliente.habitaciones;

    if (diferencia >= 2) {
      criterios.push({ peso: PESOS.habitaciones, valor: 0.9 });
      pros.push(
        `${propiedad.habitaciones} habitaciones, ${diferencia} más de las ${cliente.habitaciones} pedidas.`,
      );
    } else if (diferencia >= 0) {
      criterios.push({ peso: PESOS.habitaciones, valor: 1 });
      pros.push(
        `${propiedad.habitaciones} habitaciones, cumple las ${cliente.habitaciones} solicitadas.`,
      );
    } else if (diferencia === -1) {
      criterios.push({ peso: PESOS.habitaciones, valor: 0.35 });
      contras.push(
        `Tiene ${propiedad.habitaciones} habitaciones y el cliente pidió ${cliente.habitaciones}.`,
      );
    } else {
      criterios.push({ peso: PESOS.habitaciones, valor: 0.05 });
      contras.push(
        `Solo ${propiedad.habitaciones} habitaciones frente a las ${cliente.habitaciones} requeridas.`,
      );
    }
  }

  // ── Baños ──────────────────────────────────────────────────────────────
  if (propiedad.banos !== null && cliente.banos !== null) {
    if (propiedad.banos >= cliente.banos) {
      criterios.push({ peso: PESOS.banos, valor: 1 });
      if (propiedad.banos > cliente.banos) {
        etiquetas.push(`${propiedad.banos} baños`);
        pros.push(`${propiedad.banos} baños, por encima de lo solicitado.`);
      }
    } else if (propiedad.banos >= cliente.banos - 0.5) {
      criterios.push({ peso: PESOS.banos, valor: 0.6 });
      contras.push(
        `${propiedad.banos} baños, ligeramente por debajo de los ${cliente.banos} pedidos.`,
      );
    } else {
      criterios.push({ peso: PESOS.banos, valor: 0.2 });
      contras.push(
        `${propiedad.banos} baños frente a los ${cliente.banos} requeridos.`,
      );
    }
  }

  // ── Superficie ─────────────────────────────────────────────────────────
  if (propiedad.area !== null && (cliente.areaMin || cliente.areaMax)) {
    const minA = cliente.areaMin ?? 0;
    const maxA = cliente.areaMax ?? Infinity;

    if (propiedad.area >= minA && propiedad.area <= maxA) {
      criterios.push({ peso: PESOS.area, valor: 1 });
      pros.push(`${area(propiedad.area)}, dentro del rango buscado.`);
    } else if (propiedad.area > maxA) {
      criterios.push({ peso: PESOS.area, valor: 0.85 });
      etiquetas.push("Más amplia de lo pedido");
      pros.push(`${area(propiedad.area)}, más amplia de lo que pidió.`);
    } else {
      // Entre el 85% del mínimo y el mínimo, el castigo crece de forma gradual.
      const proporcion = propiedad.area / minA;
      criterios.push({
        peso: PESOS.area,
        valor:
          proporcion >= 0.85 ? interpolar(proporcion, 0.85, 1, 0.35, 0.75) : 0.15,
      });
      contras.push(
        `${area(propiedad.area)}, por debajo del mínimo de ${area(cliente.areaMin)}.`,
      );
    }
  }

  // ── Pago mensual ───────────────────────────────────────────────────────
  if (propiedad.mensual !== null && cliente.mensualMax !== null) {
    const holgura = cliente.mensualMax - propiedad.mensual;
    const holguraRel = holgura / cliente.mensualMax;
    criterios.push({ peso: PESOS.mensual, valor: valorMensual(holguraRel) });

    if (holguraRel >= 0.05) {
      if (holguraRel >= 0.12) etiquetas.push("Mensualidad holgada");
      pros.push(
        `Pago mensual de ${moneda(propiedad.mensual)}: ${moneda(holgura)} por debajo del tope.`,
      );
    } else if (holguraRel >= 0) {
      contras.push(
        `El pago mensual (${moneda(propiedad.mensual)}) deja apenas ${moneda(holgura)} de margen frente al tope del cliente.`,
      );
    } else {
      excedeMensual = true;
      contras.push(
        `**Excede la capacidad de pago declarada:** ${moneda(propiedad.mensual)} al mes, ${moneda(-holgura)} por encima del máximo de ${moneda(cliente.mensualMax)}.`,
      );
    }
  }

  // ── Pago inicial ───────────────────────────────────────────────────────
  if (propiedad.pagoInicial !== null && cliente.pagoInicial !== null) {
    const ratio = propiedad.pagoInicial / cliente.pagoInicial;
    criterios.push({ peso: PESOS.pagoInicial, valor: valorPagoInicial(ratio) });

    if (ratio <= 1) {
      pros.push(
        `El pago inicial requerido (${moneda(propiedad.pagoInicial)}) cabe en los ${moneda(cliente.pagoInicial)} disponibles${
          ratio <= 0.85
            ? `, dejando ${moneda(cliente.pagoInicial - propiedad.pagoInicial)} para gastos de escrituración`
            : ", aunque casi sin margen para gastos de escrituración"
        }.`,
      );
    } else {
      contras.push(
        `Pide ${moneda(propiedad.pagoInicial - cliente.pagoInicial)} más de pago inicial del que el cliente tiene disponible.`,
      );
    }
  }

  // ── Características deseadas ───────────────────────────────────────────
  if (cliente.caracteristicas.length > 0) {
    const texto = normalizar(propiedad.bruto);
    const presentes = cliente.caracteristicas.filter((c) =>
      texto.includes(normalizar(c)),
    );
    const ausentes = cliente.caracteristicas.filter(
      (c) => !texto.includes(normalizar(c)),
    );

    criterios.push({
      peso: PESOS.caracteristicas,
      valor: Math.max(0.1, presentes.length / cliente.caracteristicas.length),
    });

    if (presentes.length > 0) {
      etiquetas.push(
        ausentes.length === 0
          ? "Todas las características"
          : `Incluye ${presentes[0]}`,
      );
      pros.push(`Incluye lo que pidió: ${presentes.join(", ")}.`);
    }
    if (ausentes.length > 0) {
      contras.push(
        `No se menciona: ${ausentes.join(", ")}. Conviene confirmarlo en la visita.`,
      );
    }
  }

  // ── Restricciones del cliente y rechazos de los documentos ─────────────
  const prohibiciones = [
    ...extraerProhibiciones(cliente.restricciones),
    ...documentos.rechazos.flatMap((r) => extraerProhibiciones(r)),
  ];

  if (prohibiciones.length > 0) {
    const textoPropiedad = normalizar(propiedad.bruto);

    // La misma prohibición suele llegar dos veces (del campo Restricciones y
    // de una frase de los documentos). Se avisa una sola vez por coincidencia.
    const yaAvisadas = new Set<string>();

    for (const prohibicion of prohibiciones) {
      const coincidencias = detectarConflicto(prohibicion, textoPropiedad);
      if (!coincidencias) continue;

      const clave = coincidencias.join("|");
      if (yaAvisadas.has(clave)) continue;
      yaAvisadas.add(clave);

      conflictos.push(prohibicion.original);
      contras.push(
        `⚠️ **Posible conflicto** con la restricción “${prohibicion.original}”: la ficha menciona ${coincidencias
          .map((c) => `“${c}”`)
          .join(" y ")}. Confírmalo antes de mostrarla.`,
      );
    }

    criterios.push({
      peso: PESOS.restricciones,
      valor: conflictos.length > 0 ? 0.3 : 1,
    });

    if (conflictos.length === 0) {
      pros.push("No contradice ninguna de las restricciones del cliente.");
    }
  }

  // ── Documentos ─────────────────────────────────────────────────────────
  if (!documentos.vacio) {
    const mencionada = mencionaPropiedad(documentos, propiedad);
    criterios.push({ peso: PESOS.documentos, valor: mencionada ? 1 : 0.6 });
    if (mencionada) {
      etiquetas.push("Ya en tus notas");
      pros.push(
        "Aparece mencionada en los documentos que pegaste: ya está sobre la mesa.",
      );
    }
  }

  const pesoAplicado = criterios.reduce((suma, c) => suma + c.peso, 0);
  const cobertura = Math.min(1, pesoAplicado / PESO_TOTAL);
  const score = calcularScore(criterios, {
    fueraDeZona,
    excedeMensual,
    hayConflicto: conflictos.length > 0,
  });
  const confianza = clasificarConfianza(cobertura);

  return {
    propiedad,
    score,
    cobertura,
    confianza,
    razonCorta: razonCorta(
      score,
      contras,
      confianza,
      descartada,
      motivoDescarte,
      conflictos.length > 0,
      excedeMensual,
    ),
    pros,
    contras,
    etiquetas,
    zona,
    fueraDeZona,
    conflictos,
    excedeMensual,
    descartada,
    motivoDescarte,
  };
}

// ─── Puntuación ──────────────────────────────────────────────────────────────

function calcularScore(
  criterios: Criterio[],
  topes: {
    fueraDeZona: boolean;
    excedeMensual: boolean;
    hayConflicto: boolean;
  },
): number | null {
  if (criterios.length === 0) return null;

  const peso = criterios.reduce((suma, c) => suma + c.peso, 0);
  const obtenido = criterios.reduce((suma, c) => suma + c.peso * c.valor, 0);

  const proporcion =
    (obtenido + K_SUAVIZADO * VALOR_NEUTRO) / (peso + K_SUAVIZADO);

  let score = proporcion * 10;
  score = Math.min(score, TOPE_GLOBAL);
  if (topes.fueraDeZona) score = Math.min(score, TOPE_FUERA_DE_ZONA);
  if (topes.excedeMensual) score = Math.min(score, TOPE_EXCEDE_MENSUAL);
  if (topes.hayConflicto) score = Math.min(score, TOPE_CONFLICTO);

  return Math.round(Math.max(1, score) * 10) / 10;
}

function clasificarConfianza(cobertura: number): Confianza {
  if (cobertura >= 0.7) return "alta";
  if (cobertura >= 0.4) return "media";
  return "baja";
}

/** Dentro de presupuesto vale más cuanto más margen deja para negociar. */
function valorPrecio(ratio: number): number {
  if (ratio <= 0.85) return 1;
  if (ratio <= 1) return interpolar(ratio, 0.85, 1, 1, 0.88);
  if (ratio <= 1.05) return interpolar(ratio, 1, 1.05, 0.6, 0.45);
  if (ratio <= 1.15) return interpolar(ratio, 1.05, 1.15, 0.4, 0.2);
  return interpolar(ratio, 1.15, 1.25, 0.15, 0.05);
}

function valorMensual(holguraRel: number): number {
  if (holguraRel >= 0.15) return 1;
  if (holguraRel >= 0.05) return interpolar(holguraRel, 0.05, 0.15, 0.8, 1);
  if (holguraRel >= 0) return interpolar(holguraRel, 0, 0.05, 0.55, 0.8);
  // Pasarse de la mensualidad es un límite duro: el castigo es fuerte incluso
  // cuando el exceso es pequeño.
  if (holguraRel >= -0.05) return 0.15;
  return 0.03;
}

function valorPagoInicial(ratio: number): number {
  if (ratio <= 0.7) return 1;
  if (ratio <= 1) return interpolar(ratio, 0.7, 1, 1, 0.85);
  // Más negociable que la mensualidad (se puede reunir más efectivo), así que
  // penaliza fuerte pero no lleva tope.
  if (ratio <= 1.15) return 0.28;
  return 0.08;
}

/** Interpolación lineal entre dos puntos, acotada a los extremos. */
function interpolar(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  if (x1 === x0) return y1;
  const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  return y0 + (y1 - y0) * t;
}

function razonCorta(
  score: number | null,
  contras: string[],
  confianza: Confianza,
  descartada: boolean,
  motivoDescarte: string | null,
  hayConflicto: boolean,
  excedeMensual: boolean,
): string {
  if (descartada && motivoDescarte) return `Descartada: ${motivoDescarte}.`;
  if (score === null) {
    return "No hay datos suficientes en el texto pegado para compararla.";
  }
  if (hayConflicto) {
    return "Parece contradecir una restricción del cliente: confírmalo antes de presentarla.";
  }
  if (excedeMensual) {
    return "Se pasa de la cuota mensual que puso el cliente: solo tiene sentido si acepta subir ese tope.";
  }

  const base =
    score >= 8.5
      ? "Encaje muy alto con lo que pidió."
      : score >= 7.5
        ? "Buen encaje, con detalles menores a revisar."
        : score >= 6
          ? "Encaje razonable, con concesiones que conviene comentar."
          : score >= 4.5
            ? "Encaje parcial: revisa si las concesiones son aceptables."
            : "Se aleja de varios requisitos importantes.";

  if (confianza === "baja") {
    return `${base} Ojo: la ficha trae pocos datos, así que el score es poco fiable.`;
  }
  if (confianza === "media" && contras.length === 0) {
    return `${base} Faltan datos en la ficha para afinar más.`;
  }
  return base;
}

// ─── Restricciones ───────────────────────────────────────────────────────────

export type Prohibicion = { original: string; palabras: string[] };

/** Palabras sin contenido propio, que no sirven para detectar un conflicto. */
const VACIAS = new Set([
  "no", "ni", "sin", "que", "de", "del", "la", "el", "los", "las", "un", "una",
  "unos", "unas", "con", "para", "por", "en", "y", "o", "al", "su", "sus", "muy",
  "mas", "menos", "se", "lo", "le", "es", "ser", "estar", "acepta", "quiere",
  "desea", "gusta", "descarta", "evitar", "nada", "pero", "tampoco", "cliente",
]);

/**
 * Convierte una restricción en texto libre en palabras buscables.
 *
 * "no acepta planta alta sin elevador" → ["planta", "alta", "elevador"].
 * Se conserva el texto original para poder citarlo tal cual al broker.
 */
export function extraerProhibiciones(texto: string | null): Prohibicion[] {
  if (!texto?.trim()) return [];

  return texto
    .split(/[;.]|\by\b/)
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 3)
    .map((parte) => ({
      original: parte,
      palabras: normalizar(parte)
        .split(/[^a-z0-9ñ]+/)
        .filter((p) => p.length > 2 && !VACIAS.has(p)),
    }))
    .filter((p) => p.palabras.length > 0);
}

/**
 * Devuelve las palabras que coinciden, o `null` si no hay conflicto.
 *
 * Una prohibición de una sola palabra ("sin mascotas") basta con que aparezca.
 * Con varias se exigen dos coincidencias: así "planta baja" no dispara la
 * restricción "no acepta planta alta", que comparte la palabra "planta".
 */
export function detectarConflicto(
  prohibicion: Prohibicion,
  textoPropiedad: string,
): string[] | null {
  const encontradas = prohibicion.palabras.filter((p) =>
    new RegExp(`\\b${p}`, "i").test(textoPropiedad),
  );

  const minimo = prohibicion.palabras.length === 1 ? 1 : 2;
  return encontradas.length >= minimo ? encontradas : null;
}

function pct(fraccion: number): string {
  return `${Math.round(fraccion * 100)}%`;
}
