import {
  analizarDocumentos,
  type AnalisisDocumentos,
} from "@/lib/demo/documentos";
import { evaluar, type Evaluacion } from "@/lib/demo/evaluar";
import {
  area,
  enumerar,
  frase,
  minusculaInicial,
  moneda,
  SIN_DATO,
} from "@/lib/demo/formato";
import {
  normalizar,
  parseCliente,
  parsePropiedades,
  type Cliente,
  type Propiedad,
} from "@/lib/demo/parse";

export type EntradaDemo = {
  datosCliente: string;
  propiedades: string;
  documentos?: string;
};

/** Máximo de propiedades en el top, según el formato del system prompt (3 a 5). */
const MAX_RECOMENDADAS = 5;

/**
 * Construye la respuesta del modo DEMO a partir del texto que pegó el broker.
 *
 * No usa ninguna API: lee los dos textareas, puntúa cada propiedad contra los
 * requisitos del cliente y arma las 6 secciones del formato obligatorio con
 * esos datos. Donde no hay información suficiente lo dice en lugar de
 * inventarla; un modelo real sí razonaría sobre lo que aquí falta.
 */
export function construirRespuestaDemo(entrada: EntradaDemo): string {
  const cliente = parseCliente(entrada.datosCliente);
  const propiedades = parsePropiedades(entrada.propiedades);
  const documentos = analizarDocumentos(entrada.documentos);
  const evaluaciones = propiedades.map((p) => evaluar(p, cliente, documentos));

  const recomendadas = evaluaciones
    .filter((e) => !e.descartada)
    .sort(porScoreDescendente)
    .slice(0, MAX_RECOMENDADAS);

  const descartadas = evaluaciones.filter((e) => e.descartada);

  return [
    aviso(),
    seccion1(cliente, propiedades, documentos),
    seccion2(recomendadas, descartadas),
    seccion3(recomendadas),
    seccion4(recomendadas),
    seccion5(recomendadas, cliente, documentos),
    seccion6(recomendadas, cliente),
  ].join("\n\n");
}

function porScoreDescendente(a: Evaluacion, b: Evaluacion): number {
  if (a.score === null && b.score === null) return 0;
  if (a.score === null) return 1;
  if (b.score === null) return -1;
  return b.score - a.score;
}

function aviso(): string {
  return [
    "> **Modo Demo.** Este análisis se generó localmente a partir del texto que pegaste,",
    "> sin llamar a ninguna API. Las puntuaciones salen de comparar campo por campo",
    "> tus datos con los de cada propiedad, y bajan cuando la ficha trae pocos datos:",
    "> por eso verás una **confianza** junto a cada score y ningún 10/10.",
    "> Con la API real, Claude razonaría sobre matices que este cálculo no ve",
    "> (estado del inmueble, plusvalía, contexto de la zona, contenido de los documentos).",
  ].join("\n");
}

// ─── 1. Resumen de requisitos del cliente ───────────────────────────────────

