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
    <div className="prose prose-resultado max-w-none text-[15px] leading-relaxed prose-p:my-3 prose-li:my-1 prose-strong:font-semibold">
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
      <div className="mt-10 mb-4 flex items-center gap-3 border-t border-linea pt-7 first:mt-0 first:border-t-0 first:pt-0">
        {partes && (
          <span
            aria-hidden
            className="cifras flex size-7 shrink-0 items-center justify-center rounded-lg bg-marca-suave text-[13px] font-semibold text-marca ring-1 ring-marca-borde ring-inset"
          >
            {partes[1]}
          </span>
        )}
        <h2 className="m-0 text-lg font-semibold tracking-tight text-texto">
          {partes ? partes[2] : texto}
        </h2>
      </div>
    );
  },

  h3: ({ children }) => (
    <h3 className="mt-7 mb-2 border-l-2 border-marca-borde pl-3 text-[15px] font-semibold tracking-tight text-texto">
      {children}
    </h3>
  ),

  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-linea">
      <table className="my-0 w-full border-collapse text-sm">{children}</table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-superficie-2">{children}</thead>
  ),

  th: ({ children }) => (
    <th className="border-b border-linea px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
      {children}
    </th>
  ),

  tr: ({ children }) => (
    <tr className="border-b border-linea transition-colors duration-150 last:border-0 hover:bg-superficie-2/60">
      {children}
    </tr>
  ),

  td: ({ children }) => (
    <td className="cifras px-3 py-2.5 align-top text-texto">{children}</td>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-3 border-marca-borde bg-superficie-2 px-4 py-3 text-[14px] text-texto-suave not-italic [&_p]:my-1 [&_strong]:text-texto">
      {children}
    </blockquote>
  ),

  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-linea bg-superficie-2 p-4 font-mono text-[12.5px] leading-6 text-texto">
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
