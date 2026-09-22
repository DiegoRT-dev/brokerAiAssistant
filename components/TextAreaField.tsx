"use client";

import type { ReactNode } from "react";

import { IconoCheck } from "@/components/Iconos";

type TextAreaFieldProps = {
  id: string;
  step: number;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  optional?: boolean;
  disabled?: boolean;
  /** Acción opcional en el pie del campo (por ejemplo, rellenar con el ejemplo). */
  accion?: ReactNode;
};

/**
 * Campo de texto largo con encabezado numerado. Se usa para las tres secciones
 * de entrada, así que todo el estilo vive aquí en lugar de repetirse.
 *
 * El número del paso se convierte en un check en cuanto el campo tiene
 * contenido: de un vistazo se ve qué falta por completar antes de generar.
 */
export function TextAreaField({
  id,
  step,
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 10,
  optional = false,
  disabled = false,
  accion,
}: TextAreaFieldProps) {
  const caracteres = value.trim().length;
  const completado = caracteres > 0;

  return (
    <div className="group rounded-2xl border border-linea bg-superficie p-4 shadow-tarjeta transition-colors duration-200 focus-within:border-marca-borde sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200 ${
            completado
              ? "bg-marca text-marca-contraste"
              : "bg-superficie-2 text-texto-suave ring-1 ring-linea ring-inset"
          }`}
        >
          {completado ? <IconoCheck className="size-4" /> : step}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={id}
              className="text-[15px] font-semibold tracking-tight text-texto"
            >
              {label}
            </label>
            {optional && (
              <span className="rounded-full border border-linea px-2 py-0.5 text-[11px] font-medium text-texto-suave">
                Opcional
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-texto-suave">
            {description}
          </p>
        </div>
      </div>

      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck={false}
        className="mt-4 block w-full resize-y rounded-xl border border-linea bg-superficie-2 px-4 py-3 font-mono text-[13px] leading-6 text-texto outline-none transition duration-200 placeholder:text-texto-suave/60 focus:border-marca focus:bg-superficie focus:ring-4 focus:ring-marca/15 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="mt-2 flex min-h-5 items-center justify-between gap-3">
        <span className="cifras text-xs text-texto-suave">
          {completado ? `${caracteres.toLocaleString("es-MX")} caracteres` : ""}
        </span>
        {accion}
      </div>
    </div>
  );
}