function seccion1(
  cliente: Cliente,
  propiedades: Propiedad[],
  documentos: AnalisisDocumentos,
): string {
  const quien = cliente.nombreCompleto ?? "El cliente";
  const busca = [
    cliente.tipoPropiedad?.toLowerCase() ?? "propiedad",
    cliente.zonas.length > 0
      ? `en ${cliente.zonas.join(" o ")}`
      : cliente.destino
        ? `en ${cliente.destino}`
        : null,
  ]
    .filter(Boolean)
    .join(" ");

  const lineas: string[] = [
    "## 1. Resumen de requisitos del cliente",
    "",
    `**${quien}** busca ${busca}.`,
    "",
  ];

  const requisitos: string[] = [];
  if (cliente.habitaciones !== null)
    requisitos.push(`${cliente.habitaciones} habitaciones`);
  if (cliente.banos !== null) requisitos.push(`${cliente.banos} baños`);
  if (cliente.areaMin !== null || cliente.areaMax !== null) {
    requisitos.push(
      cliente.areaMin !== null && cliente.areaMax !== null
        ? `entre ${cliente.areaMin} y ${area(cliente.areaMax)}`
        : `desde ${area(cliente.areaMin ?? cliente.areaMax)}`,
    );
  }
  if (requisitos.length > 0) {
    lineas.push(`- **Requisitos:** ${enumerar(requisitos)}.`);
  }

  if (cliente.presupuestoMin !== null || cliente.presupuestoMax !== null) {
    lineas.push(
      `- **Presupuesto:** ${
        cliente.presupuestoMin !== null && cliente.presupuestoMax !== null
          ? `de ${moneda(cliente.presupuestoMin)} a ${moneda(cliente.presupuestoMax)}`
          : `hasta ${moneda(cliente.presupuestoMax ?? cliente.presupuestoMin)}`
      }.`,
    );
  }

  const finanzas: string[] = [];
  if (cliente.mensualMax !== null)
    finanzas.push(`cuota mensual máxima de ${moneda(cliente.mensualMax)}`);
  if (cliente.pagoInicial !== null)
    finanzas.push(`${moneda(cliente.pagoInicial)} de pago inicial disponible`);
  if (cliente.preaprobacion !== null)
    finanzas.push(`preaprobación por ${moneda(cliente.preaprobacion)}`);
  if (finanzas.length > 0) {
    lineas.push(`- **Capacidad de pago:** ${enumerar(finanzas)}.`);
  }

  if (cliente.caracteristicas.length > 0) {
    lineas.push(`- **Desea:** ${enumerar(cliente.caracteristicas)}.`);
  }
  if (cliente.restricciones) {
    lineas.push(`- **Restricciones:** ${cliente.restricciones}.`);
  }

  // Coherencia entre preaprobación + enganche y el techo del presupuesto.
  if (cliente.preaprobacion !== null && cliente.pagoInicial !== null) {
    const capacidad = cliente.preaprobacion + cliente.pagoInicial;
    lineas.push(
      "",
      `Preaprobación y pago inicial suman **${moneda(capacidad)}**, que es el techo real de compra${
        cliente.presupuestoMax !== null
          ? capacidad < cliente.presupuestoMax
            ? `, por debajo del presupuesto declarado de ${moneda(cliente.presupuestoMax)}. Conviene revisarlo antes de mostrar opciones caras.`
            : `, en línea con el presupuesto declarado.`
          : "."
      }`,
    );
  }

  lineas.push(
    "",
    `Del listado que pegaste leí **${propiedades.length} ${propiedades.length === 1 ? "propiedad" : "propiedades"}**.`,
  );

  const faltantes = camposFaltantes(cliente);
  if (faltantes.length > 0) {
    lineas.push(
      "",
      `*No pude identificar en el texto: ${enumerar(faltantes)}. Si los agregas con el formato "Etiqueta: valor", el análisis mejora.*`,
    );
  }

  lineas.push(...bloqueDocumentos(documentos, cliente));

  return lineas.join("\n");
}

/** Lo que se pudo sacar del textarea de Documentos. */
function bloqueDocumentos(
  documentos: AnalisisDocumentos,
  cliente: Cliente,
): string[] {
  if (documentos.vacio) return [];

  const lineas = ["", "### Señales detectadas en los documentos", ""];

  if (documentos.temas.length > 0) {
    lineas.push(`- **Temas:** ${enumerar(documentos.temas)}.`);
  }

  if (documentos.montos.length > 0) {
    lineas.push(
      `- **Cantidades mencionadas:** ${documentos.montos.map((m) => moneda(m)).join(", ")}.`,
    );

    // Un monto por encima del presupuesto declarado suele ser una señal útil.
    const mayor = documentos.montos[0];
    if (cliente.presupuestoMax !== null && mayor > cliente.presupuestoMax) {
      lineas.push(
        `- ⚠️ La cantidad más alta de los documentos (${moneda(mayor)}) supera el presupuesto declarado (${moneda(cliente.presupuestoMax)}). Vale la pena revisar cuál de los dos está desactualizado.`,
      );
    }
  }

  if (documentos.senales.length > 0) {
    lineas.push("", "**Frases del cliente que conviene tener presentes:**", "");
    for (const senal of documentos.senales) lineas.push(`> ${senal}`);
  }

  if (
    documentos.temas.length === 0 &&
    documentos.montos.length === 0 &&
    documentos.senales.length === 0
  ) {
    lineas.push(
      `Esto es lo que recibí:`,
      "",
      `> ${documentos.extracto}`,
      "",
      `No reconocí en ese texto ningún tema, cantidad ni preferencia explícita, así que no influyó en las puntuaciones. Frases del tipo “no quiere…”, “prefiere…” o “necesita…” sí se detectan.`,
    );
  }

  lineas.push(
    "",
    "*El modo demo solo detecta palabras clave y frases con intención. Leer el documento de verdad es lo que aportará el modelo real.*",
  );

  return lineas;
}

