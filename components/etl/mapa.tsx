"use client"

import "@maptiler/sdk/dist/maptiler-sdk.css"

import * as React from "react"
import { MapPinnedIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import {
  COLOR_CIUDAD,
  estadisticasPorCiudad,
  type EstadisticasCiudad,
} from "@/lib/etl/estadisticas"
import { formatoDecimal, formatoEntero } from "@/lib/formato"
import {
  MAPA_ESQUEMA,
  TRAZADO_ESPANA,
  TRAZADO_VECINOS,
  proyectar,
} from "@/lib/mapa/espana"
import { cn } from "@/lib/utils"
import { InsigniaEstado, type Estado } from "./estado"

/** Nombres con los que aparecen nuestras ciudades en OpenStreetMap. */
const NOMBRES_EN_MAPA = [
  "Barcelona",
  "Madrid",
  "Sevilla",
  "Bilbao",
  "Bilbo",
  "Valencia",
  "València",
]

/** Clave pública de MapTiler (se restringe por dominio en MapTiler Cloud). */
const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

type EstadoCiudad =
  | "inactiva"
  | "seleccionada"
  | "pendiente"
  | "descargando"
  | "completada"
  | "error"

const TEXTO_ESTADO: Record<EstadoCiudad, [Estado, string]> = {
  inactiva: ["pendiente", "No seleccionada"],
  seleccionada: ["pendiente", "Lista para descargar"],
  pendiente: ["pendiente", "En cola"],
  descargando: ["en_curso", "Descargando…"],
  completada: ["completada", "Datos recibidos"],
  error: ["error", "Error al descargar"],
}

export type InfoCiudad = {
  ciudad: Ciudad
  color: string
  estado: EstadoCiudad
  stats?: EstadisticasCiudad
}

function useInfoCiudades(etl: PipelineEtl): InfoCiudad[] {
  const stats = React.useMemo(
    () => new Map(estadisticasPorCiudad(etl.validos).map((s) => [s.ciudad, s])),
    [etl.validos]
  )
  const ext = etl.extraccion
  return CIUDADES.map((ciudad) => {
    const descarga = ext?.descargas[ciudad.id]
    const estado: EstadoCiudad = descarga
      ? descarga.estado
      : etl.config.ciudades.includes(ciudad.id)
        ? "seleccionada"
        : "inactiva"
    return {
      ciudad,
      color: COLOR_CIUDAD[ciudad.nombre],
      estado,
      stats: stats.get(ciudad.nombre),
    }
  })
}

function etiquetaAccesible(i: InfoCiudad, marcada: boolean) {
  const accion = marcada
    ? "Pulsa para quitarla de la próxima extracción"
    : "Pulsa para añadirla a la próxima extracción"
  const temp = i.stats
    ? `, temperatura media ${formatoDecimal(i.stats.temperaturaMedia)} grados`
    : ""
  return `${i.ciudad.nombre}: ${TEXTO_ESTADO[i.estado][1]}${temp}. ${accion}.`
}

/** Mapa esquemático en SVG: se usa cuando no hay clave de MapTiler. */
function MapaEsquema({
  info,
  marcadas,
  alternar,
  bloqueado,
}: {
  info: InfoCiudad[]
  marcadas: string[]
  alternar: (id: string) => void
  bloqueado: boolean
}) {
  const { ancho, alto } = MAPA_ESQUEMA
  // Retícula cada 2 grados, como en un visor de coordenadas.
  const meridianos = [-8, -6, -4, -2, 0, 2, 4]
  const paralelos = [36, 38, 40, 42, 44]
  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="cursor-mira h-auto w-full"
      role="group"
      aria-label="Mapa esquemático de España con las cinco ciudades"
    >
      <defs>
        <radialGradient id="halo-mapa" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgb(42 212 255 / 0.10)" />
          <stop offset="100%" stopColor="rgb(42 212 255 / 0)" />
        </radialGradient>
      </defs>
      <rect width={ancho} height={alto} fill="url(#halo-mapa)" />
      {meridianos.map((lon) => {
        const [x] = proyectar(lon, 0)
        return (
          <g key={`m${lon}`}>
            <line
              x1={x}
              x2={x}
              y1={0}
              y2={alto}
              stroke="var(--grafica-rejilla)"
            />
            <text
              x={x + 3}
              y={alto - 6}
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {Math.abs(lon)}º{lon < 0 ? "O" : lon > 0 ? "E" : ""}
            </text>
          </g>
        )
      })}
      {paralelos.map((lat) => {
        const [, y] = proyectar(0, lat)
        return (
          <g key={`p${lat}`}>
            <line
              x1={0}
              x2={ancho}
              y1={y}
              y2={y}
              stroke="var(--grafica-rejilla)"
            />
            <text
              x={4}
              y={y - 3}
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {lat}ºN
            </text>
          </g>
        )
      })}
      <path
        d={TRAZADO_VECINOS}
        fill="rgb(143 179 196 / 0.06)"
        stroke="rgb(143 179 196 / 0.25)"
        strokeWidth={0.8}
      />
      <path
        d={TRAZADO_ESPANA}
        fill="rgb(42 212 255 / 0.07)"
        stroke="var(--primary)"
        strokeWidth={1.2}
        strokeOpacity={0.7}
      />

      {info.map((i) => {
        const [x, y] = proyectar(i.ciudad.longitud, i.ciudad.latitud)
        const marcada = marcadas.includes(i.ciudad.id)
        const activa = i.estado !== "inactiva"
        // Cerca del borde derecho, la etiqueta va a la izquierda del punto.
        const izquierda = x > ancho - 150
        const xTexto = izquierda ? x - 14 : x + 14
        const ancla = izquierda ? "end" : "start"
        return (
          <g
            key={i.ciudad.id}
            role="button"
            tabIndex={bloqueado ? -1 : 0}
            aria-pressed={marcada}
            aria-disabled={bloqueado}
            aria-label={etiquetaAccesible(i, marcada)}
            className={cn("outline-none", !bloqueado && "ciudad-objetivo")}
            onClick={() => !bloqueado && alternar(i.ciudad.id)}
            onKeyDown={(e) => {
              if (!bloqueado && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault()
                alternar(i.ciudad.id)
              }
            }}
          >
            {/* Zona de clic mayor que el punto */}
            <circle cx={x} cy={y} r={22} fill="transparent" />
            {/* Recuadro de «objetivo fijado» (visible al apuntar o enfocar) */}
            <path
              className="mira-objetivo"
              d={`M${x - 17},${y - 9}V${y - 17}H${x - 9}M${x + 9},${y - 17}H${x + 17}V${y - 9}M${x + 17},${y + 9}V${y + 17}H${x + 9}M${x - 9},${y + 17}H${x - 17}V${y + 9}`}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              style={{ filter: "drop-shadow(0 0 4px rgb(42 212 255 / 0.8))" }}
            />
            {i.estado === "descargando" && (
              <circle
                className="hud-pulso"
                cx={x}
                cy={y}
                r={9}
                fill="none"
                stroke={i.color}
                strokeWidth={2}
              />
            )}
            {(i.estado === "completada" || i.estado === "error") && (
              <circle
                cx={x}
                cy={y}
                r={12}
                fill="none"
                stroke={i.estado === "error" ? "var(--destructive)" : i.color}
                strokeWidth={1.5}
                strokeDasharray={i.estado === "error" ? "3 3" : undefined}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={7}
              fill={activa ? i.color : "var(--background)"}
              stroke={activa ? "var(--background)" : i.color}
              strokeWidth={2}
            />
            <text
              x={xTexto}
              y={y - 2}
              textAnchor={ancla}
              className="fill-foreground stroke-background stroke-[3px] text-[13px] font-semibold [paint-order:stroke]"
            >
              {i.ciudad.nombre}
            </text>
            <text
              x={xTexto}
              y={y + 12}
              textAnchor={ancla}
              className="fill-muted-foreground stroke-background stroke-[3px] font-mono text-[11px] [paint-order:stroke]"
            >
              {i.stats
                ? `${formatoDecimal(i.stats.temperaturaMedia)} °C media`
                : TEXTO_ESTADO[i.estado][1]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Mapa de MapTiler (estilo dataviz oscuro) con un marcador HTML por ciudad. */
function MapaMapTiler({
  clave,
  info,
  marcadas,
  alternar,
  bloqueado,
  alFallar,
}: {
  clave: string
  info: InfoCiudad[]
  marcadas: string[]
  alternar: (id: string) => void
  bloqueado: boolean
  /** Se llama si el mapa no llega a cargar (clave no válida, sin red…). */
  alFallar: (mensaje: string) => void
}) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const marcadores = React.useRef(new Map<string, HTMLButtonElement>())
  // Los manejadores de los marcadores leen siempre la última versión.
  const alternarRef = React.useRef(alternar)
  const bloqueadoRef = React.useRef(bloqueado)
  const alFallarRef = React.useRef(alFallar)
  React.useEffect(() => {
    alternarRef.current = alternar
    bloqueadoRef.current = bloqueado
    alFallarRef.current = alFallar
  })

  React.useEffect(() => {
    let cancelado = false
    let mapa: { remove: () => void } | null = null
    const elementos = marcadores.current
    void (async () => {
      try {
        const sdk = await import("@maptiler/sdk")
        if (cancelado || !contenedor.current) return
        sdk.config.apiKey = clave
        const m = new sdk.Map({
          container: contenedor.current,
          // «dataviz-dark»: el estilo v4 llega sin «id» y el SDK 4.2 lo rechaza.
          style: "dataviz-dark",
          // Encuadre de la Península con margen para las etiquetas.
          bounds: [
            [-9.8, 35.8],
            [4.4, 44.0],
          ],
          fitBoundsOptions: { padding: 16 },
          language: sdk.Language.SPANISH,
          navigationControl: "bottom-right",
          geolocateControl: false,
        })
        mapa = m
        let cargado = false
        m.on("load", () => {
          cargado = true
          // Oculta la etiqueta del mapa base de nuestras 5 ciudades (las rotula
          // el marcador); el resto de ciudades se mantiene como referencia.
          if (m.getLayer("City labels")) {
            m.setFilter("City labels", [
              "all",
              ["==", "class", "city"],
              ["has", "rank"],
              ["!in", "name", ...NOMBRES_EN_MAPA],
            ])
          }
        })
        // Solo un fallo antes de cargar (p. ej. el estilo) impide usar el mapa;
        // un error puntual de una tesela después no lo invalida.
        m.on("error", (e: { error?: { status?: number } }) => {
          if (cancelado || cargado) return
          const estado = e.error?.status
          alFallarRef.current(
            estado === 401 || estado === 403
              ? "la clave no es válida o no permite este dominio"
              : "no se pudo cargar el mapa"
          )
        })
        for (const c of CIUDADES) {
          const el = document.createElement("button")
          el.type = "button"
          el.className = "mapa-marcador"
          el.addEventListener("click", () => {
            if (!bloqueadoRef.current) alternarRef.current(c.id)
          })
          const mira = document.createElement("span")
          mira.className = "mapa-marcador-mira"
          const punto = document.createElement("span")
          punto.className = "mapa-marcador-punto"
          const nombre = document.createElement("span")
          nombre.className = "mapa-marcador-nombre"
          const dato = document.createElement("span")
          dato.className = "mapa-marcador-dato"
          el.append(mira, punto, nombre, dato)
          elementos.set(c.id, el)
          new sdk.Marker({ element: el, anchor: "left", offset: [-9, 0] })
            .setLngLat([c.longitud, c.latitud])
            .addTo(m)
        }
      } catch {
        if (!cancelado) alFallarRef.current("no se pudo iniciar el mapa")
      }
    })()
    return () => {
      cancelado = true
      mapa?.remove()
      elementos.clear()
    }
  }, [clave])

  // Actualiza los marcadores sin recrear el mapa.
  React.useEffect(() => {
    for (const i of info) {
      const el = marcadores.current.get(i.ciudad.id)
      if (!el) continue
      const marcada = marcadas.includes(i.ciudad.id)
      el.dataset.estado = i.estado
      el.style.setProperty("--color-ciudad", i.color)
      el.setAttribute("aria-pressed", String(marcada))
      el.setAttribute("aria-label", etiquetaAccesible(i, marcada))
      el.disabled = bloqueado
      el.querySelector(".mapa-marcador-nombre")!.textContent = i.ciudad.nombre
      el.querySelector(".mapa-marcador-dato")!.textContent = i.stats
        ? `${formatoDecimal(i.stats.temperaturaMedia)} °C media`
        : TEXTO_ESTADO[i.estado][1]
    }
  })

  return (
    <div
      ref={contenedor}
      className="cursor-mira aspect-[600/470] w-full overflow-hidden rounded-lg border"
      aria-label="Mapa de MapTiler con las cinco ciudades"
    />
  )
}

export function Mapa({ etl }: { etl: PipelineEtl }) {
  const info = useInfoCiudades(etl)
  const bloqueado = !!etl.extraccion?.enCurso || !!etl.carga?.enCurso
  const marcadas = etl.config.ciudades
  const alternar = (id: string) =>
    etl.alternarCiudadExtraccion(id, !marcadas.includes(id))
  const props = { info, marcadas, alternar, bloqueado }
  const [falloMapTiler, setFalloMapTiler] = React.useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="hud-titulo flex items-center gap-2 text-sm">
          <MapPinnedIcon className="size-4 text-primary" aria-hidden />
          Mapa de estaciones
        </CardTitle>
        <CardDescription>
          Las cinco ciudades de las que descargamos el tiempo. Pulsa una ciudad
          para añadirla o quitarla de la próxima descarga.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div>
          {CLAVE_MAPTILER && !falloMapTiler ? (
            <MapaMapTiler
              clave={CLAVE_MAPTILER}
              alFallar={setFalloMapTiler}
              {...props}
            />
          ) : (
            <>
              <MapaEsquema {...props} />
              {falloMapTiler ? (
                <p role="alert" className="mt-1 text-[0.7rem] text-amber-400">
                  MapTiler: {falloMapTiler}. Se muestra el mapa esquemático.
                  Revisa <code>NEXT_PUBLIC_MAPTILER_KEY</code> y los dominios
                  permitidos de la clave en MapTiler Cloud.
                </p>
              ) : (
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  Mapa esquemático (contorno: Natural Earth). Con una clave de
                  MapTiler en <code>NEXT_PUBLIC_MAPTILER_KEY</code> se muestra
                  el mapa interactivo.
                </p>
              )}
            </>
          )}
        </div>
        <ul
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1"
          aria-label="Resumen por ciudad"
        >
          {info.map((i) => {
            const [estado, texto] = TEXTO_ESTADO[i.estado]
            return (
              <li
                key={i.ciudad.id}
                className="neu-elevado rounded-md border bg-background/40 p-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ background: i.color }}
                    />
                    {i.ciudad.nombre}
                  </span>
                  <InsigniaEstado estado={estado} etiqueta={texto} />
                </div>
                {i.stats ? (
                  <dl className="mt-1.5 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <dt className="text-[0.65rem] text-muted-foreground">
                        Mín / máx
                      </dt>
                      <dd className="font-mono tabular-nums">
                        {formatoDecimal(i.stats.temperaturaMin, 0)}/
                        {formatoDecimal(i.stats.temperaturaMax, 0)} °C
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] text-muted-foreground">
                        Humedad
                      </dt>
                      <dd className="font-mono tabular-nums">
                        {formatoDecimal(i.stats.humedadMedia, 0)} %
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] text-muted-foreground">
                        Lluvia
                      </dt>
                      <dd className="font-mono tabular-nums">
                        {formatoDecimal(i.stats.lluviaTotal, 1)} mm
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {i.estado === "inactiva"
                      ? "No se descargará."
                      : "Sin datos todavía."}
                  </p>
                )}
                {i.stats && (
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    {formatoEntero(i.stats.registros)} horas válidas
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
