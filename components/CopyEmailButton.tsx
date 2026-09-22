"use client";

import { useEffect, useState } from "react";

import { IconoCheck, IconoCopiar } from "@/components/Iconos";

type Estado = "idle" | "copiado" | "error";

type CopyEmailButtonProps = {
  /** La sección 6 ya aislada, o `null` si no se pudo reconocer. */
  email: string | null;
  variante?: "sutil" | "principal";
};

/**
 * Copia solo la sección 6 de la respuesta. Si no se pudo aislar el email, el
 * botón se deshabilita en lugar de copiar texto equivocado: el broker pegaría
 * ese contenido en un correo real.
 */
export function CopyEmailButton({
  email,
  variante = "sutil",
}: CopyEmailButtonProps) {
  const [estado, setEstado] = useState<Estado>("idle");

  useEffect(() => {
    if (estado === "idle") return;
    const id = setTimeout(() => setEstado("idle"), 2500);
    return () => clearTimeout(id);
  }, [estado]);

  async function copiar() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setEstado("copiado");
    } catch {
      // Falla si el navegador no está en un contexto seguro (HTTP en una IP
      // de red local, por ejemplo) o si el permiso está denegado.
      setEstado("error");
    }
  }

  if (!email) {
    return (
      <span
        title="No se encontró la sección “Email para el cliente” en la respuesta. Cópiala manualmente."
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-linea px-3 py-2 text-sm font-medium text-texto-suave/70"
      >
        <IconoCopiar className="size-4" />
        Email no detectado
      </span>
    );
  }

  const estilo =
    variante === "principal"
      ? "bg-marca text-marca-contraste shadow-sm hover:bg-marca-fuerte focus-visible:ring-marca/30"
      : "border border-linea bg-superficie text-texto hover:border-linea-fuerte hover:bg-superficie-2 focus-visible:ring-marca/20";

  return (
    <button
      type="button"
      onClick={copiar}
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition duration-200 focus:outline-none focus-visible:ring-4 ${estilo}`}
    >
      {estado === "copiado" ? (
        <IconoCheck className="size-4" />
      ) : (
        <IconoCopiar className="size-4" />
      )}
      {estado === "copiado" && "¡Copiado!"}
      {estado === "error" && "No se pudo copiar"}
      {estado === "idle" && "Copiar email"}
    </button>
  );
}
