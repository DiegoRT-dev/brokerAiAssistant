import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { MAX_TOKENS, MODEL, getAnthropic, tieneApiKey } from "@/lib/anthropic";
import { buildUserMessage } from "@/lib/build-user-message";
import { DEMO_DELAY_MS, DEMO_MODE } from "@/lib/config";
import { construirRespuestaDemo } from "@/lib/demo/generar";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

// El SDK de Anthropic necesita el runtime de Node, no Edge.
export const runtime = "nodejs";
// Una generación tarda entre 30 y 90 s; el default de la plataforma puede ser menor.
export const maxDuration = 300;

/** Tope por campo. Evita mandar un pegado accidental de megabytes a la API. */
const MAX_CARACTERES = 100_000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "El cuerpo de la petición no es JSON válido.");
  }

  // La validación corre igual en demo que en real, para que el comportamiento
  // de la interfaz sea idéntico cuando se conecte la API.
  const campos = leerCampos(body);
  if ("mensaje" in campos) {
    return error(400, campos.mensaje);
  }

  // ─── MODO DEMO ────────────────────────────────────────────────────────────
  // No se llama a Anthropic ni se toca el SDK: la respuesta se construye
  // localmente leyendo los mismos campos que recibiria la API. Para usar la
  // API real, pon NEXT_PUBLIC_DEMO_MODE=false en .env.local (ver
  // lib/config.ts). Todo lo que sigue es el camino real.
  if (DEMO_MODE) {
    await esperar(DEMO_DELAY_MS, request.signal);
    return NextResponse.json({
      text: construirRespuestaDemo(campos),
      truncated: false,
      demo: true,
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!tieneApiKey()) {
    return error(
      500,
      "Falta ANTHROPIC_API_KEY. Añádela en el archivo .env.local y reinicia el servidor.",
    );
  }

  try {
    const stream = getAnthropic().messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // El system prompt es idéntico en cada petición: marcarlo como cacheable
        // abarata las llamadas siguientes sin cambiar la respuesta.
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: buildUserMessage(campos) }],
      },
      // Streaming interno: el cliente recibe un único JSON al final, pero
      // transmitir evita que la petición HTTP a Anthropic expire en respuestas
      // largas. `signal` propaga la cancelación del navegador hasta la API.
      { signal: request.signal },
    );

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return error(
        422,
        "Claude declinó generar esta respuesta. Revisa el contenido de los campos e inténtalo de nuevo.",
      );
    }

    // `content` es una unión discriminada: hay que filtrar por `type`.
    const text = message.content
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n")
      .trim();

    if (!text) {
      return error(502, "Claude devolvió una respuesta vacía. Inténtalo de nuevo.");
    }

    return NextResponse.json({
      text,
      // Avisa a la UI de que la respuesta se cortó por el límite de tokens.
      truncated: message.stop_reason === "max_tokens",
      demo: false,
    });
  } catch (err) {
    // El error completo se registra en el servidor; al cliente solo va un
    // mensaje saneado, nunca trazas ni fragmentos de la clave.
    console.error("[recommendations] fallo al generar:", err);

    if (err instanceof Anthropic.APIUserAbortError) {
      // El usuario canceló: la respuesta no llegará a mostrarse.
      return error(499, "Generación cancelada.");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return error(
        500,
        "Falta o es inválida ANTHROPIC_API_KEY. Revisa tu archivo .env.local y reinicia el servidor.",
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return error(429, "Demasiadas peticiones a la API. Espera un momento e inténtalo de nuevo.");
    }
    if (err instanceof Anthropic.BadRequestError) {
      return error(400, `La API rechazó la petición: ${err.message}`);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return error(504, "No se pudo conectar con la API de Anthropic. Revisa tu conexión.");
    }
    if (err instanceof Anthropic.APIError) {
      return error(502, `Error de la API de Anthropic (${err.status ?? "sin código"}).`);
    }
    return error(500, "Error inesperado al generar las recomendaciones.");
  }
}

type CamposValidos = {
  datosCliente: string;
  propiedades: string;
  documentos: string;
};

function leerCampos(body: unknown): CamposValidos | { mensaje: string } {
  if (typeof body !== "object" || body === null) {
    return { mensaje: "Se esperaba un objeto JSON." };
  }

  const { datosCliente, propiedades, documentos } = body as Record<string, unknown>;

  for (const [valor, etiqueta] of [
    [datosCliente, "Datos del Cliente"],
    [propiedades, "Lista de Propiedades"],
  ] as const) {
    if (typeof valor !== "string" || !valor.trim()) {
      return { mensaje: `El campo "${etiqueta}" es obligatorio.` };
    }
    if (valor.length > MAX_CARACTERES) {
      return {
        mensaje: `"${etiqueta}" supera los ${MAX_CARACTERES.toLocaleString("es-MX")} caracteres. Recórtalo antes de generar.`,
      };
    }
  }

  if (documentos !== undefined && typeof documentos !== "string") {
    return { mensaje: 'El campo "Documentos" debe ser texto.' };
  }
  if (typeof documentos === "string" && documentos.length > MAX_CARACTERES) {
    return {
      mensaje: `"Documentos / Información adicional" supera los ${MAX_CARACTERES.toLocaleString("es-MX")} caracteres. Recórtalo antes de generar.`,
    };
  }

  return {
    datosCliente: datosCliente as string,
    propiedades: propiedades as string,
    documentos: (documentos as string | undefined) ?? "",
  };
}

function error(status: number, mensaje: string) {
  return NextResponse.json({ error: mensaje }, { status });
}

/** Espera cancelable, para que el botón "Cancelar" también funcione en demo. */
function esperar(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const id = setTimeout(termina, ms);
    signal.addEventListener("abort", termina, { once: true });

    function termina() {
      clearTimeout(id);
      signal.removeEventListener("abort", termina);
      resolve();
    }
  });
}
