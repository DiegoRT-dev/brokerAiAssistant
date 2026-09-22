import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analizarDocumentos } from "../lib/demo/documentos.ts";
import { evaluar, extraerProhibiciones } from "../lib/demo/evaluar.ts";
import { construirRespuestaDemo } from "../lib/demo/generar.ts";
import { parseCliente, parseNumero, parsePropiedades, parseRango } from "../lib/demo/parse.ts";
import { coincidirZona, normalizarZona } from "../lib/demo/zonas.ts";
import { extractEmail, splitEmail } from "../lib/extract-email.ts";

const SIN_DOCUMENTOS = analizarDocumentos("");

/** Atajo: evalúa la primera propiedad de un bloque contra unos datos de cliente. */
function evaluarUno(textoCliente, textoPropiedad, textoDocumentos = "") {
  const cliente = parseCliente(textoCliente);
  const propiedad = parsePropiedades(textoPropiedad)[0];
  return evaluar(propiedad, cliente, analizarDocumentos(textoDocumentos));
}

const CLIENTE_BASE = `Nombre: Ana
Apellidos: Ramírez
Tipo de propiedad deseada: Casa
Ubicación preferida: Juriquilla o El Refugio
Presupuesto: 3,000,000 - 4,000,000
Habitaciones: 3
Baños: 2
Área: 140 - 200 m2
Cuota mensual máxima: 28,000
Pago inicial disponible: 900,000
Características deseadas: jardín
Restricciones: no acepta planta alta`;

// ─────────────────────────────────────────────────────────────────────────────
describe("normalización de zonas", () => {
  it("quita el artículo inicial", () => {
    assert.equal(normalizarZona("El Refugio"), "refugio");
  });

  it("quita prefijos de fraccionamiento", () => {
    assert.equal(normalizarZona("Fracc. Zibatá"), "zibata");
    assert.equal(normalizarZona("Col. Del Valle"), "valle");
    assert.equal(normalizarZona("Residencial La Loma"), "loma");
  });

  it("es indiferente a los acentos", () => {
    assert.equal(normalizarZona("Zibatá"), normalizarZona("Zibata"));
  });
});

