"use client"

import * as React from "react"
import { CloudIcon, DatabaseIcon, RotateCwIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumirCarga } from "@/lib/etl/carga"
import { diasEntre } from "@/lib/etl/extraccion"
import { formatoDuracion, formatoEntero } from "@/lib/formato"
import { ESTADO_TEXTO, InsigniaEstado, type Estado } from "./estado"

export type Pestana =
  "json" | "transformados" | "validos" | "rechazados" | "carga" | "supabase"

type Fase = {
  numero: number
  nombre: string
  estado: Estado
  etiquetaEstado?: string
  entrada: string
  salida: string
  extra?: string
  /** Qué pasa, en lenguaje sencillo. */
  explicacion: string
  /** El mismo paso en términos técnicos. */
  tecnico: string
  duracionMs?: number
  pestana: Pestana
}

function calcularFases(etl: PipelineEtl): Fase[] {
  const { extraccion: ext, fases, carga } = etl
  const descargas = ext ? ext.ciudades.map((id) => ext.descargas[id]) : []
  const completadas = descargas.filter((d) => d.estado === "completada").length
  const fallidas = descargas.filter((d) => d.estado === "error").length
  const dias = ext ? (diasEntre(ext.inicio, ext.fin) ?? 0) : 0
  const t = fases?.transformacion
  const l = fases?.limpieza
  const informe = carga ? resumirCarga(carga.lotes) : null

  let estadoCarga: Estado = "pendiente"
  if (carga?.enCurso) estadoCarga = "en_curso"
  else if (carga) {
    const conProblemas = carga.lotes.some(
      (x) =>
        x.envio === "error" ||
        x.verificacion === "error" ||
        x.verificacion === "incompleto"
    )
    estadoCarga = conProblemas ? "error" : "completada"
  }

  return [
    {
      numero: 1,
      nombre: "Extracción",
      estado: !ext
        ? "pendiente"
        : ext.enCurso
          ? "en_curso"
          : fallidas
            ? "error"
            : "completada",
      etiquetaEstado: ext?.enCurso
        ? `En curso · ${completadas + fallidas}/${descargas.length}`
        : undefined,
      entrada: ext
        ? `${descargas.length} ciudad(es) · ${formatoEntero(descargas.length * dias * 24)} previstos`
        : "—",
      salida: t ? `${formatoEntero(t.posicionesEntrada)} horas recibidas` : "—",
      extra: fallidas ? `${fallidas} ciudad(es) con error` : undefined,
      explicacion:
        "Pedimos a Open-Meteo el tiempo de cada hora de cada ciudad y guardamos la respuesta tal cual llega.",
      tecnico:
        "Una petición HTTP por ciudad a la API histórica · JSON original intacto.",
      duracionMs: ext?.duracionMs,
      pestana: "json",
    },
    {
      numero: 2,
      nombre: "Transformación",
      estado:
        !t || t.respuestasEntrada === 0
          ? "pendiente"
          : ext?.enCurso
            ? "en_curso"
            : t.problemas.length
              ? "error"
              : "completada",
      etiquetaEstado:
        t?.problemas.length && !ext?.enCurso ? "Con avisos" : undefined,
      entrada: t
        ? `${t.respuestasEntrada} JSON · ${formatoEntero(t.posicionesEntrada)} posiciones`
        : "—",
      salida: t ? `${formatoEntero(t.filas.length)} filas` : "—",
      extra: t?.problemas.length
        ? `${t.problemas.length} problema(s) estructural(es)`
        : undefined,
      explicacion:
        "La respuesta trae listas separadas (horas, temperaturas…). Las juntamos en una fila por ciudad y hora.",
      tecnico: "Arrays paralelos → registros · fechas interpretadas como UTC.",
      duracionMs: t?.duracionMs,
      pestana: "transformados",
    },
    {
      numero: 3,
      nombre: "Limpieza",
      estado:
        !l || !t?.filas.length
          ? "pendiente"
          : ext?.enCurso
            ? "en_curso"
            : "completada",
      entrada: t ? `${formatoEntero(t.filas.length)} filas` : "—",
      salida: l ? `${formatoEntero(l.validos.length)} válidos` : "—",
      extra: l
        ? `${formatoEntero(l.rechazados.length)} rechazados por calidad`
        : undefined,
      explicacion:
        "Apartamos las filas con datos vacíos, imposibles (humedad > 100 %, lluvia negativa) o repetidos.",
      tecnico:
        "Números finitos (null ≠ 0) · humedad 0–100 · precipitación ≥ 0 · sin duplicados.",
      duracionMs: l?.duracionMs,
      pestana: "validos",
    },
    {
      numero: 4,
      nombre: "Filtrado y selección",
      estado: !etl.validos.length
        ? "pendiente"
        : etl.aCargar.length
          ? "completada"
          : "pendiente",
      etiquetaEstado:
        etl.validos.length && !etl.aCargar.length
          ? "Esperando selección"
          : undefined,
      entrada: l ? `${formatoEntero(etl.validos.length)} válidos` : "—",
      salida: l
        ? `${formatoEntero(etl.coinciden.length)} coinciden → ${formatoEntero(etl.aCargar.length)} seleccionados`
        : "—",
      extra: etl.contadoresSeleccion.seleccionadosFueraDeFiltros
        ? `${formatoEntero(etl.contadoresSeleccion.seleccionadosFueraDeFiltros)} seleccionados fuera de filtros (no se suben)`
        : undefined,
      explicacion:
        "Tú eliges qué filas subir: filtra (por ciudad, fecha, temperatura…), ordena y márcalas.",
      tecnico:
        "Filtros → orden → selección · lo excluido aquí no es un error de calidad.",
      duracionMs: l ? etl.duracionFiltradoMs : undefined,
      pestana: "validos",
    },
    {
      numero: 5,
      nombre: "Carga",
      estado: estadoCarga,
      etiquetaEstado: carga?.enCurso
        ? `En curso · lote ${Math.min(carga.lotes.filter((x) => x.envio === "completado" || x.envio === "error").length + 1, carga.lotes.length)}/${carga.lotes.length}`
        : undefined,
      entrada: carga
        ? `${formatoEntero(carga.congelado.length)} congelados`
        : "—",
      salida: informe
        ? `${formatoEntero(informe.registrosConfirmados)} confirmados en destino`
        : "—",
      extra: informe?.registrosFallidos
        ? `${formatoEntero(informe.registrosFallidos)} en lotes fallidos`
        : undefined,
      explicacion:
        "Enviamos las filas elegidas a la base de datos en la nube y comprobamos que han llegado.",
      tecnico:
        "Upsert por (ciudad, fecha_hora) en lotes de ≤ 500 · verificación en destino.",
      duracionMs: carga?.duracionMs,
      pestana: "carga",
    },
  ]
}

