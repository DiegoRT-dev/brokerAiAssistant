/** Formateo compartido por el generador de la demo. */

export const SIN_DATO = "—";

export function moneda(valor: number | null): string {
  if (valor === null) return SIN_DATO;
  return `${Math.round(valor).toLocaleString("es-MX")} MXN`;
}

export function numero(valor: number | null): string {
  if (valor === null) return SIN_DATO;
  return valor.toLocaleString("es-MX");
}

export function area(valor: number | null): string {
  if (valor === null) return SIN_DATO;
  return `${numero(valor)} m²`;
}

/** "a, b y c" */
export function enumerar(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Quita negritas y el punto final, para incrustar la frase dentro de otra. */
export function frase(texto: string): string {
  return texto.replace(/\*\*/g, "").replace(/\.$/, "").trim();
}

/**
 * Baja SOLO la primera letra. Un `toLowerCase()` completo destrozaria "MXN" y
 * los nombres de colonia, que aparecen a mitad de estas frases.
 */
export function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
