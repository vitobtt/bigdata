"use client"

import * as React from "react"
import {
  CloudRainIcon,
  DatabaseIcon,
  DropletsIcon,
  ThermometerIcon,
} from "lucide-react"

import { ContadorTelemetria } from "@/components/hud/contador-telemetria"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import {
  estadisticasPorCiudad,
  type EstadisticasCiudad,
} from "@/lib/etl/estadisticas"
import { formatoDecimal, formatoEntero } from "@/lib/formato"
import { cn } from "@/lib/utils"

const RAD = Math.PI / 180
/** Redondeo para que servidor y navegador generen exactamente el mismo SVG. */
const r2 = (n: number) => Math.round(n * 100) / 100

function polar(cx: number, cy: number, r: number, grados: number): [number, number] {
  const a = grados * RAD
  return [r2(cx + Math.cos(a) * r), r2(cy + Math.sin(a) * r)]
}

/** Segmento de corona circular entre dos radios y dos ángulos. */
function segmento(
  cx: number,
  cy: number,
  rInt: number,
  rExt: number,
  a0: number,
  a1: number
) {
  const [x0, y0] = polar(cx, cy, rInt, a0)
  const [x1, y1] = polar(cx, cy, rExt, a0)
  const [x2, y2] = polar(cx, cy, rExt, a1)
  const [x3, y3] = polar(cx, cy, rInt, a1)
  return `M${x0},${y0}L${x1},${y1}A${rExt},${rExt} 0 0 1 ${x2},${y2}L${x3},${y3}A${rInt},${rInt} 0 0 0 ${x0},${y0}Z`
}

/** Cuántos segmentos de `n` corresponden a cada parte, sin dejar fuera ninguna parte no vacía. */
function repartir(partes: number[], n: number): number[] {
  const total = partes.reduce((a, b) => a + b, 0)
  if (total <= 0) return partes.map(() => 0)
  const cuentas = partes.map((p) => (p > 0 ? Math.max(1, Math.round((p / total) * n)) : 0))
  let suma = cuentas.reduce((a, b) => a + b, 0)
  // Ajusta con la parte mayor hasta que sumen exactamente n.
  const mayor = cuentas.indexOf(Math.max(...cuentas))
  while (suma > n) {
    cuentas[mayor]--
    suma--
  }
  while (suma < n) {
    cuentas[mayor]++
    suma++
  }
  return cuentas
}

/* ------------------------------------------------------------------ */
/* REGISTROS · radar con corona segmentada                            */
/* ------------------------------------------------------------------ */

