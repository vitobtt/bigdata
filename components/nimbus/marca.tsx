/**
 * Logotipo de NIMBUS: una «N» trazada con la geometría de una cubierta de
 * nubes (dos picos) dentro de un anillo segmentado. Solo gira mientras hay
 * una operación real en curso.
 */
export function Marca({ activo = false }: { activo?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="marca size-11 shrink-0"
      data-activo={activo ? "" : undefined}
      aria-hidden
    >
      <g className="marca-anillo">
        <circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.9"
          strokeWidth="1.2"
          strokeDasharray="38 8 12 8 38 8 12 8"
        />
      </g>
      <circle
        cx="24"
        cy="24"
        r="16.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.8"
      />
      <path
        d="M15 33V15l18 18V15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx="33" cy="15" r="2" fill="currentColor" />
    </svg>
  )
}
