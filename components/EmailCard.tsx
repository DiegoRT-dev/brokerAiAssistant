"use client";

import { CopyEmailButton } from "@/components/CopyEmailButton";
import { IconoSobre } from "@/components/Iconos";
import { MarkdownResultado } from "@/components/MarkdownResultado";

/**
 * La sección 6 presentada como un correo, no como un bloque más del análisis.
 *
 * Es lo único de toda la respuesta que sale de la herramienta y llega al
 * cliente, así que se separa del resto: asunto destacado, cuerpo legible y el
 * botón de copiar al lado. Lo que se copia es el texto original completo,
 * asunto incluido.
 */
export function EmailCard({ email }: { email: string }) {
  const { asunto, cuerpo } = separarAsunto(email);

  return (
    <section
      aria-label="Email para el cliente"
      className="aparecer mt-8 overflow-hidden rounded-2xl border border-marca-borde bg-superficie shadow-tarjeta sm:mt-10"
    >
      <div className="h-1 bg-marca" aria-hidden />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linea bg-marca-suave/60 px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-marca text-marca-contraste">
            <IconoSobre className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-texto">
              Email para el cliente
            </p>
            <p className="text-xs text-texto-suave">Listo para enviar</p>
          </div>
        </div>
        <CopyEmailButton
          email={email}
          variante="principal"
          className="w-full justify-center sm:w-auto"
        />
      </header>

      {asunto && (
        <div className="flex flex-col gap-1 border-b border-linea px-3 py-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-2 sm:px-5">
          <span className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
            Asunto
          </span>
          <span className="text-[15px] font-medium text-texto">{asunto}</span>
        </div>
      )}

      <div className="px-3 py-4 sm:px-5 sm:py-5">
        <MarkdownResultado>{cuerpo}</MarkdownResultado>
      </div>
    </section>
  );
}

/**
 * Aísla la línea del asunto para mostrarla como cabecera del correo.
 *
 * Solo se toma si aparece al principio: más abajo, "Asunto" ya sería parte del
 * mensaje y sacarla de ahí descolocaría el texto.
 */
function separarAsunto(email: string): { asunto: string | null; cuerpo: string } {
  const lineas = email.split("\n");
  const primera = lineas.findIndex((linea) => linea.trim() !== "");

  if (primera === -1) return { asunto: null, cuerpo: email };

  const coincide = /^\s*(?:\*{0,2})asunto(?:\*{0,2})\s*:\s*(.+?)\s*\*{0,2}\s*$/i.exec(
    lineas[primera],
  );

  if (!coincide) return { asunto: null, cuerpo: email };

  return {
    asunto: coincide[1].replace(/\*+$/, "").trim(),
    cuerpo: lineas.slice(primera + 1).join("\n").trim(),
  };
}
