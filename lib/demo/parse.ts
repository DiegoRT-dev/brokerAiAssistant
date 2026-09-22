/**
 * Lectura heurística del texto libre que pega el broker.
 *
 * No es un parser estricto: el broker pega lo que tiene a mano, así que todo
 * campo puede faltar. Cada función devuelve `null` cuando no encuentra el dato
 * en lugar de inventarlo, y el generador de la demo se encarga de decir
 * claramente qué no pudo leer.
 */

export type Cliente = {
  nombreCompleto: string | null;
  primerNombre: string | null;
  destino: string | null;
  tipoPropiedad: string | null;
  zonas: string[];
  presupuestoMin: number | null;
  presupuestoMax: number | null;
  habitaciones: number | null;
  banos: number | null;
  areaMin: number | null;
  areaMax: number | null;
  mensualMax: number | null;
  pagoInicial: number | null;
  preaprobacion: number | null;
  caracteristicas: string[];
  restricciones: string | null;
};

export type Propiedad = {
  titulo: string;
  bruto: string;
  tipo: string | null;
  /** Etiqueta de ubicación para mostrar; la más específica de las de abajo. */
  ubicacion: string | null;
  // Campos de ubicación por separado: `lib/demo/zonas.ts` los necesita
  // distinguidos para saber si una zona aparece como dirección real o solo
  // mencionada de pasada en la descripción.
  colonia: string | null;
  municipio: string | null;
  estado: string | null;
  calle: string | null;
  precio: number | null;
  habitaciones: number | null;
  banos: number | null;
  area: number | null;
  mensual: number | null;
  pagoInicial: number | null;
  caracteristicas: string[];
};

/** Minúsculas y sin acentos, para comparar etiquetas escritas de cualquier forma. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Convierte a número las formas más comunes en que se escribe una cantidad:
 * "3,500,000", "3.5 millones", "4.2M", "$3,900,000 MXN", "165".
 */
