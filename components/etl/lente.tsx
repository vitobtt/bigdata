import { formatoDecimal, formatoEntero, formatoFechaUtc } from "@/lib/formato"
import type { EstadisticasCiudad } from "@/lib/etl/estadisticas"
import { cn } from "@/lib/utils"

const CX = 120
const CY = 120
const R = 96

/** Punto de la circunferencia. Ángulo en grados: 0 = derecha, 90 = abajo. */
function punto(grados: number, radio: number): [number, number] {
  const a = (grados * Math.PI) / 180
  // Redondeado: evita diferencias de decimales entre servidor y navegador al hidratar.
  const r2 = (n: number) => Math.round(n * 100) / 100
  return [r2(CX + Math.cos(a) * radio), r2(CY + Math.sin(a) * radio)]
}

function arco(desde: number, hasta: number, radio: number) {
  const [x0, y0] = punto(desde, radio)
  const [x1, y1] = punto(hasta, radio)
  const grande = Math.abs(hasta - desde) > 180 ? 1 : 0
  return `M${x0.toFixed(2)},${y0.toFixed(2)}A${radio},${radio} 0 ${grande} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
}

/** Longitud del arco de 180° para pintarlo con dasharray. */
const MEDIA_VUELTA = Math.PI * R

/**
 * Atmospheric Data Lens: lectura unificada de una ciudad con datos reales.
 * - Arco superior: humedad relativa media (escala real 0–100 %).
 * - Centro: temperatura media y extremos observados.
 * - Arco inferior: lluvia acumulada, relativa a la ciudad más lluviosa.
 * Sin datos descargados, muestra el estado de la ciudad y nada inventado.
 */
export function LenteAtmosferica({
  nombre,
  color,
  estadoTexto,
  stats,
  lluviaMaxima,
  ultimoRegistro,
  className,
}: {
  nombre: string
  color: string
  estadoTexto: string
  stats?: EstadisticasCiudad
  /** Mayor lluvia total entre las ciudades con datos (escala relativa). */
  lluviaMaxima: number
  ultimoRegistro?: string
  className?: string
}) {
  const humedad = stats ? Math.min(100, Math.max(0, stats.humedadMedia)) : 0
  const lluviaRel =
    stats && lluviaMaxima > 0 ? Math.min(1, stats.lluviaTotal / lluviaMaxima) : 0

  const resumen = stats
    ? `${nombre}: temperatura media ${formatoDecimal(stats.temperaturaMedia)} grados, mínima ${formatoDecimal(stats.temperaturaMin, 0)} y máxima ${formatoDecimal(stats.temperaturaMax, 0)}; humedad media ${formatoDecimal(stats.humedadMedia, 0)} por ciento; lluvia total ${formatoDecimal(stats.lluviaTotal, 1)} milímetros.`
    : `${nombre}: ${estadoTexto}.`

  // 60 marcas de la corona exterior; cada 5.ª es más larga.
  const marcas = Array.from({ length: 60 }, (_, i) => {
    const largo = i % 5 === 0 ? 7 : 3.5
    const [x0, y0] = punto(i * 6, 111)
    const [x1, y1] = punto(i * 6, 111 - largo)
    return { i, x0, y0, x1, y1, larga: i % 5 === 0 }
  })

  return (
    <figure
      className={cn("lente", className)}
      data-datos={stats ? "" : undefined}
      style={{ "--color-ciudad": color } as React.CSSProperties}
    >
      <svg viewBox="0 0 240 240" role="img" aria-label={resumen}>
        {/* Corona de marcas */}
        <g stroke="currentColor" strokeWidth="0.8" className="lente-marcas">
          {marcas.map((m) => (
            <line
              key={m.i}
              x1={m.x0}
              y1={m.y0}
              x2={m.x1}
              y2={m.y1}
              strokeOpacity={m.larga ? 0.55 : 0.22}
            />
          ))}
        </g>
        <circle
          cx={CX}
          cy={CY}
          r="76"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="0.8"
          strokeDasharray="2 4"
        />

        {/* Humedad: arco superior, de izquierda (0 %) a derecha (100 %) */}
        <path
          d={arco(180, 360, R)}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="5"
        />
        <path
          className="lente-arco"
          d={arco(180, 360, R)}
          fill="none"
          stroke="var(--m-hum)"
          strokeWidth="5"
          strokeLinecap="butt"
          strokeDasharray={MEDIA_VUELTA}
          strokeDashoffset={MEDIA_VUELTA * (1 - humedad / 100)}
        />
        {[0, 50, 100].map((v) => {
          const [x, y] = punto(180 + (v / 100) * 180, R + 9)
          return (
            <text
              key={v}
              x={x}
              y={y + 3}
              textAnchor="middle"
              className="lente-micro"
            >
              {v}
            </text>
          )
        })}
        <text x={CX} y={CY - 64} textAnchor="middle" className="lente-micro">
          {stats ? `HUM ${formatoDecimal(humedad, 0)} %` : "HUM — %"}
        </text>

        {/* Lluvia: arco inferior, relativo a la ciudad más lluviosa */}
        <path
          d={arco(0, 180, R)}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="5"
        />
        <path
          className="lente-arco"
          d={arco(0, 180, R)}
          fill="none"
          stroke="var(--m-lluvia)"
          strokeWidth="5"
          strokeDasharray={MEDIA_VUELTA}
          strokeDashoffset={MEDIA_VUELTA * (1 - lluviaRel)}
        />
        <text x={CX} y={CY + 72} textAnchor="middle" className="lente-micro">
          {stats ? `LLUVIA ${formatoDecimal(stats.lluviaTotal, 1)} mm` : "LLUVIA — mm"}
        </text>

        {/* Núcleo: temperatura */}
        {stats ? (
          <>
            <text x={CX} y={CY + 14} textAnchor="middle" className="lente-temp">
              {formatoDecimal(stats.temperaturaMedia)}
            </text>
            <text x={CX} y={CY + 30} textAnchor="middle" className="lente-unidad">
              °C · MEDIA
            </text>
            <text x={CX} y={CY - 26} textAnchor="middle" className="lente-nombre">
              {nombre.toUpperCase()}
            </text>
            <text x={CX} y={CY + 44} textAnchor="middle" className="lente-micro">
              MÍN {formatoDecimal(stats.temperaturaMin, 0)} · MÁX{" "}
              {formatoDecimal(stats.temperaturaMax, 0)}
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY - 6} textAnchor="middle" className="lente-nombre">
              {nombre.toUpperCase()}
            </text>
            <text x={CX} y={CY + 12} textAnchor="middle" className="lente-micro">
              SIN LECTURAS
            </text>
            <text x={CX} y={CY + 26} textAnchor="middle" className="lente-micro">
              {estadoTexto.toUpperCase()}
            </text>
          </>
        )}
      </svg>
      <figcaption className="lente-pie">
        {stats
          ? `${formatoEntero(stats.registros)} h · ${ultimoRegistro ? `ÚLT. ${formatoFechaUtc(ultimoRegistro)} UTC` : "UTC"}`
          : "Descarga datos para ver la lectura"}
      </figcaption>
    </figure>
  )
}