describe("detección de zona", () => {
  const cliente = parseCliente(CLIENTE_BASE);
  const zonaDe = (texto) =>
    coincidirZona(parsePropiedades(texto)[0], cliente.zonas);

  it("la reconoce en el campo Colonia", () => {
    const zona = zonaDe("Casa\nColonia: Juriquilla\nPrecio: 3,500,000");
    assert.equal(zona?.confianza, "alta");
    assert.equal(zona?.zona, "Juriquilla");
  });

  it('reconoce "Refugio Country" como "El Refugio"', () => {
    const zona = zonaDe("Casa\nFraccionamiento: Refugio Country\nPrecio: 3,500,000");
    assert.equal(zona?.confianza, "alta");
    assert.equal(zona?.zona, "El Refugio");
  });

  it('reconoce "Juriquilla Santa Fe" como "Juriquilla"', () => {
    const zona = zonaDe("Casa\nColonia: Juriquilla Santa Fe\nPrecio: 3,500,000");
    assert.equal(zona?.confianza, "alta");
  });

  it("NO cuenta una mención de cercanía como estar en la zona", () => {
    const zona = zonaDe(
      "Casa\nColonia: El Marqués\nPrecio: 3,500,000\nDescripción: a 10 minutos de Juriquilla",
    );
    assert.equal(zona?.confianza, "cercania");
  });

  it('tampoco con "cerca de" ni "junto a"', () => {
    assert.equal(
      zonaDe("Casa\nColonia: El Marqués\nDescripción: cerca de Juriquilla")?.confianza,
      "cercania",
    );
    assert.equal(
      zonaDe("Casa\nColonia: El Marqués\nDescripción: junto a Juriquilla")?.confianza,
      "cercania",
    );
  });

  it("una mención directa en la descripción da confianza media", () => {
    const zona = zonaDe("Casa en venta\nPrecio: 3,500,000\nDescripción: ubicada en Juriquilla");
    assert.equal(zona?.confianza, "media");
  });

  it("devuelve null cuando la zona no aparece", () => {
    assert.equal(zonaDe("Casa\nColonia: Altabrisa\nPrecio: 3,500,000"), null);
  });

  it("la propiedad en cercanía queda marcada fuera de zona al evaluar", () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: El Marqués\nPrecio: 3,500,000\nDescripción: a 10 minutos de Juriquilla",
    );
    assert.equal(e.fueraDeZona, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("puntuación", () => {
  const PROPIEDAD_PERFECTA = `Casa
Colonia: Juriquilla
Calle: Paseo de la Loma 145
Precio: 3,300,000
Pago inicial: 600,000
Pago mensual: 22,000
Cuartos: 3
Baños: 2
Área: 165 m2
Características: jardín`;

  it("una propiedad que cumple todo NO llega a 10", () => {
    const e = evaluarUno(CLIENTE_BASE, PROPIEDAD_PERFECTA);
    assert.ok(e.score < 10, `score fue ${e.score}`);
    assert.ok(e.score <= 9.7, `score fue ${e.score}`);
    assert.ok(e.score >= 8.5, `score fue ${e.score}, esperaba un encaje alto`);
  });

  it("con datos completos la confianza es alta", () => {
    assert.equal(evaluarUno(CLIENTE_BASE, PROPIEDAD_PERFECTA).confianza, "alta");
  });

  it("con pocos datos baja el score y la confianza", () => {
    const completa = evaluarUno(CLIENTE_BASE, PROPIEDAD_PERFECTA);
    const escueta = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: Juriquilla\nPrecio: 3,300,000",
    );

    assert.ok(
      escueta.score < completa.score,
      `escueta ${escueta.score} debería ser menor que completa ${completa.score}`,
    );
    assert.notEqual(escueta.confianza, "alta");
    assert.ok(escueta.cobertura < completa.cobertura);
  });

  it("fuera de zona topa en 8.0 aunque cumpla el resto", () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      PROPIEDAD_PERFECTA.replace("Colonia: Juriquilla", "Colonia: Altabrisa"),
    );
    assert.ok(e.score <= 8, `score fue ${e.score}`);
    assert.equal(e.fueraDeZona, true);
  });

  it("el precio se valora de forma continua, no por tramos", () => {
    const barata = evaluarUno(CLIENTE_BASE, PROPIEDAD_PERFECTA);
    const cara = evaluarUno(
      CLIENTE_BASE,
      PROPIEDAD_PERFECTA.replace("Precio: 3,300,000", "Precio: 3,980,000"),
    );
    assert.ok(
      cara.score < barata.score,
      `una casi en el tope (${cara.score}) debería puntuar menos que una holgada (${barata.score})`,
    );
  });

  it("descarta lo que excede el presupuesto en más del 25%", () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: Juriquilla\nPrecio: 5,900,000",
    );
    assert.equal(e.descartada, true);
    assert.match(e.motivoDescarte ?? "", /presupuesto/);
  });

  it("descarta un tipo de propiedad distinto al pedido", () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Departamento en venta\nColonia: Juriquilla\nPrecio: 3,200,000",
    );
    assert.equal(e.descartada, true);
  });

  it("sin ningún dato comparable el score es null, no un número inventado", () => {
    const e = evaluarUno("Roberto Díaz", "Un lugar bonito junto al mar");
    assert.equal(e.score, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("restricciones", () => {
  it("extrae las palabras con contenido", () => {
    const [p] = extraerProhibiciones("no acepta planta alta");
    assert.deepEqual(p.palabras, ["planta", "alta"]);
  });

  it('detecta el conflicto cuando la ficha dice "planta alta"', () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: Juriquilla\nPrecio: 3,300,000\nCuartos: 3\nDescripción: planta alta sin elevador",
    );
    assert.equal(e.conflictos.length, 1);
    assert.ok(e.contras.some((c) => c.includes("Posible conflicto")));
  });

  it("el conflicto topa el score en 7.0 pero NO descarta", () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: Juriquilla\nPrecio: 3,300,000\nCuartos: 3\nBaños: 2\nÁrea: 165 m2\nPago mensual: 22,000\nCaracterísticas: jardín\nDescripción: planta alta",
    );
    assert.ok(e.score <= 7, `score fue ${e.score}`);
    assert.equal(e.descartada, false);
  });

  it('"planta baja" NO dispara la restricción "no acepta planta alta"', () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: Juriquilla\nPrecio: 3,300,000\nDescripción: todo en planta baja",
    );
    assert.equal(e.conflictos.length, 0);
  });

  it("una propiedad en conflicto NO se le ofrece al cliente en el email", () => {
    const salida = construirRespuestaDemo({
      datosCliente: CLIENTE_BASE,
      propiedades: `1) Casa
Colonia: Juriquilla
Calle: Paseo de la Loma 145
Precio: 3,300,000
Cuartos: 3

2) Casa
Colonia: Juriquilla
Calle: Circuito Peñas 88
Precio: 3,200,000
Cuartos: 3
Descripción: planta alta con vista`,
      documentos: "",
    });

    // Sigue en el análisis, para que el broker la vea y decida...
    assert.ok(salida.includes("Circuito Peñas 88"));
    assert.ok(salida.includes("Posible conflicto"));

    // ...pero no en el texto que se le manda al cliente.
    const email = extractEmail(salida);
    assert.ok(email);
    assert.ok(
      !email.includes("Circuito Peñas 88"),
      "el email no debe ofrecer una propiedad que contradice una restricción",
    );
    assert.ok(email.includes("Paseo de la Loma 145"));
  });

  it("si TODAS chocan con una restricción, el email lo dice en vez de callarlo", () => {
    const salida = construirRespuestaDemo({
      datosCliente: CLIENTE_BASE,
      propiedades:
        "Casa\nColonia: Juriquilla\nCalle: Circuito Peñas 88\nPrecio: 3,200,000\nCuartos: 3\nDescripción: planta alta",
      documentos: "",
    });

    const email = extractEmail(salida);
    assert.ok(email);
    assert.ok(!email.includes("Circuito Peñas 88"));
    assert.match(email, /no querías|choca/);
  });

  it("una prohibición de una sola palabra basta con que aparezca", () => {
    const e = evaluarUno(
      "Nombre: Ana\nRestricciones: sin mascotas",
      "Casa\nPrecio: 3,000,000\nDescripción: se aceptan mascotas",
    );
    assert.equal(e.conflictos.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("campos separados por | (el formato del placeholder de la app)", () => {
  // Copia literal del bloque que app/page.tsx le propone al usuario.
  const COMO_LO_SUGIERE_LA_APP = `1) Casa en venta - Disponible
Estado: Querétaro | Municipio: Querétaro | CP: 76230
Calle: Av. El Refugio 120
Precio: 3,900,000 | Pago inicial: 780,000 | Pago mensual: 26,500
Cuartos: 3 | Baños: 2.5 | Área: 165 m2
Características: jardín, 2 cajones, cocina integral`;

  const p = parsePropiedades(COMO_LO_SUGIERE_LA_APP)[0];

  it("lee todos los campos de una línea, no solo el primero", () => {
    assert.equal(p.estado, "Querétaro");
    assert.equal(p.municipio, "Querétaro");
    assert.equal(p.precio, 3900000);
    assert.equal(p.pagoInicial, 780000);
    assert.equal(p.mensual, 26500);
    assert.equal(p.habitaciones, 3);
    assert.equal(p.banos, 2.5);
    assert.equal(p.area, 165);
  });

  it("no contamina el título con el resto de la línea", () => {
    assert.ok(!p.titulo.includes("|"), `título fue: ${p.titulo}`);
    assert.equal(p.titulo, "Av. El Refugio 120, Querétaro");
  });

  it("también funciona en los datos del cliente", () => {
    const c = parseCliente("Nombre: Ana | Apellidos: Ramírez\nHabitaciones: 3 | Baños: 2");
    assert.equal(c.nombreCompleto, "Ana Ramírez");
    assert.equal(c.banos, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("ubicación mostrada en la tabla", () => {
  const cliente = `Tipo de propiedad deseada: Casa
Ubicación preferida: Juriquilla o El Refugio
Presupuesto: 3,000,000 - 4,000,000
Habitaciones: 3`;

  it("muestra la zona preferida cuando viene en la calle, no el municipio", () => {
    const salida = construirRespuestaDemo({
      datosCliente: cliente,
      propiedades: `Casa
Estado: Querétaro | Municipio: Querétaro
Calle: Av. El Refugio 120
Precio: 3,400,000 | Cuartos: 3`,
      documentos: "",
    });

    const tabla = salida.slice(salida.indexOf("## 4."), salida.indexOf("## 5."));
    assert.ok(
      /\| El Refugio( \(Querétaro\))? \|/.test(tabla),
      `la celda de ubicación debería decir El Refugio:\n${tabla}`,
    );
  });

  it("si no hay zona preferida que coincida, cae al municipio", () => {
    const salida = construirRespuestaDemo({
      datosCliente: cliente,
      propiedades: `Casa
Estado: Querétaro | Municipio: El Marqués
Calle: Av. Tecnológico 400
Precio: 3,400,000 | Cuartos: 3`,
      documentos: "",
    });
    assert.ok(salida.includes("El Marqués"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("exceder la capacidad de pago", () => {
  const cliente = `Tipo de propiedad deseada: Casa
Ubicación preferida: Juriquilla o El Refugio
Presupuesto: 3,000,000 - 4,000,000
Habitaciones: 3
Baños: 2
Cuota mensual máxima: 28,000
Pago inicial disponible: 900,000`;

  const enZonaPeroCara = `Casa
Municipio: Querétaro | Calle: Av. El Refugio 120
Precio: 3,900,000 | Pago inicial: 950,000 | Pago mensual: 29,000
Cuartos: 3 | Baños: 2.5`;

  const fueraDeZonaAsequible = `Casa
Municipio: El Marqués | Calle: Av. Tecnológico 400
Precio: 3,400,000 | Pago inicial: 700,000 | Pago mensual: 24,000
Cuartos: 3 | Baños: 2.5`;

  it("pasarse de la mensualidad pesa MÁS que estar fuera de zona", () => {
    const cara = evaluarUno(cliente, enZonaPeroCara);
    const lejos = evaluarUno(cliente, fueraDeZonaAsequible);

    assert.equal(cara.excedeMensual, true);
    assert.equal(lejos.fueraDeZona, true);
    assert.ok(
      cara.score < lejos.score,
      `la que excede la mensualidad (${cara.score}) debe quedar por debajo de la que está fuera de zona (${lejos.score})`,
    );
  });

  it("topa en 7.0 pero no descarta la propiedad", () => {
    const e = evaluarUno(cliente, enZonaPeroCara);
    assert.ok(e.score <= 7, `score fue ${e.score}`);
    assert.equal(e.descartada, false);
    assert.ok(e.contras.some((c) => c.includes("capacidad de pago")));
  });

  it("pasarse del enganche penaliza, pero sin tope", () => {
    const soloEnganche = evaluarUno(
      cliente,
      `Casa
Municipio: Querétaro | Calle: Av. El Refugio 120
Precio: 3,400,000 | Pago inicial: 980,000 | Pago mensual: 24,000
Cuartos: 3 | Baños: 2.5`,
    );
    const dentro = evaluarUno(
      cliente,
      `Casa
Municipio: Querétaro | Calle: Av. El Refugio 120
Precio: 3,400,000 | Pago inicial: 700,000 | Pago mensual: 24,000
Cuartos: 3 | Baños: 2.5`,
    );

    assert.ok(soloEnganche.score < dentro.score);
    assert.ok(
      soloEnganche.score > 7,
      `el enganche no lleva tope, así que puede superar 7.0 (fue ${soloEnganche.score})`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("documentos", () => {
  it("un textarea vacío no produce análisis", () => {
    assert.equal(SIN_DOCUMENTOS.vacio, true);
    assert.deepEqual(SIN_DOCUMENTOS.temas, []);
  });

  it("detecta temas, montos y frases con intención", () => {
    const a = analizarDocumentos(
      "Carta del banco: crédito preaprobado por 3,300,000 MXN. El cliente no quiere planta alta. Prefiere entrega antes de marzo.",
    );
    assert.equal(a.vacio, false);
    assert.ok(a.temas.includes("crédito/financiamiento"));
    assert.ok(a.montos.includes(3300000));
    assert.equal(a.senales.length, 2);
    assert.equal(a.rechazos.length, 1);
  });

  it("un rechazo en los documentos actúa como restricción", () => {
    const e = evaluarUno(
      "Nombre: Ana\nPresupuesto: 3,000,000 - 4,000,000",
      "Casa\nPrecio: 3,300,000\nDescripción: planta alta con vista",
      "El cliente no quiere planta alta.",
    );
    assert.ok(e.conflictos.length >= 1);
  });

  it("marca como pro que el documento mencione la propiedad", () => {
    const e = evaluarUno(
      CLIENTE_BASE,
      "Casa\nColonia: Juriquilla\nCalle: Paseo de la Loma 145\nPrecio: 3,300,000",
      "Ya visitamos la de Paseo de la Loma y le gustó mucho.",
    );
    assert.ok(e.pros.some((p) => p.includes("documentos")));
  });

  it("cita el texto pegado cuando no reconoce nada en él", () => {
    const salida = construirRespuestaDemo({
      datosCliente: CLIENTE_BASE,
      propiedades: "Casa\nColonia: Juriquilla\nPrecio: 3,300,000\nCuartos: 3",
      documentos: "La casa tiene vista al parque y el vecino es arquitecto.",
    });
    assert.ok(salida.includes("Esto es lo que recibí"));
    assert.ok(salida.includes("La casa tiene vista al parque"));
  });

  it("recuerda las señales de los documentos en la recomendación final", () => {
    const salida = construirRespuestaDemo({
      datosCliente: CLIENTE_BASE,
      propiedades: "Casa\nColonia: Juriquilla\nPrecio: 3,300,000\nCuartos: 3",
      documentos: "El cliente prefiere planta baja.",
    });
    const seccion5 = salida.slice(salida.indexOf("## 5."), salida.indexOf("## 6."));
    assert.ok(
      seccion5.includes("documentos"),
      `la sección 5 debería mencionar los documentos:\n${seccion5}`,
    );
  });

  it("pero NO los cita en el email al cliente (son notas internas)", () => {
    const salida = construirRespuestaDemo({
      datosCliente: CLIENTE_BASE,
      propiedades: "Casa\nColonia: Juriquilla\nCalle: Paseo de la Loma 145\nPrecio: 3,300,000\nCuartos: 3",
      documentos: "Nota interna: el dueño tiene prisa y aceptaría 200,000 menos.",
    });
    const email = extractEmail(salida);
    assert.ok(email);
    assert.ok(!email.includes("Nota interna"));
    assert.ok(!email.includes("aceptaría"));
  });

  it("el análisis aparece en la respuesta generada", () => {
    const salida = construirRespuestaDemo({
      datosCliente: CLIENTE_BASE,
      propiedades: "Casa\nColonia: Juriquilla\nPrecio: 3,300,000",
      documentos: "Crédito preaprobado por 3,300,000. El cliente prefiere entrega en marzo.",
    });
    assert.ok(salida.includes("Señales detectadas en los documentos"));
    assert.ok(salida.includes("crédito/financiamiento"));
    assert.ok(salida.includes("prefiere entrega en marzo"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("lectura de cantidades", () => {
  it("entiende separadores de miles, millones y abreviaturas", () => {
    assert.equal(parseNumero("3,500,000 MXN"), 3500000);
    assert.equal(parseNumero("3.5 millones"), 3500000);
    assert.equal(parseNumero("$4.2M"), 4200000);
    assert.equal(parseNumero("2.5"), 2.5);
    assert.equal(parseNumero("165 m2"), 165);
  });

  it("entiende rangos", () => {
    assert.deepEqual(parseRango("3,500,000 - 4,200,000 MXN"), [3500000, 4200000]);
    assert.deepEqual(parseRango("de 3.5 a 4.2 millones"), [3500000, 4200000]);
    assert.deepEqual(parseRango("140 - 200 m2"), [140, 200]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("respuesta completa", () => {
  const salida = construirRespuestaDemo({
    datosCliente: CLIENTE_BASE,
    propiedades: `1) Casa
Colonia: Juriquilla
Calle: Paseo de la Loma 145
Precio: 3,300,000
Pago mensual: 22,000
Cuartos: 3
Baños: 2
Área: 165 m2
Características: jardín

2) Casa
Colonia: Altabrisa
Calle: Calle 21 num 300
Precio: 3,100,000
Pago mensual: 20,000
Cuartos: 3
Baños: 2
Área: 150 m2`,
    documentos: "",
  });

  it("mantiene las 6 secciones del formato obligatorio", () => {
    for (const seccion of [
      "## 1. Resumen de requisitos del cliente",
      "## 2. Top propiedades recomendadas",
      "## 3. Análisis detallado de cada propiedad recomendada",
      "## 4. Tabla comparativa",
      "## 5. Explicación final y recomendación",
      "## 6. Email para el cliente",
    ]) {
      assert.ok(salida.includes(seccion), `falta: ${seccion}`);
    }
  });

  it("mantiene el aviso de Modo Demo", () => {
    assert.ok(salida.includes("**Modo Demo.**"));
  });

  it("usa los datos pegados, no un texto fijo", () => {
    assert.ok(salida.includes("Ana Ramírez"));
    assert.ok(salida.includes("Paseo de la Loma 145"));
    assert.ok(salida.includes("3,300,000 MXN"));
  });

  it("muestra la confianza junto al score", () => {
    assert.match(salida, /confianza (alta|media|baja)/);
  });

  it("ninguna propiedad recibe 10.0", () => {
    const scores = [...salida.matchAll(/Score \*\*(\d+\.\d)\/10\*\*/g)].map((m) =>
      Number(m[1]),
    );
    assert.ok(scores.length > 0, "no se encontró ningún score");
    assert.ok(Math.max(...scores) < 10, `el máximo fue ${Math.max(...scores)}`);
  });

  it("el email se puede extraer y va personalizado", () => {
    const email = extractEmail(salida);
    assert.ok(email);
    assert.ok(email.includes("Hola Ana,"));
    assert.ok(email.includes("Paseo de la Loma 145"));
    assert.ok(!email.includes("Tabla comparativa"));
  });
});

describe("partir la respuesta en cuerpo y email", () => {
  const salida = construirRespuestaDemo({
    datosCliente: CLIENTE_BASE,
    propiedades: [
      "1) Casa",
      "Colonia: Juriquilla",
      "Calle: Paseo de la Loma 145",
      "Precio: 3,300,000",
      "Pago mensual: 22,000",
      "Cuartos: 3",
      "Baños: 2",
    ].join("\n"),
  });

  it("el cuerpo llega hasta la sección 5 y el email empieza por el asunto", () => {
    const { cuerpo, email } = splitEmail(salida);
    assert.ok(!cuerpo.includes("Email para el cliente"));
    assert.ok(cuerpo.includes("Explicación final"));
    assert.ok(email.startsWith("Asunto:"));
  });

  it("sin sección 6, el cuerpo es la respuesta entera", () => {
    const sinEmail = "## 1. Resumen\n\nTexto del análisis.";
    const { cuerpo, email } = splitEmail(sinEmail);
    assert.equal(email, null);
    assert.equal(cuerpo, sinEmail);
  });

  it("un título sin nada debajo no cuenta como email", () => {
    const soloTitulo = "## 5. Explicación\n\nTexto.\n\n## 6. Email para el cliente\n\n";
    const { cuerpo, email } = splitEmail(soloTitulo);
    assert.equal(email, null);
    assert.equal(cuerpo, soloTitulo);
  });

  it("extractEmail sigue devolviendo lo mismo que splitEmail", () => {
    assert.equal(extractEmail(salida), splitEmail(salida).email);
  });
});
