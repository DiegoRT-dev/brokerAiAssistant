"use client";

import { CopyEmailButton } from "@/components/CopyEmailButton";
import { EmailCard } from "@/components/EmailCard";
import { IconoAlerta, IconoLista } from "@/components/Iconos";
import { MarkdownResultado } from "@/components/MarkdownResultado";
import { DEMO_MODE } from "@/lib/config";
import { splitEmail } from "@/lib/extract-email";

export type ResultStatus = "idle" | "loading" | "done" | "error";

type ResultPanelProps = {
  status: ResultStatus;
  resultado: string;
  error: string;
  truncated: boolean;
  segundos: number;
  onCancelar: () => void;
};

export function ResultPanel({
  status,
  resultado,
  error,
  truncated,
  segundos,
  onCancelar,
}: ResultPanelProps) {
  // El email se aísla una sola vez: lo usan la cabecera y la tarjeta final.
  const { cuerpo, email } = splitEmail(resultado);

  return (
    <section
      aria-label="Resultados"
      className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-linea bg-superficie shadow-tarjeta"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-linea px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-texto">
            Resultados
          </h2>
          {DEMO_MODE && status === "done" && (
            <span className="rounded-full border border-aviso-borde bg-aviso-suave px-2 py-0.5 text-[11px] font-semibold text-aviso-texto">
              Respuesta de ejemplo
            </span>
          )}
        </div>
        {status === "done" && <CopyEmailButton email={email} />}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {status === "idle" && <Vacio />}
        {status === "loading" && (
          <Cargando segundos={segundos} onCancelar={onCancelar} />
        )}
        {status === "error" && <ErrorEstado mensaje={error} />}
        {status === "done" && (
          <div className="aparecer">
            {truncated && (
              <p className="mb-5 flex items-start gap-2 rounded-lg border border-aviso-borde bg-aviso-suave px-3 py-3 text-[13px] text-aviso-texto sm:px-4 sm:text-sm">
                <IconoAlerta className="mt-0.5 size-4 shrink-0" />
                La respuesta llegó al límite de longitud y puede estar
                incompleta. Prueba con menos propiedades.
              </p>
            )}
            <MarkdownResultado>{cuerpo}</MarkdownResultado>
            {email && <EmailCard email={email} />}
          </div>
        )}
      </div>
    </section>
  );
}

function Vacio() {
  const pasos = [
    "Pega los datos del cliente tal como los tengas.",
    "Pega la lista de propiedades disponibles.",
    "Pulsa “Generar recomendaciones”.",
  ];

  return (
    <div className="py-8 text-center sm:py-10">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-marca-suave text-marca ring-1 ring-marca-borde ring-inset">
        <IconoLista className="size-6" />
      </span>
      <p className="mt-4 text-[15px] font-semibold tracking-tight text-texto">
        Aún no hay recomendaciones
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-texto-suave">
        El análisis comparativo y el email aparecerán aquí.
      </p>

      <ol className="mx-auto mt-6 max-w-xs space-y-2.5 text-left">
        {pasos.map((paso, indice) => (
          <li key={paso} className="flex items-start gap-3">
            <span className="cifras mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-[11px] font-semibold text-texto-suave ring-1 ring-linea ring-inset">
              {indice + 1}
            </span>
            <span className="text-[13px] leading-relaxed text-texto-suave">
              {paso}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Esqueleto de la respuesta mientras se genera.
 *
 * Sin streaming en pantalla, el contador es la única señal de que la petición
 * sigue viva; el esqueleto adelanta además la forma que tendrá el resultado.
 */
function Cargando({
  segundos,
  onCancelar,
}: {
  segundos: number;
  onCancelar: () => void;
}) {
  return (
    <div aria-live="polite">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <p className="cifras text-sm font-medium text-texto">
          Generando recomendaciones… {segundos} s
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex min-h-11 items-center rounded-lg border border-linea px-3 py-1.5 text-sm font-medium text-texto-suave transition duration-200 hover:border-linea-fuerte hover:bg-superficie-2 hover:text-texto sm:min-h-0"
        >
          Cancelar
        </button>
      </div>
      <p className="mt-1 text-sm text-texto-suave">
        {DEMO_MODE
          ? "Modo demo: la respuesta de ejemplo aparece en un momento."
          : "Suele tardar entre 30 y 90 segundos."}
      </p>

      <div className="brillo mt-7 space-y-7" aria-hidden>
        <Bloque lineas={["40%", "100%", "92%", "70%"]} />
        <Bloque lineas={["52%", "100%", "84%"]} />
        <div className="space-y-2">
          <Barra ancho="34%" />
          <div className="rounded-xl border border-linea">
            <div className="h-9 rounded-t-xl bg-superficie-2" />
            <div className="space-y-3 p-3">
              <Barra ancho="100%" />
              <Barra ancho="100%" />
              <Barra ancho="100%" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloque({ lineas }: { lineas: string[] }) {
  return (
    <div className="space-y-2.5">
      {lineas.map((ancho, indice) => (
        <Barra key={indice} ancho={ancho} alto={indice === 0 ? "h-4" : "h-3"} />
      ))}
    </div>
  );
}

function Barra({ ancho, alto = "h-3" }: { ancho: string; alto?: string }) {
  return (
    <div
      className={`${alto} rounded-full bg-superficie-2`}
      style={{ width: ancho }}
    />
  );
}

function ErrorEstado({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-peligro-borde bg-peligro-suave px-3 py-4 text-[13px] text-peligro-texto sm:px-4 sm:text-sm">
      <IconoAlerta className="mt-0.5 size-5 shrink-0 text-peligro" />
      <div>
        <p className="font-semibold">
          No se pudieron generar las recomendaciones
        </p>
        <p className="mt-1 leading-relaxed">{mensaje}</p>
      </div>
    </div>
  );
}
