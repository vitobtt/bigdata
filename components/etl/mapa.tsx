"use client"

import "@maptiler/sdk/dist/maptiler-sdk.css"

import * as React from "react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import {
  COLOR_CIUDAD,
  estadisticasPorCiudad,
  type EstadisticasCiudad,
} from "@/lib/etl/estadisticas"
import { formatoDecimal } from "@/lib/formato"
import { COMUNIDADES } from "@/lib/mapa/comunidades"
import { MAPA_ESQUEMA, TRAZADO_VECINOS, proyectar } from "@/lib/mapa/espana"
import { cn } from "@/lib/utils"
import type { Estado } from "./estado"
import { LenteAtmosferica } from "./lente"

/** Nombres con los que aparecen nuestras ciudades en OpenStreetMap. */
/** Comunidad autónoma de cada ciudad (id de lib/mapa/comunidades). */
const COMUNIDAD_DE_CIUDAD: Record<string, string> = {
  barcelona: "cataluna",
  madrid: "madrid",
  sevilla: "andalucia",
  bilbao: "pais-vasco",
  valencia: "valencia",
}

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

/** Desplazamiento de la etiqueta de cada ciudad: lado (1 = derecha) y vertical (1 = abajo). */
const COLOCACION: Record<string, { lado: 1 | -1; vert: 1 | -1 }> = {
  barcelona: { lado: -1, vert: 1 },
  madrid: { lado: -1, vert: -1 },
  sevilla: { lado: 1, vert: 1 },
  bilbao: { lado: 1, vert: -1 },
  valencia: { lado: 1, vert: 1 },
}

/** Centro de la lente en el escenario: esquina inferior derecha del mapa. */
const CENTRO_LENTE: [number, number] = [516, 386]
const RADIO_LENTE = 78

function coordenadaTecnica(c: Ciudad) {
  const ns = c.latitud >= 0 ? "N" : "S"
  const eo = c.longitud >= 0 ? "E" : "O"
  return `${Math.abs(c.latitud).toFixed(2)}°${ns} ${Math.abs(c.longitud).toFixed(2)}°${eo}`
}