export function parseNumero(bruto: string | null | undefined): number | null {
  if (!bruto) return null;

  // "4.2M" / "3.9 M" — la M mayúscula evita confundirlo con "165 m2".
  const abreviado = /(\d+(?:[.,]\d+)?)\s*M(?![a-zA-Z0-9²])/.exec(bruto);
  if (abreviado) {
    const n = Number(abreviado[1].replace(",", "."));
    if (Number.isFinite(n)) return Math.round(n * 1_000_000);
  }

  const s = normalizar(bruto)
    .replace(/\b(mxn|mn|pesos|usd|aprox|aproximadamente)\b/g, "")
    .replace(/\$/g, "")
    .trim();

  const millones = /(\d+(?:[.,]\d+)?)\s*(?:millones?|mdp|mill\.?)/.exec(s);
  if (millones) {
    const n = Number(millones[1].replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : null;
  }

  const encontrado = /(\d[\d.,]*)/.exec(s);
  return encontrado ? limpiarSeparadores(encontrado[1]) : null;
}

/** Resuelve si `,` y `.` son separador de miles o decimal. */
function limpiarSeparadores(bruto: string): number | null {
  let s = bruto.replace(/\s/g, "").replace(/[.,]$/, "");
  const coma = s.includes(",");
  const punto = s.includes(".");

  if (coma && punto) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (coma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (punto && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  const valor = Number(s);
  return Number.isFinite(valor) ? valor : null;
}

/** Lee un rango: "3,500,000 - 4,200,000", "de 140 a 200 m2", "3.5 a 4.2 millones". */
export function parseRango(
  bruto: string | null,
): [number | null, number | null] {
  if (!bruto) return [null, null];

  const enMillones = /millones?|mdp/i.test(bruto);
  const partes = bruto
    .split(/\s*(?:-|–|—|\ba\b|\bhasta\b|\bentre\b)\s*/i)
    .filter((parte) => /\d/.test(parte));

  const numeros = partes
    .map((parte) => {
      const n = parseNumero(parte);
      // "3.5 a 4.2 millones": el sufijo va al final y aplica a ambos extremos.
      return n !== null && enMillones && n < 1000 ? n * 1_000_000 : n;
    })
    .filter((n): n is number => n !== null);

  if (numeros.length === 0) return [null, null];
  if (numeros.length === 1) return [null, numeros[0]];
  return [Math.min(...numeros), Math.max(...numeros)];
}

/**
 * Busca un campo "Etiqueta: valor" y devuelve el valor.
 *
 * Una línea puede traer varios campos separados por "|", que es justo el
 * formato que el placeholder de la app le propone al usuario:
 *
 *     Estado: Querétaro | Municipio: Querétaro | CP: 76230
 *
 * Cortando solo por el primer ":" se perdían todos los campos menos el primero
 * —incluidos pago mensual, pago inicial y baños—, así que cada línea se parte
 * antes en segmentos.
 */
export function campo(texto: string, etiquetas: string[]): string | null {
  const objetivos = etiquetas.map(normalizar);

  for (const linea of texto.split(/\r?\n/)) {
    for (const segmento of linea.split(/\s*[|·]\s*/)) {
      const corte = segmento.indexOf(":");
      if (corte === -1) continue;

      const clave = normalizar(segmento.slice(0, corte)).replace(
        /^[-*•\d).\s]+/,
        "",
      );
      const valor = segmento.slice(corte + 1).trim();
      if (!valor) continue;

      if (objetivos.some((objetivo) => clave.includes(objetivo))) return valor;
    }
  }
  return null;
}

/** Primer patrón que haga match en todo el texto, ya normalizado. */
function buscar(texto: string, patron: RegExp): string | null {
  const encontrado = patron.exec(normalizar(texto));
  return encontrado ? encontrado[1] : null;
}

function listar(bruto: string | null): string[] {
  if (!bruto) return [];
  return bruto
    .split(/\s*(?:,|;|\/|\bo\b|\by\b)\s*/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

export function parseCliente(texto: string): Cliente {
  const nombre = campo(texto, ["nombre completo", "nombres", "nombre"]);
  const apellidos = campo(texto, ["apellidos", "apellido"]);

  const nombreCompleto =
    [nombre, apellidos].filter(Boolean).join(" ").trim() || nombreSuelto(texto);

  const [presupuestoMin, presupuestoMax] = parseRango(
    campo(texto, ["presupuesto min-max", "presupuesto", "rango de precio"]),
  );
  const [areaMin, areaMax] = parseRango(
    campo(texto, ["area min-max", "area", "superficie", "metros"]),
  );

  return {
    nombreCompleto: nombreCompleto || null,
    primerNombre: nombreCompleto ? nombreCompleto.split(/\s+/)[0] : null,
    destino: campo(texto, ["ubicacion destino", "ciudad destino", "destino"]),
    tipoPropiedad: campo(texto, [
      "tipo de propiedad deseada",
      "tipo de propiedad",
      "tipo de inmueble",
    ]),
    zonas: listar(
      campo(texto, [
        "ubicacion preferida",
        "zona preferida",
        "zonas preferidas",
        "colonias preferidas",
        "colonia preferida",
      ]),
    ),
    presupuestoMin,
    presupuestoMax,
    habitaciones: parseNumero(
      campo(texto, [
        "numero de habitaciones",
        "habitaciones",
        "recamaras",
        "cuartos",
        "dormitorios",
      ]),
    ),
    banos: parseNumero(campo(texto, ["numero de banos", "banos"])),
    areaMin,
    areaMax,
    mensualMax: parseNumero(
      campo(texto, [
        "cuota mensual maxima",
        "pago mensual maximo",
        "mensualidad maxima",
        "cuota mensual",
      ]),
    ),
    pagoInicial: parseNumero(
      campo(texto, ["pago inicial disponible", "enganche", "pago inicial"]),
    ),
    preaprobacion: parseNumero(
      campo(texto, [
        "monto de preaprobacion",
        "preaprobacion de credito",
        "preaprobacion",
        "preaprobado",
      ]),
    ),
    caracteristicas: listar(
      campo(texto, ["caracteristicas deseadas", "caracteristicas"]),
    ),
    restricciones: campo(texto, ["restricciones", "restriccion"]),
  };
}

/** Si no hay etiqueta "Nombre:", usa la primera línea si parece un nombre propio. */
function nombreSuelto(texto: string): string | null {
  const primera = texto.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim();
  if (!primera || primera.includes(":") || /\d/.test(primera)) return null;

  const palabras = primera.split(/\s+/);
  if (palabras.length > 4) return null;
  return /^[\p{L}\s.'-]+$/u.test(primera) ? primera : null;
}

export function parsePropiedades(texto: string): Propiedad[] {
  return dividirBloques(texto).map(parsePropiedad);
}

function dividirBloques(texto: string): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];

  let bloques = limpio
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Un solo bloque puede ser en realidad una lista numerada sin líneas en blanco.
  if (bloques.length === 1) {
    const porMarcador = partirPorMarcador(limpio);
    if (porMarcador.length > 1) bloques = porMarcador;
  }

  // Y un bloque con varios "Precio:" son varias propiedades pegadas juntas.
  return bloques.flatMap((bloque) =>
    (normalizar(bloque).match(/precio\s*:/g) ?? []).length > 1
      ? partirPorMarcador(bloque)
      : [bloque],
  );
}

function partirPorMarcador(texto: string): string[] {
  return texto
    .split(/\n(?=\s*(?:\d+\s*[).\-]|[-*•])\s+)/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function parsePropiedad(bloque: string, indice: number): Propiedad {
  const primeraLinea = bloque
    .split(/\r?\n/)[0]
    .replace(/^\s*(?:\d+\s*[).\-]|[-*•])\s*/, "")
    .trim();

  const colonia = campo(bloque, [
    "colonia",
    "fraccionamiento",
    "fracc",
    "zona",
    "ubicacion",
  ]);
  const municipio = campo(bloque, ["municipio", "delegacion", "alcaldia"]);
  const estado = campo(bloque, ["estado"]);
  const calle = campo(bloque, ["calle", "direccion"]);

  // De lo más específico a lo más general, para mostrar.
  const ubicacion = colonia ?? municipio ?? estado;
  const tipo = campo(bloque, ["tipo de propiedad", "tipo"]) ?? tipoSuelto(bloque);

  return {
    titulo: construirTitulo({ primeraLinea, calle, ubicacion, tipo, indice }),
    bruto: bloque,
    tipo,
    ubicacion,
    colonia,
    municipio,
    estado,
    calle,
    precio: parseNumero(campo(bloque, ["precio", "valor", "costo"])),
    habitaciones:
      parseNumero(
        campo(bloque, ["cuartos", "recamaras", "habitaciones", "dormitorios"]),
      ) ??
      parseNumero(
        buscar(
          bloque,
          /(\d+)\s*(?:rec\b|recamaras?|hab\b|habitaciones?|cuartos?)/,
        ),
      ),
    banos:
      parseNumero(campo(bloque, ["banos"])) ??
      parseNumero(buscar(bloque, /(\d+(?:[.,]\d+)?)\s*banos?/)),
    area:
      parseNumero(
        campo(bloque, ["area", "superficie", "construccion", "terreno"]),
      ) ??
      parseNumero(buscar(bloque, /(\d+(?:[.,]\d+)?)\s*(?:m2|m²|mts2?|metros)/)),
    mensual: parseNumero(
      campo(bloque, ["pago mensual", "mensualidad", "cuota mensual", "renta"]),
    ),
    pagoInicial: parseNumero(campo(bloque, ["pago inicial", "enganche"])),
    caracteristicas: listar(
      campo(bloque, ["caracteristicas", "amenidades", "incluye"]),
    ),
  };
}

/**
 * Elige el nombre con el que se identificara la propiedad en todo el analisis.
 *
 * La calle y la colonia van primero porque son lo unico realmente distintivo:
 * la primera linea del bloque suele ser generica ("Casa en venta - Disponible")
 * y dejaria varias propiedades con el mismo titulo.
 */
function construirTitulo({
  primeraLinea,
  calle,
  ubicacion,
  tipo,
  indice,
}: {
  primeraLinea: string;
  calle: string | null;
  ubicacion: string | null;
  tipo: string | null;
  indice: number;
}): string {
  if (calle) {
    const incluyeUbicacion =
      ubicacion !== null && normalizar(calle).includes(normalizar(ubicacion));
    return ubicacion && !incluyeUbicacion ? `${calle}, ${ubicacion}` : calle;
  }
  if (ubicacion) return `${tipo ?? "Propiedad"} en ${ubicacion}`;
  if (primeraLinea && !primeraLinea.includes(":")) return primeraLinea;
  return `Propiedad ${indice + 1}`;
}

/** Deduce el tipo cuando no viene etiquetado ("Casa en venta...", "Depto ..."). */
function tipoSuelto(bloque: string): string | null {
  const n = normalizar(bloque);
  if (/\bcasas?\b/.test(n)) return "Casa";
  if (/\b(departamentos?|deptos?|dpto)\b/.test(n)) return "Departamento";
  if (/\bterrenos?\b/.test(n)) return "Terreno";
  if (/\blofts?\b/.test(n)) return "Loft";
  return null;
}