type NodoFlujo = {
  clave: string
  etiqueta: string
  estado: Estado
  etiquetaEstado?: string
  /** Lectura breve bajo el nodo. */
  resumen: string
  fase?: Fase
  explicacion: string
  tecnico: string
  entrada: string
  salida: string
  duracionMs?: number
  extra?: string
}

/** Marca del nodo: su estado se lee por forma (no solo por color). */
function MarcaNodo({ estado, contenido }: { estado: Estado; contenido: React.ReactNode }) {
  return (
    <span className="flujo-marca" data-estado={estado} aria-hidden>
      <svg viewBox="0 0 44 44">
        <circle className="flujo-marca-base" cx="22" cy="22" r="18" fill="none" />
        {estado === "en_curso" && (
          <circle
            className="flujo-marca-giro"
            cx="22"
            cy="22"
            r="18"
            fill="none"
            pathLength={100}
            strokeDasharray="22 78"
          />
        )}
        {estado === "completada" && (
          <circle
            className="flujo-marca-lleno"
            cx="22"
            cy="22"
            r="18"
            fill="none"
          />
        )}
        {estado === "error" && (
          <circle
            className="flujo-marca-error"
            cx="22"
            cy="22"
            r="18"
            fill="none"
            strokeDasharray="4 3"
          />
        )}
      </svg>
      <span className="flujo-marca-contenido">{contenido}</span>
    </span>
  )
}

/** Confirmación al terminar una carga verificada: el anillo y la marca se trazan una vez. */
function ConfirmacionDestino({ filas }: { filas: number }) {
  return (
    <div className="confirmacion" role="status">
      <svg viewBox="0 0 56 56" className="confirmacion-icono" aria-hidden>
        <circle
          className="confirmacion-anillo"
          cx="28"
          cy="28"
          r="24"
          fill="none"
          pathLength={1}
        />
        <path
          className="confirmacion-marca"
          d="M17 29l8 8 14-17"
          fill="none"
          pathLength={1}
        />
      </svg>
      <p className="confirmacion-texto">
        <span className="etiqueta-tecnica">Verificado en destino</span>
        <span className="num-principal confirmacion-cifra">
          {formatoEntero(filas)}
        </span>
        <span className="etiqueta-tecnica">registros confirmados</span>
      </p>
    </div>
  )
}