function camposFaltantes(cliente: Cliente): string[] {
  const faltantes: string[] = [];
  if (!cliente.nombreCompleto) faltantes.push("el nombre del cliente");
  if (cliente.presupuestoMax === null) faltantes.push("el presupuesto");
  if (cliente.zonas.length === 0) faltantes.push("la zona preferida");
  if (cliente.habitaciones === null) faltantes.push("el número de habitaciones");
  if (cliente.mensualMax === null) faltantes.push("la cuota mensual máxima");
  return faltantes;
}

// ─── 2. Top propiedades recomendadas ────────────────────────────────────────

function seccion2(
  recomendadas: Evaluacion[],
  descartadas: Evaluacion[],
): string {
  const lineas = ["## 2. Top propiedades recomendadas", ""];

  if (recomendadas.length === 0) {
    lineas.push(
      "Ninguna de las propiedades del listado alcanza los requisitos del cliente.",
      "",
      "Conviene ampliar la búsqueda antes de presentarle opciones.",
    );
  } else {
    recomendadas.forEach((evaluacion, indice) => {
      lineas.push(
        `${indice + 1}. **${evaluacion.propiedad.titulo}** — Score **${formatearScore(evaluacion.score)}** (confianza ${evaluacion.confianza}). ${evaluacion.razonCorta}`,
      );
    });
  }

  if (descartadas.length > 0) {
    lineas.push(
      "",
      `**Descartadas (${descartadas.length}):** ${descartadas
        .map((e) => `${e.propiedad.titulo} — ${e.motivoDescarte}`)
        .join("; ")}.`,
    );
  }

  return lineas.join("\n");
}

function formatearScore(score: number | null): string {
  return score === null ? "sin datos" : `${score.toFixed(1)}/10`;
}

// ─── 3. Análisis detallado ──────────────────────────────────────────────────

function seccion3(recomendadas: Evaluacion[]): string {
  const lineas = ["## 3. Análisis detallado de cada propiedad recomendada", ""];

  if (recomendadas.length === 0) {
    lineas.push(
      "Sin propiedades recomendadas, no hay análisis que hacer. Agrega opciones que se acerquen a los requisitos y vuelve a generar.",
    );
    return lineas.join("\n");
  }

  recomendadas.forEach((evaluacion, indice) => {
    const { propiedad, pros, contras } = evaluacion;

    lineas.push(
      `### ${indice + 1}. ${propiedad.titulo}${propiedad.precio !== null ? ` — ${moneda(propiedad.precio)}` : ""}`,
      "",
    );

    if (pros.length > 0) {
      lineas.push("**Pros**", "");
      pros.forEach((pro) => lineas.push(`- ${pro}`));
      lineas.push("");
    }

    if (contras.length > 0) {
      lineas.push("**Contras**", "");
      contras.forEach((contra) => lineas.push(`- ${contra}`));
      lineas.push("");
    }

    if (pros.length === 0 && contras.length === 0) {
      lineas.push(
        "No hay datos comparables en el texto pegado. Esto es lo que se registró:",
        "",
        "```",
        propiedad.bruto.trim(),
        "```",
        "",
      );
    }

    lineas.push(veredicto(evaluacion), "");
  });

  return lineas.join("\n").trimEnd();
}

function veredicto(evaluacion: Evaluacion): string {
  const { score, contras, fueraDeZona, conflictos } = evaluacion;

  if (score === null) {
    return "**Cumplimiento:** no evaluable con la información disponible.";
  }
  // El conflicto con una restricción pesa más que cualquier otra observación.
  if (conflictos.length > 0) {
    return "**Atención:** parece contradecir una restricción explícita del cliente. Confírmalo antes de incluirla en cualquier propuesta; por eso queda fuera del email.";
  }
  if (score >= 8.5 && contras.length === 0) {
    return "**Cumplimiento:** completo. No exige ceder en nada ni salirse del presupuesto.";
  }
  if (fueraDeZona) {
    return "**¿Vale la pena salirse de la zona preferida?** Solo si el ahorro o las características compensan el cambio de ubicación. Preséntala como alternativa, no como recomendación principal.";
  }
  if (score >= 7) {
    return "**Cumplimiento:** alto en lo esencial, con las concesiones menores que se listan arriba.";
  }
  return "**Cumplimiento:** parcial. Vale la pena solo si el cliente flexibiliza alguno de sus requisitos.";
}