function RadarRegistros({
  total,
  validos,
  rechazados,
  seleccionados,
}: {
  total: number
  validos: number
  rechazados: number
  seleccionados: number
}) {
  const N = 72
  const sinSeleccionar = Math.max(0, validos - seleccionados)
  const [cSel, cVal, cRech] = repartir([seleccionados, sinSeleccionar, rechazados], N)
  const clases = Array.from({ length: N }, (_, i) =>
    i < cSel
      ? "rad-sel"
      : i < cSel + cVal
        ? "rad-val"
        : i < cSel + cVal + cRech
          ? "rad-rech"
          : "rad-nada"
  )
  const pasos = 360 / N
  const anillos = [150, 128, 106, 84, 62, 40]
  const porcentajeValidos = total > 0 ? (validos / total) * 100 : 0

  return (
    <svg
      viewBox="0 0 400 400"
      className="radar"
      role="img"
      aria-label={`Registros: ${formatoEntero(total)} extraídos, ${formatoEntero(validos)} válidos, ${formatoEntero(rechazados)} rechazados y ${formatoEntero(seleccionados)} seleccionados para cargar.`}
    >
      <defs>
        <radialGradient id="radar-nucleo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(53 214 245 / 0.35)" />
          <stop offset="60%" stopColor="rgb(53 214 245 / 0.08)" />
          <stop offset="100%" stopColor="rgb(53 214 245 / 0)" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="168" fill="url(#radar-nucleo)" />
      {/* Anillos concéntricos y ejes */}
      <g fill="none" stroke="var(--primary)" strokeOpacity="0.2" strokeWidth="1">
        {anillos.map((r) => (
          <circle key={r} cx="200" cy="200" r={r} />
        ))}
        <circle cx="200" cy="200" r="158" strokeDasharray="2 6" strokeOpacity="0.45" />
        <path d="M200 30V370M30 200H370" strokeOpacity="0.28" />
        <path d="M80 80L320 320M320 80L80 320" strokeOpacity="0.12" />
      </g>
      {/* Corona segmentada: cada segmento es 1/72 del total */}
      <g>
        {clases.map((c, i) => (
          <path
            key={i}
            className={c}
            d={segmento(200, 200, 168, 190, -90 + i * pasos + 0.6, -90 + (i + 1) * pasos - 0.6)}
          />
        ))}
      </g>
      {/* Marcas cardinales */}
      <g fill="var(--primary)" fillOpacity="0.85">
        {[
          [200, 22],
          [378, 200],
          [200, 378],
          [22, 200],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width="8" height="8" />
        ))}
      </g>
      <text x="200" y="192" textAnchor="middle" className="radar-cifra">
        {formatoEntero(total)}
      </text>
      <text x="200" y="214" textAnchor="middle" className="radar-micro">
        FILAS EXTRAÍDAS
      </text>
      <text x="200" y="232" textAnchor="middle" className="radar-micro">
        {total > 0 ? `${formatoDecimal(porcentajeValidos, 0)} % VÁLIDAS` : "SIN DATOS"}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* TEMPERATURA · escala de 270° con banda mín–máx y marca de la media  */
/* ------------------------------------------------------------------ */

const T_MIN = -10
const T_MAX = 45

function InstrumentoTemperatura({ stats }: { stats?: EstadisticasCiudad }) {
  const N = 54
  const a0 = 135
  const barrido = 270
  const aTemp = (t: number) =>
    a0 + ((Math.min(T_MAX, Math.max(T_MIN, t)) - T_MIN) / (T_MAX - T_MIN)) * barrido
  const paso = barrido / N
  const iMin = stats ? Math.floor((aTemp(stats.temperaturaMin) - a0) / paso) : -1
  const iMax = stats ? Math.min(N - 1, Math.floor((aTemp(stats.temperaturaMax) - a0) / paso)) : -1
  const iMedia = stats ? Math.min(N - 1, Math.floor((aTemp(stats.temperaturaMedia) - a0) / paso)) : -1
  const marcas = [-10, 0, 10, 20, 30, 40]
  const [mx, my] = stats ? polar(100, 100, 66, aTemp(stats.temperaturaMedia)) : [0, 0]

  return (
    <svg
      viewBox="0 0 200 200"
      className="instrumento-svg"
      role="img"
      aria-label={
        stats
          ? `Temperatura: media ${formatoDecimal(stats.temperaturaMedia)} grados, mínima ${formatoDecimal(stats.temperaturaMin, 0)} y máxima ${formatoDecimal(stats.temperaturaMax, 0)}.`
          : "Temperatura: sin datos."
      }
    >
      {Array.from({ length: N }, (_, i) => {
        const enBanda = i >= iMin && i <= iMax
        const clase = i === iMedia ? "tmp-media" : enBanda ? "tmp-banda" : "tmp-apagado"
        return (
          <path
            key={i}
            className={clase}
            d={segmento(100, 100, i === iMedia ? 70 : 74, 88, a0 + i * paso + 0.5, a0 + (i + 1) * paso - 0.5)}
          />
        )
      })}
      {marcas.map((t) => {
        const [x, y] = polar(100, 100, 98, aTemp(t))
        return (
          <text key={t} x={x} y={y + 3} textAnchor="middle" className="instr-micro">
            {t}
          </text>
        )
      })}
      {stats && <circle cx={mx} cy={my} r="2.4" fill="var(--m-temp)" />}
      <text x="100" y="104" textAnchor="middle" className="instr-cifra instr-cifra-temp">
        {stats ? formatoDecimal(stats.temperaturaMedia) : "—"}
      </text>
      <text x="100" y="120" textAnchor="middle" className="instr-micro">
        °C · MEDIA
      </text>
      <text x="100" y="146" textAnchor="middle" className="instr-micro">
        {stats
          ? `MÍN ${formatoDecimal(stats.temperaturaMin, 0)} · MÁX ${formatoDecimal(stats.temperaturaMax, 0)}`
          : "SIN LECTURAS"}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* HUMEDAD · corona completa que se llena + ondas concéntricas         */
/* ------------------------------------------------------------------ */

function InstrumentoHumedad({ stats }: { stats?: EstadisticasCiudad }) {
  const N = 40
  const h = stats ? Math.min(100, Math.max(0, stats.humedadMedia)) : 0
  const paso = 360 / N
  return (
    <svg
      viewBox="0 0 200 200"
      className="instrumento-svg"
      role="img"
      aria-label={
        stats
          ? `Humedad relativa media: ${formatoDecimal(stats.humedadMedia, 0)} por ciento.`
          : "Humedad: sin datos."
      }
    >
      {Array.from({ length: N }, (_, i) => (
        <path
          key={i}
          className={(i + 0.5) / N <= h / 100 ? "hum-lleno" : "hum-apagado"}
          d={segmento(100, 100, 74, 90, -90 + i * paso + 0.6, -90 + (i + 1) * paso - 0.6)}
        />
      ))}
      {[62, 52, 42].map((r, i) => (
        <circle
          key={r}
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--m-hum)"
          strokeOpacity={0.2 - i * 0.05}
          strokeWidth="1"
        />
      ))}
      <text x="100" y="104" textAnchor="middle" className="instr-cifra instr-cifra-hum">
        {stats ? formatoDecimal(h, 0) : "—"}
      </text>
      <text x="100" y="120" textAnchor="middle" className="instr-micro">
        % · HUMEDAD MEDIA
      </text>
      <text x="100" y="146" textAnchor="middle" className="instr-micro">
        {stats ? `${formatoEntero(stats.registros)} LECTURAS` : "SIN LECTURAS"}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* LLUVIA · barras diarias reales sobre línea base punteada            */
/* ------------------------------------------------------------------ */

type Dia = { dia: string; mm: number }

function InstrumentoLluvia({
  dias,
  stats,
}: {
  dias: Dia[]
  stats?: EstadisticasCiudad
}) {
  const ANCHO = 360
  const ALTO = 200
  const base = 160
  const alto = 92
  const maximo = Math.max(0, ...dias.map((d) => d.mm))
  const ancho = dias.length > 0 ? (ANCHO - 40) / dias.length : 0
  const pico = maximo > 0 ? dias.find((d) => d.mm === maximo) : undefined

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="instrumento-svg instrumento-lluvia"
      role="img"
      aria-label={
        stats
          ? `Lluvia: ${formatoDecimal(stats.lluviaTotal, 1)} milímetros en total, ${stats.horasConLluvia} horas con lluvia${pico ? `; el día de más lluvia fue ${pico.dia} con ${formatoDecimal(pico.mm, 1)} milímetros` : ""}.`
          : "Lluvia: sin datos."
      }
    >
      {/* Línea base punteada y referencia del máximo */}
      <line
        x1="30"
        x2={ANCHO - 10}
        y1={base}
        y2={base}
        stroke="var(--m-lluvia)"
        strokeOpacity="0.55"
        strokeDasharray="2 4"
      />
      <line
        x1="30"
        x2={ANCHO - 10}
        y1={base - alto}
        y2={base - alto}
        stroke="var(--muted-foreground)"
        strokeOpacity="0.2"
        strokeDasharray="1 5"
      />
      <text x="26" y={base - alto + 3} textAnchor="end" className="instr-micro">
        {maximo > 0 ? formatoDecimal(maximo, 1) : "—"}
      </text>
      <text x="26" y={base + 3} textAnchor="end" className="instr-micro">
        0
      </text>
      {dias.map((d, i) => {
        const h = maximo > 0 ? (d.mm / maximo) * alto : 0
        const x = r2(30 + i * ancho + ancho * 0.18)
        return (
          <rect
            key={d.dia}
            className={cn("lluvia-barra", d.mm === maximo && maximo > 0 && "lluvia-pico")}
            x={x}
            y={r2(base - Math.max(h, d.mm > 0 ? 1.5 : 0))}
            width={r2(Math.max(1, ancho * 0.64))}
            height={r2(Math.max(h, d.mm > 0 ? 1.5 : 0))}
          >
            <title>{`${d.dia}: ${formatoDecimal(d.mm, 1)} mm`}</title>
          </rect>
        )
      })}
      {dias.length > 0 && (
        <>
          <text x="30" y={base + 16} className="instr-micro">
            {dias[0].dia.slice(8, 10)}/{dias[0].dia.slice(5, 7)}
          </text>
          <text x={ANCHO - 10} y={base + 16} textAnchor="end" className="instr-micro">
            {dias[dias.length - 1].dia.slice(8, 10)}/{dias[dias.length - 1].dia.slice(5, 7)}
          </text>
        </>
      )}
      <text x="30" y="28" className="instr-cifra instr-cifra-lluvia">
        {stats ? formatoDecimal(stats.lluviaTotal, 1) : "—"}
      </text>
      <text x="30" y="42" className="instr-micro">
        {stats ? `MM · ${stats.horasConLluvia} H CON LLUVIA` : "MM"}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

export function Instrumentos({ etl, foco }: { etl: PipelineEtl; foco: string }) {
  const ciudad = CIUDADES.find((c) => c.id === foco) ?? CIUDADES[0]
  const stats = React.useMemo(
    () => estadisticasPorCiudad(etl.validos).find((s) => s.ciudad === ciudad.nombre),
    [etl.validos, ciudad.nombre]
  )
  const dias = React.useMemo<Dia[]>(() => {
    const acumulado = new Map<string, number>()
    for (const f of etl.validos) {
      if (f.ciudad !== ciudad.nombre) continue
      const dia = f.fecha_hora.slice(0, 10)
      acumulado.set(dia, (acumulado.get(dia) ?? 0) + f.precipitacion_mm)
    }
    return [...acumulado.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([dia, mm]) => ({ dia, mm }))
  }, [etl.validos, ciudad.nombre])

  const total = etl.fases?.transformacion.filas.length ?? 0
  const rechazados = etl.fases?.limpieza.rechazados.length ?? 0
  const validos = etl.validos.length
  const fuera = etl.contadoresSeleccion.seleccionadosFueraDeFiltros

  return (
    <section className="instrumentos plano-2" aria-labelledby="titulo-instr">
      <header className="escena-cabecera">
        <span className="rotulo-vertical" aria-hidden>
          Instrumentos · 02
        </span>
        <div>
          <h2 id="titulo-instr" className="hud-titulo text-base sm:text-lg">
            Cuadro de instrumentos
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada magnitud tiene su propio instrumento. Registros del proceso a
            la vista y, debajo, la lectura de la ciudad enfocada en el mapa:{" "}
            <strong className="font-medium text-foreground">{ciudad.nombre}</strong>.
          </p>
        </div>
      </header>

      {/* Registros: radar central con sus lecturas satélite */}
      <div className="instr-registros" aria-live="polite">
        <dl className="instr-sat instr-sat-izq">
          <ContadorTelemetria
            indice="01"
            etiqueta="Total extraído"
            valor={total}
            unidad="filas"
            nota="tras transformar"
          />
          <ContadorTelemetria
            indice="02"
            etiqueta="Válidos"
            valor={validos}
            unidad="filas"
            referencia={{ parte: validos, total, texto: "superan la limpieza" }}
          />
          <ContadorTelemetria
            indice="03"
            etiqueta="Rechazados"
            valor={rechazados}
            unidad="filas"
            referencia={{ parte: rechazados, total, texto: "por calidad o duplicado" }}
          />
        </dl>
        <figure className="instr-radar">
          <RadarRegistros
            total={total}
            validos={validos}
            rechazados={rechazados}
            seleccionados={etl.aCargar.length}
          />
          <figcaption className="instr-leyenda">
            <span><i className="rad-sel" />Seleccionados</span>
            <span><i className="rad-val" />Válidos sin seleccionar</span>
            <span><i className="rad-rech" />Rechazados</span>
          </figcaption>
        </figure>
        <dl className="instr-sat instr-sat-der">
          <ContadorTelemetria
            indice="04"
            etiqueta="Coinciden con los filtros"
            valor={etl.coinciden.length}
            unidad="filas"
            referencia={{ parte: etl.coinciden.length, total: validos, texto: "de los válidos" }}
          />
          <ContadorTelemetria
            indice="05"
            etiqueta="Seleccionados para cargar"
            valor={etl.aCargar.length}
            unidad="filas"
            destacado
            referencia={{ parte: etl.aCargar.length, total: validos, texto: "de los válidos" }}
            nota={fuera ? `+${formatoEntero(fuera)} fuera de filtros (no se suben)` : undefined}
          />
        </dl>
      </div>

      {/* Magnitudes meteorológicas de la ciudad enfocada */}
      <div className="instr-ciudad">
        <figure className="instrumento" data-magnitud="temp">
          <figcaption className="instrumento-titulo">
            <ThermometerIcon className="size-4" aria-hidden /> Temperatura
          </figcaption>
          <InstrumentoTemperatura stats={stats} />
        </figure>
        <figure className="instrumento" data-magnitud="hum">
          <figcaption className="instrumento-titulo">
            <DropletsIcon className="size-4" aria-hidden /> Humedad relativa
          </figcaption>
          <InstrumentoHumedad stats={stats} />
        </figure>
        <figure className="instrumento instrumento-ancho" data-magnitud="lluvia">
          <figcaption className="instrumento-titulo">
            <CloudRainIcon className="size-4" aria-hidden /> Lluvia diaria
          </figcaption>
          <InstrumentoLluvia dias={dias} stats={stats} />
        </figure>
      </div>
      {!stats && (
        <p className="etiqueta-tecnica">
          <DatabaseIcon className="mr-1 inline size-3" aria-hidden />
          Sin lecturas de {ciudad.nombre}: descarga datos para activar los
          instrumentos.
        </p>
      )}
    </section>
  )
}
