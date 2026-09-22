/**
 * Aísla la sección 6 ("Email para el cliente") de la respuesta de Claude, para
 * que el broker pueda copiar solo el email.
 *
 * El system prompt obliga a ese título, pero el formato exacto varía: Claude
 * puede escribirlo como `## 6. Email para el cliente`, `**6. Email para el
 * cliente**` o `### Email para el cliente`. Por eso se intenta en tres niveles
 * y, si ninguno acierta, se devuelve `null` en lugar de adivinar: es preferible
 * deshabilitar el botón a copiar texto equivocado que el broker pegaría en un
 * correo real.
 */

/** Línea que es exactamente el título, con o sin `#`, `**` y numeración. */
const TITULO_EXACTO =
  /^[\s>]*(?:#{1,6}\s*)?(?:\*{1,3}\s*)?(?:6\s*[.)\-–]?\s*)?(?:\*{1,3}\s*)?email\s+para\s+el\s+cliente\s*\*{0,3}\s*:?\s*\*{0,3}\s*$/i;

/** Red de seguridad: una línea corta que menciona el título. */
const TITULO_APROXIMADO = /email\s+para\s+el\s+cliente/i;

export type RespuestaPartida = {
  /** Las secciones 1 a 5, tal cual, para renderizarlas como markdown. */
  cuerpo: string;
  /** La sección 6 ya limpia, o `null` si no se pudo aislar. */
  email: string | null;
};

/**
 * Parte la respuesta en "todo lo anterior" y "el email".
 *
 * Permite presentar la sección 6 como una tarjeta aparte sin volver a recorrer
 * el texto. Si no se encuentra el título, el cuerpo es la respuesta completa:
 * nunca se pierde contenido por no reconocer el formato.
 */
export function splitEmail(markdown: string): RespuestaPartida {
  if (!markdown.trim()) return { cuerpo: markdown, email: null };

  const lineas = markdown.split(/\r?\n/);

  // Se busca desde el final: la sección 5 puede mencionar el email de pasada,
  // y el título real de la sección 6 siempre viene después.
  let indice = buscarUltima(lineas, (linea) => TITULO_EXACTO.test(linea));

  if (indice === -1) {
    indice = buscarUltima(
      lineas,
      (linea) => linea.trim().length <= 80 && TITULO_APROXIMADO.test(linea),
    );
  }

  if (indice === -1) return { cuerpo: markdown, email: null };

  const email = limpiar(lineas.slice(indice + 1).join("\n")) || null;

  // Un título sin nada debajo no es un email: se deja la respuesta entera.
  if (email === null) return { cuerpo: markdown, email: null };

  return { cuerpo: lineas.slice(0, indice).join("\n").trimEnd(), email };
}

/** La sección 6 sola. Es lo que copia el botón de "Copiar email". */
export function extractEmail(markdown: string): string | null {
  return splitEmail(markdown).email;
}

function buscarUltima(
  lineas: string[],
  predicado: (linea: string) => boolean,
): number {
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (predicado(lineas[i])) return i;
  }
  return -1;
}

/** Quita separadores `---` y bloques de código con los que Claude suele envolver el email. */
function limpiar(texto: string): string {
  let lineas = texto.split("\n");

  while (lineas.length && esVacioOSeparador(lineas[0])) lineas.shift();
  while (lineas.length && esVacioOSeparador(lineas[lineas.length - 1])) {
    lineas.pop();
  }

  const abre = lineas[0]?.trim().startsWith("```");
  const cierra = lineas[lineas.length - 1]?.trim() === "```";
  if (abre && cierra && lineas.length >= 2) {
    lineas = lineas.slice(1, -1);
  }

  return lineas.join("\n").trim();
}

function esVacioOSeparador(linea: string): boolean {
  const l = linea.trim();
  return l === "" || /^(-{3,}|\*{3,}|_{3,})$/.test(l);
}
