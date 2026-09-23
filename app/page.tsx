"use client";

import { useEffect, useRef, useState } from "react";

import { IconoFlecha, IconoInfo, IconoSpinner } from "@/components/Iconos";
import { ResultPanel, type ResultStatus } from "@/components/ResultPanel";
import { TextAreaField } from "@/components/TextAreaField";
import { DEMO_MODE } from "@/lib/config";
import {
  EJEMPLO_CLIENTE,
  EJEMPLO_DOCUMENTOS,
  EJEMPLO_PROPIEDADES,
  PLACEHOLDER_DOCUMENTOS,
} from "@/lib/ejemplos";

export default function Home() {
  const [datosCliente, setDatosCliente] = useState("");
  const [propiedades, setPropiedades] = useState("");
  const [documentos, setDocumentos] = useState("");

  const [status, setStatus] = useState<ResultStatus>("idle");
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [segundos, setSegundos] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const resultadosRef = useRef<HTMLDivElement | null>(null);

  // Contador de espera: sin streaming en pantalla, es la única señal de que la
  // generación sigue viva durante los 30-90 s que tarda.
  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Si el componente se desmonta a mitad de una generación, se corta la petición.
  useEffect(() => () => abortRef.current?.abort(), []);

  const generando = status === "loading";
  const puedeGenerar =
    datosCliente.trim().length > 0 && propiedades.trim().length > 0;
  const vacio =
    datosCliente.trim().length === 0 &&
    propiedades.trim().length === 0 &&
    documentos.trim().length === 0;

  function usarEjemplo() {
    setDatosCliente(EJEMPLO_CLIENTE);
    setPropiedades(EJEMPLO_PROPIEDADES);
    setDocumentos(EJEMPLO_DOCUMENTOS);
  }

  /**
   * En móvil y tablet el panel de resultados queda debajo del formulario, así
   * que al generar no se vería nada pasar. En escritorio ya está a la vista.
   */
  function irAResultados() {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultadosRef.current?.scrollIntoView({
      behavior: suave ? "smooth" : "auto",
      block: "start",
    });
  }

  function cancelar() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus(resultado ? "done" : "idle");
  }

  async function generar(event: React.FormEvent) {
    event.preventDefault();
    if (!puedeGenerar || generando) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setSegundos(0);
    setError("");
    setResultado("");
    setTruncated(false);
    irAResultados();

    try {
      const respuesta = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datosCliente, propiedades, documentos }),
        signal: controller.signal,
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        setError(
          datos?.error ??
            `El servidor respondió con un error (${respuesta.status}).`,
        );
        setStatus("error");
        return;
      }

      setResultado(datos.text);
      setTruncated(Boolean(datos.truncated));
      setStatus("done");
    } catch (err) {
      // Una cancelación deliberada no es un error que mostrar.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        "No se pudo contactar al servidor. Revisa que la app siga corriendo e inténtalo de nuevo.",
      );
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-8 sm:px-6 lg:px-8 lg:pb-16">
      {DEMO_MODE && <FranjaDemo />}

      {/* `min-w-0` en la rejilla y en sus dos columnas: un item de grid no se
          encoge por debajo del ancho mínimo de su contenido, así que sin esto
          la tabla comparativa ensancha la columna y, con ella, la página. */}
      <div className="grid min-w-0 gap-5 pt-5 sm:gap-6 sm:pt-6 lg:grid-cols-12 xl:gap-10">
        <form onSubmit={generar} className="min-w-0 space-y-4 lg:col-span-5">
          <TextAreaField
            id="datos-cliente"
            step={1}
            label="Datos del Cliente"
            description="Datos personales, preferencias de búsqueda y situación financiera."
            value={datosCliente}
            onChange={setDatosCliente}
            placeholder={EJEMPLO_CLIENTE}
            rows={12}
            disabled={generando}
            accion={
              vacio && !generando ? (
                <button
                  type="button"
                  onClick={usarEjemplo}
                  className="inline-flex min-h-11 items-center rounded-md text-xs font-semibold text-marca underline underline-offset-2 transition-colors duration-200 hover:text-marca-fuerte focus:outline-none focus-visible:ring-2 focus-visible:ring-marca/30 sm:min-h-0"
                >
                  Usar datos de ejemplo
                </button>
              ) : null
            }
          />

          <TextAreaField
            id="propiedades"
            step={2}
            label="Lista de Propiedades"
            description="Una propiedad por bloque: ubicación, precio, cuartos, baños y características."
            value={propiedades}
            onChange={setPropiedades}
            placeholder={EJEMPLO_PROPIEDADES}
            rows={12}
            disabled={generando}
          />

          <TextAreaField
            id="documentos"
            step={3}
            label="Documentos / Información adicional"
            description="Cualquier contexto extra que deba considerarse."
            value={documentos}
            onChange={setDocumentos}
            placeholder={PLACEHOLDER_DOCUMENTOS}
            rows={5}
            optional
            disabled={generando}
          />

          {/* En móvil y tablet la acción se queda pegada al borde inferior: el
              formulario son tres campos largos y el botón quedaba enterrado al
              final. Desde lg vuelve a ser una tarjeta más de la columna. */}
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-linea bg-fondo/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:rounded-2xl lg:border lg:bg-superficie lg:p-5 lg:shadow-tarjeta lg:backdrop-blur-none">
            <button
              type="submit"
              disabled={!puedeGenerar || generando}
              aria-busy={generando}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-marca px-6 py-3.5 text-[15px] font-semibold text-marca-contraste shadow-sm transition duration-200 hover:bg-marca-fuerte focus:outline-none focus-visible:ring-4 focus-visible:ring-marca/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-superficie-2 disabled:text-texto-suave disabled:shadow-none disabled:active:scale-100"
            >
              {generando ? (
                <>
                  <IconoSpinner className="size-4.5 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  Generar recomendaciones
                  <IconoFlecha className="size-4.5" />
                </>
              )}
            </button>

            <p className="mt-2 text-center text-[11px] leading-relaxed text-texto-suave sm:mt-2.5 sm:text-xs">
              {!puedeGenerar
                ? "Completa los pasos 1 y 2 para continuar."
                : generando
                  ? "Puedes cancelar la generación desde el panel de resultados."
                  : "Obtendrás el análisis comparativo y un email listo para enviar."}
            </p>
          </div>
        </form>

        <div
          ref={resultadosRef}
          className="min-w-0 scroll-mt-[calc(var(--alto-header)_+_1rem)] lg:sticky lg:top-[calc(var(--alto-header)_+_1.5rem)] lg:col-span-7 lg:flex lg:max-h-[calc(100dvh_-_var(--alto-header)_-_3rem)] lg:self-start"
        >
          <ResultPanel
            status={status}
            resultado={resultado}
            error={error}
            truncated={truncated}
            segundos={segundos}
            onCancelar={cancelar}
          />
        </div>
      </div>
    </main>
  );
}

/**
 * Franja informativa del modo demo.
 *
 * El chip del header ya lo señala; esta línea explica qué significa, para que
 * nadie confunda el resultado con un análisis hecho por Claude.
 */
function FranjaDemo() {
  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-2.5 rounded-xl border border-aviso-borde bg-aviso-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-aviso-texto sm:px-4 sm:text-[13px]"
    >
      <IconoInfo className="mt-0.5 size-4 shrink-0 text-aviso" />
      <p>
        <strong className="font-semibold">Modo Demo:</strong> el análisis se
        genera localmente comparando el texto que pegas, sin llamar a ninguna
        API. Más adelante se conectará Claude.
      </p>
    </div>
  );
}
