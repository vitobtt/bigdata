"use client"

import * as React from "react"
import { ChartLineIcon, CloudRainIcon, TableIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { COLOR_CIUDAD, estadisticasPorCiudad } from "@/lib/etl/estadisticas"
import type { Medicion } from "@/lib/etl/tipos"
import { formatoDecimal, formatoEntero, formatoFechaUtc } from "@/lib/formato"

const HORA = 3_600_000

/** Ancho real del contenedor, para dibujar el SVG a escala 1:1. */
function useAncho<T extends HTMLElement>() {
  // Callback ref: se engancha también si el elemento aparece más tarde.
  const [elemento, ref] = React.useState<T | null>(null)
  const [ancho, setAncho] = React.useState(0)
  React.useEffect(() => {
    if (!elemento) return
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    ro.observe(elemento)
    return () => ro.disconnect()
  }, [elemento])
  return [ref, ancho] as const
}

/** Marcas «redondas» para el eje Y (múltiplos de 1, 2, 5 o 10). */
function marcasEje(min: number, max: number, objetivo = 5) {
  const paso0 = (max - min) / objetivo || 1
  const mag = 10 ** Math.floor(Math.log10(paso0))
  const paso = [1, 2, 5, 10].map((m) => m * mag).find((p) => p >= paso0)!
  const inicio = Math.floor(min / paso) * paso
  const fin = Math.ceil(max / paso) * paso
  const marcas: number[] = []
  for (let v = inicio; v <= fin + paso / 2; v += paso)
    marcas.push(+v.toFixed(6))
  return marcas
}

function Leyenda({ ciudades }: { ciudades: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Leyenda">
      {ciudades.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={{ background: COLOR_CIUDAD[c] }}
          />
          {c}
        </li>
      ))}
    </ul>
  )
}

