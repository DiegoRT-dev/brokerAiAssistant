import { IconoEdificio } from "@/components/Iconos";
import { DEMO_MODE } from "@/lib/config";

/**
 * Barra superior fija de la aplicación.
 *
 * Además de la marca, lleva el indicador de modo: en demo tiene que verse a
 * simple vista que el resultado no viene de Claude, sin necesidad de leer el
 * análisis para darse cuenta.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-superficie/85 backdrop-blur-md">
      <div className="mx-auto flex h-(--alto-header) w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-marca text-marca-contraste shadow-sm">
            <IconoEdificio className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-semibold tracking-tight text-texto">
              Broker AI Assistant
            </p>
            <p className="hidden truncate text-xs leading-tight text-texto-suave sm:block">
              Análisis comparativo de propiedades y email listo para enviar
            </p>
          </div>
        </div>

        <IndicadorModo />
      </div>
    </header>
  );
}

function IndicadorModo() {
  if (DEMO_MODE) {
    return (
      <span
        title="Modo demo: el análisis se genera localmente a partir del texto que pegas. No se llama a ninguna API."
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-aviso-borde bg-aviso-suave px-3 py-1.5 text-xs font-semibold text-aviso-texto"
      >
        <span className="size-1.5 rounded-full bg-aviso" aria-hidden />
        Modo Demo
      </span>
    );
  }

  return (
    <span
      title="Las recomendaciones se generan con la API de Claude."
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-marca-borde bg-marca-suave px-3 py-1.5 text-xs font-semibold text-marca"
    >
      <span className="size-1.5 rounded-full bg-marca" aria-hidden />
      API conectada
    </span>
  );
}