/** Mapa esquemático en SVG: se usa cuando no hay clave de MapTiler. */
function MapaEsquema({
  info,
  marcadas,
  alternar,
  bloqueado,
  foco,
  alFocar,
}: {
  info: InfoCiudad[]
  marcadas: string[]
  alternar: (id: string) => void
  bloqueado: boolean
  foco: string
  alFocar: (id: string) => void
}) {
  const { ancho, alto } = MAPA_ESQUEMA
  // Retícula cada 2 grados, como en un visor de coordenadas.
  const meridianos = [-8, -6, -4, -2, 0, 2, 4]
  const paralelos = [36, 38, 40, 42, 44]
  const enfocada = info.find((i) => i.ciudad.id === foco)

  // Enlace vectorial entre el nodo enfocado y el borde de la lente.
  let enlace: { trazo: string; punta: [number, number] } | null = null
  if (enfocada) {
    const [x, y] = proyectar(enfocada.ciudad.longitud, enfocada.ciudad.latitud)
    const dx = CENTRO_LENTE[0] - x
    const dy = CENTRO_LENTE[1] - y
    const d = Math.hypot(dx, dy) || 1
    const ex = CENTRO_LENTE[0] - (dx / d) * RADIO_LENTE
    const ey = CENTRO_LENTE[1] - (dy / d) * RADIO_LENTE
    const sx = x + (dx / d) * 14
    const sy = y + (dy / d) * 14
    enlace = {
      trazo: `M${sx.toFixed(1)},${sy.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}`,
      punta: [ex, ey],
    }
  }

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="cursor-mira mapa-esquema h-auto w-full"
      role="group"
      aria-label="Mapa esquemático de España con las cinco ciudades"
    >
      <defs>
        <radialGradient id="halo-mapa" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgb(53 214 245 / 0.10)" />
          <stop offset="100%" stopColor="rgb(53 214 245 / 0)" />
        </radialGradient>
        {/* Las isóbatas solo se pintan sobre el mar: la tierra las tapa. */}
        <mask id="solo-mar">
          <rect width={ancho} height={alto} fill="white" />
          <path d={TRAZADO_VECINOS} fill="black" />
          {COMUNIDADES.map((c) => (
            <path key={c.id} d={c.trazado} fill="black" />
          ))}
        </mask>
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

      {/* Isóbatas: bandas de profundidad alrededor de la costa */}
      <g
        mask="url(#solo-mar)"
        fill="none"
        stroke="var(--primary)"
        strokeLinejoin="round"
        aria-hidden
      >
        {(
          [
            [26, 0.03],
            [16, 0.04],
            [8, 0.06],
          ] as const
        ).map(([grosor, op]) => (
          <g key={grosor} strokeWidth={grosor} strokeOpacity={op}>
            <path d={TRAZADO_VECINOS} />
            {COMUNIDADES.map((c) => (
              <path key={c.id} d={c.trazado} />
            ))}
          </g>
        ))}
      </g>

      <path
        d={TRAZADO_VECINOS}
        fill="rgb(139 166 182 / 0.05)"
        stroke="rgb(139 166 182 / 0.22)"
        strokeWidth={0.8}
      />
      {/* Comunidades autónomas: la de cada ciudad marcada se ilumina con su color. */}
      <g strokeLinejoin="round">
        {COMUNIDADES.map((c) => {
          const ciudad = info.find(
            (i) =>
              COMUNIDAD_DE_CIUDAD[i.ciudad.id] === c.id &&
              marcadas.includes(i.ciudad.id)
          )
          const enfocadaAqui = !!ciudad && ciudad.ciudad.id === foco
          return (
            <path
              key={c.id}
              d={c.trazado}
              fill={ciudad ? ciudad.color : "rgb(53 214 245)"}
              fillOpacity={enfocadaAqui ? 0.26 : ciudad ? 0.13 : 0.05}
              stroke="var(--primary)"
              strokeOpacity={enfocadaAqui ? 0.95 : ciudad ? 0.6 : 0.34}
              strokeWidth={enfocadaAqui ? 1.4 : ciudad ? 1 : 0.6}
              className="transition-[fill-opacity,stroke-opacity,stroke-width] duration-500"
            >
              <title>{c.nombre}</title>
            </path>
          )
        })}
      </g>

      {/* Enlace vectorial nodo → lente (solo en pantallas anchas, donde la lente se superpone al mapa) */}
      {enlace && (
        <g className="enlace-lente" aria-hidden>
          <path
            key={foco}
            className="enlace-lente-trazo"
            d={enlace.trazo}
            pathLength={1}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1}
          />
          <circle
            key={`punta-${foco}`}
            className="enlace-lente-punta"
            cx={enlace.punta[0]}
            cy={enlace.punta[1]}
            r={2.5}
            fill="var(--primary)"
          />
        </g>
      )}

      {/* Rotulación vertical del escenario */}
      <text
        transform={`translate(${ancho - 8} ${alto / 2}) rotate(90)`}
        textAnchor="middle"
        className="fill-muted-foreground font-mono text-[8px] tracking-[0.3em]"
      >
        PENÍNSULA IBÉRICA · 36–44°N
      </text>

      {info.map((i) => {
        const [x, y] = proyectar(i.ciudad.longitud, i.ciudad.latitud)
        const marcada = marcadas.includes(i.ciudad.id)
        const activa = i.estado !== "inactiva"
        const enfocadaNodo = i.ciudad.id === foco
        const { lado, vert } = COLOCACION[i.ciudad.id] ?? { lado: 1, vert: 1 }
        const codo: [number, number] = [x + lado * 16, y + vert * 16]
        const fin: [number, number] = [x + lado * 34, y + vert * 16]
        const xTexto = fin[0] + lado * 4
        const ancla = lado === 1 ? "start" : "end"
        return (
          <g
            key={i.ciudad.id}
            role="button"
            tabIndex={bloqueado ? -1 : 0}
            aria-pressed={marcada}
            aria-disabled={bloqueado}
            aria-label={etiquetaAccesible(i, marcada)}
            data-foco={enfocadaNodo ? "si" : "no"}
            data-marcada={marcada ? "si" : "no"}
            data-estado={i.estado}
            className={cn(
              "nodo outline-none",
              !bloqueado && "ciudad-objetivo"
            )}
            style={{ "--color-ciudad": i.color } as React.CSSProperties}
            onClick={() => {
              alFocar(i.ciudad.id)
              if (!bloqueado) alternar(i.ciudad.id)
            }}
            onPointerEnter={() => alFocar(i.ciudad.id)}
            onFocus={() => alFocar(i.ciudad.id)}
            onKeyDown={(e) => {
              if (!bloqueado && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault()
                alternar(i.ciudad.id)
              }
            }}
          >
            {/* Zona de clic mayor que el punto */}
            <circle cx={x} cy={y} r={24} fill="transparent" />
            {/* Barrido breve al enfocar: un anillo que se expande una sola vez */}
            {enfocadaNodo && (
              <circle
                key={`barrido-${i.ciudad.id}`}
                className="nodo-barrido"
                cx={x}
                cy={y}
                r={30}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={1}
              />
            )}
            {/* Recuadro de «objetivo fijado» (visible al apuntar o enfocar) */}
            <path
              className="mira-objetivo"
              d={`M${x - 19},${y - 10}V${y - 19}H${x - 10}M${x + 10},${y - 19}H${x + 19}V${y - 10}M${x + 19},${y + 10}V${y + 19}H${x + 10}M${x - 10},${y + 19}H${x - 19}V${y + 10}`}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={1.5}
            />
            {/* Anillo exterior: reacciona al hover y marca la selección */}
            <circle
              className="nodo-anillo"
              cx={x}
              cy={y}
              r={12}
              fill="none"
              stroke={
                i.estado === "error" ? "var(--destructive)" : "currentColor"
              }
              strokeDasharray={
                i.estado === "error" ? "3 3" : marcada ? undefined : "1 4"
              }
            />
            {/* Indicador de estado: cuatro marcas cardinales */}
            <path
              className="nodo-marcas"
              d={`M${x},${y - 17}V${y - 13}M${x + 17},${y}H${x + 13}M${x},${y + 17}V${y + 13}M${x - 17},${y}H${x - 13}`}
              stroke="currentColor"
              strokeWidth={1.4}
              fill="none"
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
            <circle
              className="nodo-nucleo"
              cx={x}
              cy={y}
              r={5.5}
              fill={activa ? i.color : "var(--background)"}
              stroke={activa ? "var(--background)" : i.color}
              strokeWidth={1.6}
            />
            {/* Etiqueta técnica con línea conectora */}
            <polyline
              className="nodo-guia"
              points={`${x + lado * 7},${y + vert * 7} ${codo[0]},${codo[1]} ${fin[0]},${fin[1]}`}
              fill="none"
              strokeWidth={0.9}
            />
            <text
              x={xTexto}
              y={fin[1] - 3}
              textAnchor={ancla}
              className="nodo-nombre"
            >
              {i.ciudad.nombre}
            </text>
            <text
              x={xTexto}
              y={fin[1] + 9}
              textAnchor={ancla}
              className="nodo-dato"
            >
              {coordenadaTecnica(i.ciudad)}
            </text>
            <text
              x={xTexto}
              y={fin[1] + 20}
              textAnchor={ancla}
              className="nodo-estado"
            >
              {i.stats
                ? `${formatoDecimal(i.stats.temperaturaMedia)} °C MEDIA`
                : TEXTO_ESTADO[i.estado][1].toUpperCase()}
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
  alFocar,
  foco,
}: {
  clave: string
  info: InfoCiudad[]
  marcadas: string[]
  alternar: (id: string) => void
  bloqueado: boolean
  /** Se llama si el mapa no llega a cargar (clave no válida, sin red…). */
  alFallar: (mensaje: string) => void
  /** Ciudad enfocada (la lente muestra su lectura). */
  foco?: string
  alFocar: (id: string) => void
}) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const marcadores = React.useRef(new Map<string, HTMLButtonElement>())
  // Los manejadores de los marcadores leen siempre la última versión.
  const alternarRef = React.useRef(alternar)
  const bloqueadoRef = React.useRef(bloqueado)
  const alFallarRef = React.useRef(alFallar)
  const alFocarRef = React.useRef(alFocar)
  React.useEffect(() => {
    alFocarRef.current = alFocar
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
            alFocarRef.current(c.id)
            if (!bloqueadoRef.current) alternarRef.current(c.id)
          })
          el.addEventListener("pointerenter", () => alFocarRef.current(c.id))
          el.addEventListener("focus", () => alFocarRef.current(c.id))
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
      el.dataset.foco = i.ciudad.id === foco ? "si" : "no"
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

export function Mapa({
  etl,
  foco,
  alFocar,
}: {
  etl: PipelineEtl
  foco: string
  alFocar: (id: string) => void
}) {
  const info = useInfoCiudades(etl)
  const bloqueado = !!etl.extraccion?.enCurso || !!etl.carga?.enCurso
  const marcadas = etl.config.ciudades
  const alternar = (id: string) =>
    etl.alternarCiudadExtraccion(id, !marcadas.includes(id))
  const props = { info, marcadas, alternar, bloqueado, foco, alFocar }
  const [falloMapTiler, setFalloMapTiler] = React.useState<string | null>(null)

  const enfocada = info.find((i) => i.ciudad.id === foco) ?? info[0]
  const lluviaMaxima = Math.max(0, ...info.map((i) => i.stats?.lluviaTotal ?? 0))
  const ultimoRegistro = React.useMemo(() => {
    let ultimo: string | undefined
    for (const f of etl.validos) {
      if (f.ciudad === enfocada.ciudad.nombre && (!ultimo || f.fecha_hora > ultimo))
        ultimo = f.fecha_hora
    }
    return ultimo
  }, [etl.validos, enfocada.ciudad.nombre])

  return (
    <section className="escena" aria-labelledby="titulo-mapa">
      <header className="escena-cabecera">
        <span className="rotulo-vertical" aria-hidden>
          Estaciones · 05
        </span>
        <div>
          <h2 id="titulo-mapa" className="hud-titulo text-base sm:text-lg">
            Mapa de estaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Pulsa un nodo para añadir o quitar la ciudad de la próxima descarga.
            La lente muestra la lectura de la ciudad enfocada.
          </p>
        </div>
      </header>

      <div className="escena-lienzo">
        {CLAVE_MAPTILER && !falloMapTiler ? (
          <MapaMapTiler
            clave={CLAVE_MAPTILER}
            alFallar={setFalloMapTiler}
            {...props}
          />
        ) : (
          <MapaEsquema {...props} />
        )}
        <LenteAtmosferica
          className="escena-lente"
          nombre={enfocada.ciudad.nombre}
          color={enfocada.color}
          estadoTexto={TEXTO_ESTADO[enfocada.estado][1]}
          stats={enfocada.stats}
          lluviaMaxima={lluviaMaxima}
          ultimoRegistro={ultimoRegistro}
        />
      </div>

      {falloMapTiler ? (
        <p role="alert" className="text-[0.7rem] text-amber-400">
          MapTiler: {falloMapTiler}. Se muestra el mapa esquemático. Revisa{" "}
          <code>NEXT_PUBLIC_MAPTILER_KEY</code> y los dominios permitidos de la
          clave en MapTiler Cloud.
        </p>
      ) : !CLAVE_MAPTILER ? (
        <p className="text-[0.7rem] text-muted-foreground">
          Mapa esquemático (comunidades: click_that_hood; vecinos: Natural
          Earth). Con una clave de MapTiler en{" "}
          <code>NEXT_PUBLIC_MAPTILER_KEY</code> se muestra el mapa interactivo.
        </p>
      ) : null}

      <aside className="escena-flotante">
      <ul className="escena-estaciones" aria-label="Resumen por ciudad">
        {info.map((i) => {
          const [, texto] = TEXTO_ESTADO[i.estado]
          return (
            <li key={i.ciudad.id}>
              <button
                type="button"
                className="estacion"
                aria-pressed={i.ciudad.id === foco}
                data-estado={i.estado}
                style={{ "--color-ciudad": i.color } as React.CSSProperties}
                onClick={() => alFocar(i.ciudad.id)}
              >
                <span className="estacion-barra" aria-hidden />
                <span className="estacion-nombre">{i.ciudad.nombre}</span>
                <span className="estacion-estado">{texto}</span>
                {i.stats && (
                  <span className="estacion-dato num-secundario">
                    {formatoDecimal(i.stats.temperaturaMin, 0)}/
                    {formatoDecimal(i.stats.temperaturaMax, 0)} °C ·{" "}
                    {formatoDecimal(i.stats.humedadMedia, 0)} % ·{" "}
                    {formatoDecimal(i.stats.lluviaTotal, 1)} mm
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      </aside>
    </section>
  )
}