function GraficaTemperatura({ filas }: { filas: Medicion[] }) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const [hover, setHover] = React.useState<number | null>(null)
  const alto = 260
  const m = { izq: 40, der: 12, sup: 12, inf: 28 }

  const datos = React.useMemo(() => {
    const series = new Map<string, { t: number; v: number }[]>()
    const instantes = new Set<number>()
    for (const f of filas) {
      const t = Date.parse(f.fecha_hora)
      instantes.add(t)
      const s = series.get(f.ciudad) ?? []
      s.push({ t, v: f.temperatura_c })
      series.set(f.ciudad, s)
    }
    for (const s of series.values()) s.sort((a, b) => a.t - b.t)
    const tiempos = [...instantes].sort((a, b) => a - b)
    const valores = filas.map((f) => f.temperatura_c)
    // Orden fijo de ciudades: el color sigue a la ciudad.
    const ciudades = CIUDADES.map((c) => c.nombre).filter((c) => series.has(c))
    return {
      series,
      tiempos,
      ciudades,
      min: Math.min(...valores),
      max: Math.max(...valores),
    }
  }, [filas])

  if (filas.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Ningún registro cumple los filtros actuales.
      </p>
    )
  }

  const { series, tiempos, ciudades } = datos
  const t0 = tiempos[0]
  const t1 = Math.max(tiempos[tiempos.length - 1], t0 + HORA)
  const marcasY = marcasEje(datos.min, datos.max)
  const y0 = marcasY[0]
  const y1 = marcasY[marcasY.length - 1]
  const anchoUtil = Math.max(ancho - m.izq - m.der, 10)
  const altoUtil = alto - m.sup - m.inf
  const x = (t: number) => m.izq + ((t - t0) / (t1 - t0)) * anchoUtil
  const y = (v: number) => m.sup + (1 - (v - y0) / (y1 - y0 || 1)) * altoUtil

  // Marcas del eje X: un día cada N, según el espacio disponible.
  const dias = Math.ceil((t1 - t0) / (24 * HORA))
  const cadaDias = Math.max(
    1,
    Math.ceil(dias / Math.max(1, Math.floor(anchoUtil / 70)))
  )
  const marcasX: number[] = []
  const primerDia = Math.ceil(t0 / (24 * HORA)) * 24 * HORA
  for (let t = primerDia; t <= t1; t += cadaDias * 24 * HORA) marcasX.push(t)
  if (marcasX.length === 0) marcasX.push(t0)

  const trazado = (puntos: { t: number; v: number }[]) => {
    let d = ""
    puntos.forEach((p, i) => {
      // Se corta la línea si faltan horas: no se inventan valores intermedios.
      const salto = i === 0 || p.t - puntos[i - 1].t > HORA
      d += `${salto ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`
    })
    return d
  }

  const instante = hover === null ? null : tiempos[hover]
  const valoresHover =
    instante === null
      ? []
      : ciudades
          .map((c) => ({ c, p: series.get(c)!.find((p) => p.t === instante) }))
          .filter((e): e is { c: string; p: { t: number; v: number } } => !!e.p)
          .sort((a, b) => b.p.v - a.p.v)

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0)
    // Búsqueda binaria del instante más cercano.
    let lo = 0
    let hi = tiempos.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tiempos[mid] < t) lo = mid + 1
      else hi = mid
    }
    if (lo > 0 && t - tiempos[lo - 1] < tiempos[lo] - t) lo--
    setHover(lo)
  }

  return (
    <div className="flex flex-col gap-2">
      <Leyenda ciudades={ciudades} />
      <div ref={ref} className="relative w-full">
        {ancho > 0 && (
          <svg
            width={ancho}
            height={alto}
            role="img"
            aria-label={`Temperatura por hora de ${ciudades.join(", ")}, entre ${datos.min} y ${datos.max} grados`}
          >
            {marcasY.map((v) => (
              <g key={v}>
                <line
                  x1={m.izq}
                  x2={ancho - m.der}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--grafica-rejilla)"
                />
                <text
                  x={m.izq - 6}
                  y={y(v) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground num-secundario text-[10px]"
                >
                  {v}
                </text>
              </g>
            ))}
            <text
              x={4}
              y={m.sup - 2}
              className="fill-muted-foreground text-[10px]"
            >
              °C
            </text>
            <line
              x1={m.izq}
              x2={ancho - m.der}
              y1={alto - m.inf}
              y2={alto - m.inf}
              stroke="var(--grafica-eje)"
            />
            {marcasX.map((t) => (
              <text
                key={t}
                x={x(t)}
                y={alto - m.inf + 16}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {new Date(t).toISOString().slice(8, 10)}/
                {new Date(t).toISOString().slice(5, 7)}
              </text>
            ))}
            {ciudades.map((c) => (
              <path
                key={c}
                d={trazado(series.get(c)!)}
                fill="none"
                stroke={COLOR_CIUDAD[c]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {instante !== null && (
              <g pointerEvents="none">
                <line
                  x1={x(instante)}
                  x2={x(instante)}
                  y1={m.sup}
                  y2={alto - m.inf}
                  stroke="var(--foreground)"
                  strokeOpacity={0.4}
                />
                {valoresHover.map(({ c, p }) => (
                  <circle
                    key={c}
                    cx={x(p.t)}
                    cy={y(p.v)}
                    r={4.5}
                    fill={COLOR_CIUDAD[c]}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )}
            <rect
              x={m.izq}
              y={m.sup}
              width={anchoUtil}
              height={altoUtil}
              fill="transparent"
              onPointerMove={mover}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
        {instante !== null && (
          <div
            className="vidrio pointer-events-none absolute top-2 z-10 min-w-36 rounded-md p-2 text-xs"
            style={
              x(instante) > ancho / 2
                ? { right: ancho - x(instante) + 10 }
                : { left: x(instante) + 10 }
            }
          >
            <p className="mb-1 font-mono text-muted-foreground">
              {formatoFechaUtc(new Date(instante).toISOString())} UTC
            </p>
            <ul>
              {valoresHover.map(({ c, p }) => (
                <li key={c} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: COLOR_CIUDAD[c] }}
                    />
                    {c}
                  </span>
                  <span className="num-secundario">
                    {formatoDecimal(p.v)} °C
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function GraficaLluvia({ filas }: { filas: Medicion[] }) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const stats = React.useMemo(() => estadisticasPorCiudad(filas), [filas])
  const [hover, setHover] = React.useState<string | null>(null)
  if (stats.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Ningún registro cumple los filtros actuales.
      </p>
    )
  }
  const filaAlto = 34
  const etiquetaAncho = 84
  // Espacio para «65,2 mm · 56 h con lluvia» a la derecha de la barra más larga.
  const valorAncho = 200
  const alto = stats.length * filaAlto + 8
  const maximo = Math.max(...stats.map((s) => s.lluviaTotal))
  const anchoBarras = Math.max(ancho - etiquetaAncho - valorAncho, 20)

  return (
    <div ref={ref} className="w-full">
      {ancho > 0 && (
        <svg
          width={ancho}
          height={alto}
          role="img"
          aria-label="Lluvia total por ciudad en milímetros"
        >
          <line
            x1={etiquetaAncho}
            x2={etiquetaAncho}
            y1={0}
            y2={alto}
            stroke="var(--grafica-eje)"
          />
          {stats.map((s, i) => {
            const yc = 4 + i * filaAlto + filaAlto / 2
            const w = maximo > 0 ? (s.lluviaTotal / maximo) * anchoBarras : 0
            const r = Math.min(4, w)
            const h = 14
            const activo = hover === null || hover === s.ciudad
            return (
              <g
                key={s.ciudad}
                opacity={activo ? 1 : 0.45}
                onPointerEnter={() => setHover(s.ciudad)}
                onPointerLeave={() => setHover(null)}
              >
                <rect
                  x={0}
                  y={yc - filaAlto / 2}
                  width={ancho}
                  height={filaAlto}
                  fill="transparent"
                />
                <text
                  x={etiquetaAncho - 8}
                  y={yc + 4}
                  textAnchor="end"
                  className="fill-foreground text-[12px]"
                >
                  {s.ciudad}
                </text>
                {w > 0 && (
                  // Extremo de datos redondeado; la base queda recta sobre el eje.
                  <path
                    d={`M${etiquetaAncho},${yc - h / 2}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`}
                    fill={COLOR_CIUDAD[s.ciudad]}
                  />
                )}
                <text
                  x={etiquetaAncho + w + 8}
                  y={yc + 4}
                  className="fill-foreground num-secundario text-[11px]"
                >
                  {formatoDecimal(s.lluviaTotal, 1)} mm
                  <tspan className="fill-muted-foreground">
                    {" "}
                    · {formatoEntero(s.horasConLluvia)} h con lluvia
                  </tspan>
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export function Graficas({
  etl,
  verTabla,
}: {
  etl: PipelineEtl
  verTabla: () => void
}) {
  const filas = etl.coinciden
  const filtrado = filas.length !== etl.validos.length
  if (etl.validos.length === 0) return null

  return (
    <Card className="plano-2">
      <CardHeader>
        <CardTitle className="hud-titulo flex items-center gap-2 text-sm">
          <ChartLineIcon className="size-4 text-primary" aria-hidden />
          Lectura de los datos
        </CardTitle>
        <CardDescription>
          {filtrado
            ? `Muestran solo los ${formatoEntero(filas.length)} registros que cumplen tus filtros (de ${formatoEntero(etl.validos.length)} válidos).`
            : `Muestran los ${formatoEntero(filas.length)} registros válidos. Si aplicas filtros, las gráficas se actualizan.`}{" "}
          Así puedes revisar los datos antes de subirlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="titulo-temp"
          className="flex min-w-0 flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="titulo-temp" className="text-sm font-semibold">
              Temperatura hora a hora (°C, UTC)
            </h3>
            <Button variant="ghost" size="xs" onClick={verTabla}>
              <TableIcon /> Ver como tabla
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pasa el ratón por encima para ver el valor de cada ciudad a esa
            hora.
          </p>
          <GraficaTemperatura filas={filas} />
        </section>
        <section
          aria-labelledby="titulo-lluvia"
          className="flex min-w-0 flex-col gap-2"
        >
          <h3
            id="titulo-lluvia"
            className="flex items-center gap-1.5 text-sm font-semibold"
          >
            <CloudRainIcon
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Lluvia acumulada por ciudad (mm)
          </h3>
          <p className="text-xs text-muted-foreground">
            Suma de la precipitación de todas las horas y número de horas en las
            que llovió.
          </p>
          <GraficaLluvia filas={filas} />
        </section>
      </CardContent>
    </Card>
  )
}
