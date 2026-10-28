const BARRAS = 16
const R_INTERIOR = 9

/**
 * Indicador radial de voz. Solo se anima mientras el navegador reproduce audio;
 * en silencio es un anillo quieto. No es un micrófono: no escucha nada.
 * (La API de síntesis no expone la señal de audio, así que el movimiento indica
 * «está hablando», no la amplitud real.)
 */
export function VisualizadorVoz({ hablando }: { hablando: boolean }) {
  return (
    <svg
      className="voz-visual"
      viewBox="-20 -20 40 40"
      role="img"
      aria-label={
        hablando ? "El asistente está hablando" : "El asistente está en silencio"
      }
      data-hablando={hablando ? "" : undefined}
    >
      <circle className="voz-anillo" r={R_INTERIOR - 2.5} />
      {Array.from({ length: BARRAS }, (_, i) => {
        const grados = (i / BARRAS) * 360
        return (
          <g key={i} transform={`rotate(${grados})`}>
            <line
              className="voz-barra"
              x1={R_INTERIOR}
              x2={R_INTERIOR + 9}
              y1={0}
              y2={0}
              style={
                {
                  "--i": i,
                  // Longitudes y ritmos desiguales para que no parezca un patrón mecánico.
                  "--dur": `${(0.5 + ((i * 7) % 5) * 0.11).toFixed(2)}s`,
                  "--min": (0.22 + ((i * 3) % 4) * 0.06).toFixed(2),
                } as React.CSSProperties
              }
            />
          </g>
        )
      })}
    </svg>
  )
}