// ─── 4. Tabla comparativa ───────────────────────────────────────────────────

function seccion4(recomendadas: Evaluacion[]): string {
  const lineas = ["## 4. Tabla comparativa", ""];

  if (recomendadas.length === 0) {
    lineas.push("No hay propiedades recomendadas que comparar.");
    return lineas.join("\n");
  }

  lineas.push(
    "| Propiedad | Precio | Ubicación | Habitaciones | Baños | Área | Pago mensual estimado | Score | Principales ventajas |",
    "|---|---|---|---|---|---|---|---|---|",
  );

  for (const evaluacion of recomendadas) {
    const p = evaluacion.propiedad;
    lineas.push(
      "| " +
        [
          celda(p.titulo),
          moneda(p.precio),
          celda(ubicacionParaMostrar(evaluacion)) +
            (evaluacion.fueraDeZona ? " ⚠️" : ""),
          p.habitaciones ?? SIN_DATO,
          p.banos ?? SIN_DATO,
          area(p.area),
          moneda(p.mensual),
          formatearScore(evaluacion.score),
          ventajaPrincipal(evaluacion),
        ].join(" | ") +
        " |",
    );
  }

  const notas: string[] = [];
  if (recomendadas.some((e) => e.fueraDeZona)) {
    notas.push("⚠️ fuera de la zona preferida por el cliente.");
  }

  const pocaConfianza = recomendadas.filter((e) => e.confianza !== "alta");
  if (pocaConfianza.length > 0) {
    notas.push(
      `Confianza del score por ficha: ${pocaConfianza
        .map((e) => `${e.propiedad.titulo} (${e.confianza})`)
        .join(", ")}. Cuantos menos campos trae una ficha, menos fiable es su score.`,
    );
  }

  for (const nota of notas) lineas.push("", nota);

  return lineas.join("\n");
}

/**
 * Ubicación a mostrar en la tabla: la zona preferida que coincidió, si la hubo.
 *
 * `propiedad.ubicacion` es la colonia, el municipio o el estado, por ese orden.
 * Cuando la zona viene en la calle ("Av. El Refugio 120") la celda acababa
 * mostrando solo "Querétaro", que no le dice nada al broker que busca en El
 * Refugio.
 */
function ubicacionParaMostrar(evaluacion: Evaluacion): string {
  const { zona, propiedad } = evaluacion;

  if (zona && zona.confianza !== "cercania") {
    const contexto = propiedad.municipio ?? propiedad.estado;
    const aporta =
      contexto &&
      !normalizar(contexto).includes(normalizar(zona.zona)) &&
      !normalizar(zona.zona).includes(normalizar(contexto));
    return aporta ? `${zona.zona} (${contexto})` : zona.zona;
  }

  return propiedad.ubicacion ?? SIN_DATO;
}

