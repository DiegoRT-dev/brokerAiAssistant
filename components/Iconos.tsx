/**
 * Iconos de la interfaz, en SVG inline.
 *
 * Son pocos y pequeños, así que no se añade una dependencia de iconos: van
 * dibujados aquí con `currentColor` para que hereden el color del texto y
 * funcionen igual en claro y en oscuro.
 */

type IconoProps = {
  className?: string;
};

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Marca de la app: un edificio sencillo. */
export function IconoEdificio({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15" />
      <path d="M13 21V10h5a1 1 0 0 1 1 1v10" />
      <path d="M8 9h2M8 13h2M8 17h2M16 14h0M16 17h0" />
    </svg>
  );
}

export function IconoSobre({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3 7 8.4 5.6a1 1 0 0 0 1.2 0L21 7" />
    </svg>
  );
}

export function IconoCopiar({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

export function IconoCheck({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

export function IconoFlecha({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function IconoAlerta({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3.5 2.8 19a1 1 0 0 0 .87 1.5h16.66A1 1 0 0 0 21.2 19L12 3.5Z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.8h0" />
    </svg>
  );
}

export function IconoInfo({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h0" />
    </svg>
  );
}

export function IconoLista({ className }: IconoProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h0M4 12h0M4 18h0" />
    </svg>
  );
}

/** Círculo giratorio para el botón mientras se genera. */
export function IconoSpinner({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
