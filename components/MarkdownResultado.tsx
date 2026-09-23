"use client";

import { isValidElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza el markdown del análisis con el estilo del producto.
 *
 * `remark-gfm` es obligatorio: sin él, la tabla comparativa de la sección 4 se
 * renderiza como texto plano. El resto de componentes están aquí para que las
 * 6 secciones del formato se distingan entre sí: cada `##` se convierte en una
 * cabecera con su número, y la tabla se envuelve en un contenedor con scroll
 * propio para que no desborde la página en móvil.
 */
export function MarkdownResultado({ children }: { children: string }) {
  return (
    <div className="prose prose-resultado w-full max-w-none min-w-0 text-[14px] leading-relaxed break-words sm:text-[15px] prose-p:my-3 prose-li:my-1 prose-strong:font-semibold">
      <Markdown remarkPlugins={[remarkGfm]} components={componentes}>
        {children}
      </Markdown>
    </div>
  );
}

/** Texto plano de un nodo, para leer el número de sección de un título. */
function textoDe(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") {
    return "";
  }
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join("");
  if (isValidElement(nodo)) {
    return textoDe((nodo.props as { children?: ReactNode }).children);
  }
  return "";
}

const NUMERO_DE_SECCION = /^(\d+)[.)]\s*(.*)$/;

const componentes: Components = {
  h2: ({ children }) => {
    const texto = textoDe(children);
    const partes = NUMERO_DE_SECCION.exec(texto);

    return (
      <div className="mt-8 mb-3.5 flex items-center gap-2.5 border-t border-linea pt-6 first:mt-0 first:border-t-0 first:pt-0 sm:mt-10 sm:mb-4 sm:gap-3 sm:pt-7">
        {partes && (
          <span
            aria-hidden
            className="cifras flex size-6 shrink-0 items-center justify-center rounded-lg bg-marca-suave text-xs font-semibold text-marca ring-1 ring-marca-borde ring-inset sm:size-7 sm:text-[13px]"
          >
            {partes[1]}
          </span>
        )}
        <h2 className="m-0 text-base font-semibold tracking-tight text-texto sm:text-lg">
          {partes ? partes[2] : texto}
        </h2>
      </div>
    );
  },

  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 border-l-2 border-marca-borde pl-2.5 text-[14px] font-semibold tracking-tight text-texto sm:mt-7 sm:pl-3 sm:text-[15px]">
      {children}
    </h3>
  ),

  /**
   * La tabla comparativa trae 9 columnas: en un móvil no cabe de ninguna
   * manera. En lugar de apretarla hasta lo ilegible, se le da un ancho mínimo
   * y se desplaza en horizontal, con las sombras de `scroll-sombra` y un aviso
   * para que se vea que hay más columnas a la derecha.
   *
   * El envoltorio lleva `w-full max-w-full min-w-0` a propósito: es lo que
   * mantiene el ancho mínimo de la tabla encerrado en su propio scroll en
   * lugar de dejar que ensanche el panel y, detrás, la página entera.
   */
  table: ({ children }) => (
    <div className="my-5 w-full max-w-full min-w-0 sm:my-6">
      <div className="scroll-sombra w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-linea">
        <table className="my-0 w-full min-w-[46rem] border-collapse text-sm">
          {children}
        </table>
      </div>
      <p className="mt-2 mb-0 text-xs text-texto-suave lg:hidden">
        Desliza la tabla para ver todas las columnas.
      </p>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-superficie-2">{children}</thead>
  ),

  th: ({ children }) => (
    <th className="border-b border-linea px-2.5 py-2 text-left text-[10px] font-semibold tracking-wide text-texto-suave uppercase sm:px-3 sm:py-2.5 sm:text-[11px]">
      {children}
    </th>
  ),

  tr: ({ children }) => (
    <tr className="border-b border-linea transition-colors duration-150 last:border-0 hover:bg-superficie-2/60">
      {children}
    </tr>
  ),

  td: ({ children }) => (
    <td className="cifras px-2.5 py-2 align-top text-texto sm:px-3 sm:py-2.5">
      {children}
    </td>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-3 border-marca-borde bg-superficie-2 px-3 py-2.5 text-[13px] text-texto-suave not-italic sm:px-4 sm:py-3 sm:text-[14px] [&_p]:my-1 [&_strong]:text-texto">
      {children}
    </blockquote>
  ),

  pre: ({ children }) => (
    <pre className="my-4 w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-linea bg-superficie-2 p-3 font-mono text-[12px] leading-6 text-texto sm:p-4 sm:text-[12.5px]">
      {children}
    </pre>
  ),

  code: ({ children, className }) => {
    // Dentro de un `pre` el estilo ya lo pone el bloque; aquí solo el inline.
    if (className) return <code className={className}>{children}</code>;
    return (
      <code className="rounded-md border border-linea bg-superficie-2 px-1.5 py-0.5 font-mono text-[12.5px] before:content-none after:content-none">
        {children}
      </code>
    );
  },

  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 marker:text-marca">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 marker:text-texto-suave">
      {children}
    </ol>
  ),

  hr: () => <hr className="my-8 border-linea" />,

  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-marca underline underline-offset-2 hover:text-marca-fuerte"
    >
      {children}
    </a>
  ),
};