/** Evita que un `|` dentro del texto rompa la tabla markdown. */
function celda(texto: string): string {
  return texto.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

/**
 * Ventajas cortas para la celda de la tabla.
 *
 * Reciclar los `pros` daba celdas cortadas a mitad de cifra y, peor, idénticas
 * entre filas ("3 habitaciones, cumple las 3 solicitadas" en todas), que es lo
 * contrario de lo que sirve en una comparativa.
 */
function ventajaPrincipal(evaluacion: Evaluacion): string {
  if (evaluacion.etiquetas.length > 0) {
    return celda(evaluacion.etiquetas.slice(0, 2).join(" · "));
  }
  const pro = evaluacion.pros[0];
  return pro ? celda(frase(pro)) : "Sin datos suficientes";
}

// ─── 5. Explicación final y recomendación ───────────────────────────────────

function seccion5(
  recomendadas: Evaluacion[],
  cliente: Cliente,
  documentos: AnalisisDocumentos,
): string {
  const lineas = ["## 5. Explicación final y recomendación", ""];
  const quien = cliente.primerNombre ?? "el cliente";

  if (recomendadas.length === 0) {
    lineas.push(
      `No puedo recomendarle nada a ${quien} con este listado: ninguna opción se acerca lo suficiente a sus requisitos. Antes de contactarle, conviene ampliar la búsqueda o revisar con él qué criterios está dispuesto a flexibilizar.`,
    );
    return lineas.join("\n");
  }

  const [mejor, segunda] = recomendadas;

  lineas.push(
    `Mi recomendación principal es **${mejor.propiedad.titulo}**${mejor.propiedad.precio !== null ? ` (${moneda(mejor.propiedad.precio)})` : ""}.`,
    "",
  );

  if (mejor.pros.length > 0) {
    lineas.push("Es la opción con mejor equilibrio del listado:", "");
    for (const pro of mejor.pros.slice(0, 3)) lineas.push(`- ${frase(pro)}.`);
  }

  if (mejor.contras.length > 0) {
    lineas.push(
      "",
      `Lo que hay que vigilar: ${minusculaInicial(frase(mejor.contras[0]))}.`,
    );
  }

  if (segunda) {
    lineas.push(
      "",
      `Como segunda opción está **${segunda.propiedad.titulo}** (score ${formatearScore(segunda.score)}). ${
        segunda.contras.length > 0
          ? `Su punto débil: ${minusculaInicial(frase(segunda.contras[0]))}.`
          : "Es una alternativa sólida si la primera no convence en la visita."
      }`,
    );
  }

  const fuera = recomendadas.filter((e) => e.fueraDeZona);
  if (fuera.length > 0) {
    lineas.push(
      "",
      `Ten presente que ${fuera.length === 1 ? "una de las opciones queda" : `${fuera.length} opciones quedan`} fuera de la zona que ${quien} pidió (${fuera.map((e) => e.propiedad.titulo).join(", ")}). Menciónalo con claridad: es el tipo de concesión que conviene que decida el cliente, no nosotros.`,
    );
  }

  const conConflicto = recomendadas.filter((e) => e.conflictos.length > 0);
  if (conConflicto.length > 0) {
    lineas.push(
      "",
      `${conConflicto.length === 1 ? "Una opción parece contradecir" : `${conConflicto.length} opciones parecen contradecir`} una restricción que ${quien} puso (${conConflicto.map((e) => e.propiedad.titulo).join(", ")}), así que **${conConflicto.length === 1 ? "la dejé fuera del email" : "las dejé fuera del email"}**. El cruce es por texto y puede equivocarse: si al revisarla ves que la restricción no aplica, añádela a mano.`,
    );
  }

  // Los documentos son notas internas: se recuerdan aquí, al broker, y nunca
  // se citan en el email al cliente.
  if (!documentos.vacio) {
    const senal = documentos.senales[0];
    lineas.push(
      "",
      senal
        ? `Antes de presentarla, repasa lo que anotaste en los documentos —“${frase(senal)}”${documentos.senales.length > 1 ? ` y ${documentos.senales.length - 1} señal(es) más` : ""}—: son cosas que el cliente ya te dijo y conviene que veas reflejadas en la propuesta.`
        : `Pegaste documentación adicional; el modo demo no la interpreta, así que repásala tú antes de presentar esta opción.`,
    );
  }

  return lineas.join("\n");
}

// ─── 6. Email para el cliente ───────────────────────────────────────────────

function seccion6(todas: Evaluacion[], cliente: Cliente): string {
  const saludo = `Hola ${cliente.primerNombre ?? ""},`.replace(" ,", ",");
  const destino = cliente.destino ? ` en ${cliente.destino}` : "";
  const tipo = cliente.tipoPropiedad?.toLowerCase() ?? "propiedad";

  // Este texto va al cliente: una propiedad que contradice una restricción que
  // él mismo puso no se le ofrece. Sigue apareciendo en el análisis, para que
  // el broker decida con la información delante.
  const recomendadas = todas.filter((e) => e.conflictos.length === 0);
  const omitidas = todas.length - recomendadas.length;

  const lineas = [
    "## 6. Email para el cliente",
    "",
    `Asunto: ${recomendadas.length > 0 ? `${recomendadas.length === 1 ? "Una opción" : `${recomendadas.length} opciones`} de ${tipo}${destino} para ti` : `Seguimiento de tu búsqueda de ${tipo}${destino}`}`,
    "",
    saludo,
    "",
  ];

  if (recomendadas.length === 0 && omitidas > 0) {
    lineas.push(
      `Espero que estés muy bien. Revisé las propiedades disponibles con tus requisitos en mano y, siendo honesto/a contigo, ${omitidas === 1 ? "la única que se acerca choca" : "las que se acercan chocan"} con algo que me dijiste que no querías.`,
      "",
      "Prefiero confirmarlo contigo antes de hacerte perder tiempo en una visita. Mientras tanto sigo buscando opciones que encajen del todo.",
      "",
      "¿Te parece si lo vemos en una llamada corta esta semana?",
      "",
      "Quedo pendiente de tu respuesta.",
      "",
      "Un saludo cordial,",
    );
    return lineas.join("\n");
  }

  if (recomendadas.length === 0) {
    lineas.push(
      "Espero que estés muy bien. Estuve revisando las propiedades disponibles con tus requisitos en mano y, siendo honesto/a contigo, ninguna de las que tengo ahora mismo se acerca lo suficiente a lo que buscas.",
      "",
      "Prefiero decírtelo antes que hacerte perder tiempo en visitas que no valen la pena. Ya amplié la búsqueda y te escribo en cuanto tenga opciones que de verdad encajen.",
      "",
      "¿Te parece si agendamos una llamada corta para revisar juntos qué criterios podríamos ajustar? A veces mover un poco la zona o el rango de precio abre opciones muy buenas.",
      "",
      "Quedo pendiente de tu respuesta.",
      "",
      "Un saludo cordial,",
    );
    return lineas.join("\n");
  }

  lineas.push(
    `Espero que estés muy bien. Después de revisar con calma lo que buscas y las propiedades disponibles${destino}, preparé una selección con ${recomendadas.length === 1 ? "la opción que mejor encaja" : `las ${recomendadas.length} opciones que mejor encajan`} con lo que me comentaste.`,
    "",
    "Estas son las que destacan:",
    "",
  );

  for (const evaluacion of recomendadas.slice(0, 4)) {
    const p = evaluacion.propiedad;
    const detalles = fichaCorta(p);
    lineas.push(
      `- **${p.titulo}**${p.precio !== null ? ` — ${moneda(p.precio)}` : ""}${detalles ? `. ${detalles}` : ""}${p.mensual !== null ? `. Pago mensual estimado de ${moneda(p.mensual)}` : ""}.`,
    );
  }

  const mejor = recomendadas[0];
  lineas.push(
    "",
    `${
      recomendadas.length === 1
        ? `Mi recomendación es **${mejor.propiedad.titulo}**`
        : `Si tuviera que quedarme con una, sería **${mejor.propiedad.titulo}**`
    }. ${
      mejor.pros.length > 0
        ? `Es la que mejor equilibra lo que buscas: ${mejor.pros
            .slice(0, 2)
            .map((pro) => minusculaInicial(frase(pro)))
            .join("; ")}.`
        : "Es la que mejor equilibra lo que me comentaste."
    }`,
  );

  const fuera = recomendadas.find((e) => e.fueraDeZona);
  if (fuera) {
    lineas.push(
      "",
      `Te incluyo también **${fuera.propiedad.titulo}** aunque queda fuera de la zona que me mencionaste, porque en lo demás cumple bien y creo que merece que la veas antes de descartarla.`,
    );
  }

  lineas.push(
    "",
    "¿Te parece si agendamos una visita para ver dos o tres de ellas? También podemos empezar con una llamada de 15 minutos para afinar la lista. Dime qué días te acomodan y yo coordino todo.",
    "",
    "Quedo pendiente de tu respuesta.",
    "",
    "Un saludo cordial,",
  );

  return lineas.join("\n");
}

/** "165 m², 3 habitaciones, 2.5 baños" con lo que haya. */
function fichaCorta(propiedad: Propiedad): string {
  const partes: string[] = [];
  if (propiedad.area !== null) partes.push(area(propiedad.area));
  if (propiedad.habitaciones !== null)
    partes.push(`${propiedad.habitaciones} habitaciones`);
  if (propiedad.banos !== null) partes.push(`${propiedad.banos} baños`);
  return partes.join(", ");
}
