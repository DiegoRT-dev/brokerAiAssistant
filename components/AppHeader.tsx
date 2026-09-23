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
      <div className="mx-auto flex h-(--alto-header) w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-marca text-marca-contraste shadow-sm sm:size-9">
            <IconoEdificio className="size-4.5 sm:size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold tracking-tight text-texto sm:text-[15px]">
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
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-aviso-borde bg-aviso-suave px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-aviso-texto sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
      >
        <span className="size-1.5 rounded-full bg-aviso" aria-hidden />
        Modo Demo
      </span>
    );
  }

  return (
    <span
      title="Las recomendaciones se generan con la API de Claude."
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-marca-borde bg-marca-suave px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-marca sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs"
    >
      <span className="size-1.5 rounded-full bg-marca" aria-hidden />
      API conectada
    </span>
  );
}