/** Posición de cada nodo en el escenario (centro, en % del ancho y del alto). */
const POSICION_NODO: [number, number][] = [
  [9, 50],
  [23, 25],
  [38, 76],
  [53, 25],
  [67, 76],
  [81, 25],
  [92, 58],
]
const ANCHO_VB = 1000
const ALTO_VB = 380
/** Separación vertical entre las hebras de cada cable. */
const HEBRAS = [-8, 0, 8] as const

function cable(
  desde: [number, number],
  hasta: [number, number],
  desplazamiento: number
) {
  const x0 = (desde[0] / 100) * ANCHO_VB
  const y0 = (desde[1] / 100) * ALTO_VB + desplazamiento
  const x1 = (hasta[0] / 100) * ANCHO_VB
  const y1 = (hasta[1] / 100) * ALTO_VB + desplazamiento
  const dx = (x1 - x0) * 0.5
  const r = (n: number) => Math.round(n * 10) / 10
  return `M${r(x0)},${r(y0)}C${r(x0 + dx)},${r(y0)} ${r(x1 - dx)},${r(y1)} ${r(x1)},${r(y1)}`
}

/** Cables entre nodos: su aspecto y movimiento dependen del estado real del nodo que alimentan. */
function Cables({ nodos }: { nodos: NodoFlujo[] }) {
  return (
    <svg
      className="cables"
      viewBox={`0 0 ${ANCHO_VB} ${ALTO_VB}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {nodos.slice(1).map((n, i) => {
        const desde = POSICION_NODO[i]
        const hasta = POSICION_NODO[i + 1]
        return (
          <g key={n.clave} className="cable" data-estado={n.estado}>
            {HEBRAS.map((h, k) => (
              <path
                key={h}
                id={`cable-${i}-${k}`}
                className={`cable-hebra cable-hebra-${k}`}
                d={cable(desde, hasta, h)}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {/* Paquetes de datos: solo mientras el nodo está realmente en curso */}
            {n.estado === "en_curso" &&
              HEBRAS.map((h, k) => (
                <circle key={h} r="3" className="cable-paquete">
                  <animateMotion
                    dur={`${1.6 + k * 0.35}s`}
                    begin={`${k * 0.4}s`}
                    repeatCount="indefinite"
                    path={cable(desde, hasta, h)}
                  />
                </circle>
              ))}
          </g>
        )
      })}
    </svg>
  )
}

/** Visualización real que acompaña a cada nodo (nada simulado). */
function MicroNodo({ clave, etl }: { clave: string; etl: PipelineEtl }) {
  const ext = etl.extraccion
  if (clave === "origen") {
    const ids = ext ? ext.ciudades : []
    return (
      <span className="micro micro-puntos" aria-hidden>
        {ids.length === 0
          ? [0, 1, 2, 3, 4].map((i) => <i key={i} data-estado="pendiente" />)
          : ids.map((id) => <i key={id} data-estado={ext!.descargas[id].estado} />)}
      </span>
    )
  }
  if (clave === "Extracción" && ext) {
    const horas = ext.ciudades.map((id) => {
      const t = ext.descargas[id].json?.hourly?.time
      return Array.isArray(t) ? t.length : 0
    })
    const maximo = Math.max(1, ...horas)
    return (
      <span className="micro micro-barras" aria-hidden>
        {horas.map((h, i) => (
          <i
            key={ext.ciudades[i]}
            data-estado={ext.descargas[ext.ciudades[i]].estado}
            style={{ height: `${Math.max(12, (h / maximo) * 100)}%` }}
          />
        ))}
      </span>
    )
  }
  if (clave === "Limpieza" && etl.fases) {
    const v = etl.validos.length
    const r = etl.fases.limpieza.rechazados.length
    if (v + r === 0) return null
    return (
      <span className="micro micro-apilada" aria-hidden>
        <i className="seg-val" style={{ flexGrow: v }} />
        <i className="seg-rng" style={{ flexGrow: r }} />
      </span>
    )
  }
  if (clave === "Filtrado y selección" && etl.validos.length > 0) {
    const sel = etl.aCargar.length
    const coinc = Math.max(0, etl.coinciden.length - sel)
    const resto = Math.max(0, etl.validos.length - etl.coinciden.length)
    return (
      <span className="micro micro-apilada" aria-hidden>
        <i className="seg-sel" style={{ flexGrow: sel }} />
        <i className="seg-val" style={{ flexGrow: coinc }} />
        <i className="seg-nada" style={{ flexGrow: resto }} />
      </span>
    )
  }
  if (clave === "Carga" && etl.carga) {
    return (
      <span className="micro micro-lotes" aria-hidden>
        {etl.carga.lotes.map((l) => {
          const estado =
            l.envio === "error" ||
            l.verificacion === "error" ||
            l.verificacion === "incompleto"
              ? "error"
              : l.verificacion === "confirmado"
                ? "completada"
                : l.envio === "pendiente"
                  ? "pendiente"
                  : "en_curso"
          return <i key={l.numero} data-estado={estado} />
        })}
      </span>
    )
  }
  return null
}

export function Pipeline({
  etl,
  onInspeccionar,
  pestanaActiva,
}: {
  etl: PipelineEtl
  onInspeccionar: (p: Pestana) => void
  pestanaActiva: Pestana
}) {
  const fases = calcularFases(etl)
  const ext = etl.extraccion
  const s = etl.supabase
  const informe = etl.carga ? resumirCarga(etl.carga.lotes) : null

  const nodos: NodoFlujo[] = [
    {
      clave: "origen",
      etiqueta: "Open-Meteo",
      estado: fases[0].estado,
      resumen: ext
        ? `${ext.ciudades.length} estación(es)`
        : "archivo histórico",
      explicacion:
        "Fuente de los datos: el archivo histórico horario de Open-Meteo. Cada ciudad se pide por separado.",
      tecnico: "API histórica · una petición HTTP por ciudad",
      entrada: "—",
      salida: ext ? `${ext.ciudades.length} ciudad(es) solicitadas` : "—",
    },
    ...fases.map(
      (f): NodoFlujo => ({
        clave: f.nombre,
        etiqueta: f.nombre,
        estado: f.estado,
        etiquetaEstado: f.etiquetaEstado,
        resumen: f.salida,
        fase: f,
        explicacion: f.explicacion,
        tecnico: f.tecnico,
        entrada: f.entrada,
        salida: f.salida,
        duracionMs: f.duracionMs,
        extra: f.extra,
      })
    ),
    {
      clave: "destino",
      etiqueta: "Supabase",
      estado: fases[4].estado,
      resumen: s.cargando
        ? "comprobando…"
        : !s.configurado
          ? "sin configurar"
          : s.conectado
            ? `${s.totalRegistros == null ? "?" : formatoEntero(s.totalRegistros)} filas guardadas`
            : "error de acceso",
      explicacion:
        "Destino final: la base de datos en la nube. Cada lote se envía y después se comprueba que las filas han llegado.",
      tecnico: s.cargando
        ? "Comprobando conexión…"
        : s.configurado && s.proyecto
          ? `Proyecto ${s.proyecto}`
          : "Upsert por (ciudad, fecha_hora)",
      entrada: informe
        ? `${formatoEntero(informe.registrosConfirmados)} confirmados`
        : "—",
      salida: s.cargando
        ? "—"
        : s.conectado
          ? `${s.totalRegistros == null ? "?" : formatoEntero(s.totalRegistros)} filas en total`
          : "sin conexión",
      extra: informe?.registrosFallidos
        ? `${formatoEntero(informe.registrosFallidos)} en lotes fallidos`
        : undefined,
    },
  ]

  // Nodo que se muestra por defecto: el que está en curso, el primero con error o el último completado.
  const porDefecto = (() => {
    const enCurso = nodos.findIndex((n) => n.estado === "en_curso")
    if (enCurso >= 0) return enCurso
    const error = nodos.findIndex((n) => n.estado === "error")
    if (error >= 0) return error
    const ultimo = nodos.map((n) => n.estado).lastIndexOf("completada")
    return ultimo >= 0 ? ultimo : 1
  })()
  const [elegido, setElegido] = React.useState<number | null>(null)
  const activo = nodos[elegido ?? porDefecto] ?? nodos[porDefecto]
  const esExtraccion = activo.clave === "Extracción"
  const esDestino = activo.clave === "destino"

  return (
    <section className="flujo-seccion plano-2" aria-labelledby="titulo-flujo">
      <header className="escena-cabecera">
        <span className="rotulo-vertical" aria-hidden>
          Flujo · 03
        </span>
        <div>
          <h2 id="titulo-flujo" className="hud-titulo text-base sm:text-lg">
            Flujo ETL
          </h2>
          <p className="text-sm text-muted-foreground">
            Open-Meteo → descarga → organización → revisión → selección →
            Supabase. Cada tramo refleja el estado real de la última
            ejecución; pulsa un nodo para ver su detalle.
          </p>
        </div>
      </header>

      <div className="constelacion">
        <Cables nodos={nodos} />
        <ol className="flujo">
          {nodos.map((n, i) => (
            <li
              key={n.clave}
              className="flujo-item"
              data-estado={n.estado}
              data-enlace={i > 0 ? n.estado : undefined}
              style={
                {
                  "--nx": `${POSICION_NODO[i][0]}%`,
                  "--ny": `${POSICION_NODO[i][1]}%`,
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="flujo-nodo"
                aria-pressed={n === activo}
                aria-label={`${n.etiqueta}: ${n.etiquetaEstado ?? ESTADO_TEXTO[n.estado]}. ${n.resumen}`}
                onClick={() => setElegido(i)}
              >
                <span className="flujo-cabecera">
                  <MarcaNodo
                    estado={n.estado}
                    contenido={
                      i === 0 ? (
                        <CloudIcon className="size-3.5" />
                      ) : i === nodos.length - 1 ? (
                        <DatabaseIcon className="size-3.5" />
                      ) : (
                        i
                      )
                    }
                  />
                  <span className="flujo-nombre">{n.etiqueta}</span>
                </span>
                <MicroNodo clave={n.clave} etl={etl} />
                <span className="flujo-resumen">{n.resumen}</span>
                <span className="flujo-estado">
                  {n.etiquetaEstado ?? ESTADO_TEXTO[n.estado]}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flujo-detalle" aria-live="polite">
        <div className="flujo-detalle-texto">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="hud-titulo text-xs">{activo.etiqueta}</span>
            <InsigniaEstado
              estado={activo.estado}
              etiqueta={activo.etiquetaEstado}
            />
          </h3>
          <p className="text-sm">{activo.explicacion}</p>
          <p className="font-mono text-[0.7rem] text-muted-foreground">
            {activo.tecnico}
          </p>
          {activo.extra && (
            <p className="text-xs font-medium text-amber-400">{activo.extra}</p>
          )}
          {activo.fase && (
            <Button
              variant="outline"
              size="xs"
              className="self-start"
              aria-pressed={pestanaActiva === activo.fase.pestana}
              onClick={() => onInspeccionar(activo.fase!.pestana)}
            >
              <SearchIcon /> Inspeccionar
            </Button>
          )}
        </div>
        <dl className="flujo-lecturas">
          <div>
            <dt className="etiqueta-tecnica">Entrada</dt>
            <dd className="num-secundario">{activo.entrada}</dd>
          </div>
          <div>
            <dt className="etiqueta-tecnica">Salida</dt>
            <dd className="num-secundario">{activo.salida}</dd>
          </div>
          <div>
            <dt className="etiqueta-tecnica">Duración</dt>
            <dd className="num-secundario">
              {formatoDuracion(activo.duracionMs)}
            </dd>
          </div>
        </dl>
        {esDestino &&
          activo.estado === "completada" &&
          informe &&
          informe.registrosConfirmados > 0 && (
            <ConfirmacionDestino filas={informe.registrosConfirmados} />
          )}
      </div>

      {esExtraccion && ext && (
        <div className="flujo-peticiones">
          <h3 id="progreso-extraccion" className="etiqueta-tecnica">
            Peticiones a Open-Meteo · {ext.inicio} → {ext.fin}
          </h3>
          <ul
            className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-5"
            aria-live="polite"
            aria-labelledby="progreso-extraccion"
          >
            {ext.ciudades.map((id) => {
              const d = ext.descargas[id]
              const estado: Estado =
                d.estado === "descargando"
                  ? "en_curso"
                  : d.estado === "completada"
                    ? "completada"
                    : d.estado === "error"
                      ? "error"
                      : "pendiente"
              const etiqueta = {
                pendiente: "Pendiente",
                descargando: "Descargando",
                completada: "Procesada",
                error: "Error",
              }[d.estado]
              const horas = Array.isArray(d.json?.hourly?.time)
                ? d.json.hourly.time.length
                : null
              return (
                <li key={id} className="peticion" data-estado={estado}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium">{d.nombre}</span>
                    <InsigniaEstado estado={estado} etiqueta={etiqueta} />
                  </div>
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    {horas !== null ? `${formatoEntero(horas)} h · ` : ""}
                    {formatoDuracion(d.duracionMs)}
                    {d.intentos > 1 ? ` · ${d.intentos} intentos` : ""}
                  </span>
                  {d.error && (
                    <>
                      <p className="break-words text-xs text-destructive">
                        {d.error}
                      </p>
                      <Button
                        variant="outline"
                        size="xs"
                        className="self-start"
                        disabled={ext.enCurso || !!etl.carga?.enCurso}
                        onClick={() => void etl.reintentarCiudad(id)}
                      >
                        <RotateCwIcon /> Reintentar {d.nombre}
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
