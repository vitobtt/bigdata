"use client"

import {
  ArrowDownIcon,
  ArrowRightIcon,
  RotateCwIcon,
  SearchIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { resumirCarga } from "@/lib/etl/carga"
import { diasEntre } from "@/lib/etl/extraccion"
import { formatoDuracion, formatoEntero } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { InsigniaEstado, type Estado } from "./estado"

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="hud-titulo text-sm">
          Pipeline ETL · las 5 fases
        </CardTitle>
        <CardDescription>
          Estados, contadores y duraciones reales de la última ejecución de cada
          fase.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(5,minmax(0,1fr))]">
          {fases.map((f, i) => (
            <li
              key={f.nombre}
              className="flex flex-col gap-2 md:flex-row md:items-stretch"
            >
              <article
                className={cn(
                  "neu-elevado flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-background/40 p-3 transition-shadow",
                  pestanaActiva === f.pestana && "ring-2 ring-ring/40",
                  f.estado === "en_curso" &&
                    "hud-escaneo border-primary/60 shadow-[0_0_18px_-4px_rgb(42_212_255/0.6)]",
                  f.estado === "completada" && "border-emerald-500/40",
                  f.estado === "error" && "border-destructive/50"
                )}
                aria-label={`Fase ${f.numero}: ${f.nombre}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-1">
                  <h3 className="text-sm font-semibold">
                    <span className="text-muted-foreground">{f.numero}.</span>{" "}
                    {f.nombre}
                  </h3>
                  <InsigniaEstado
                    estado={f.estado}
                    etiqueta={f.etiquetaEstado}
                  />
                </header>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">Entrada</dt>
                  <dd className="font-mono tabular-nums">{f.entrada}</dd>
                  <dt className="text-muted-foreground">Salida</dt>
                  <dd className="font-mono tabular-nums">{f.salida}</dd>
                  <dt className="text-muted-foreground">Duración</dt>
                  <dd className="font-mono tabular-nums">
                    {formatoDuracion(f.duracionMs)}
                  </dd>
                </dl>
                {f.extra && <p className="text-xs font-medium">{f.extra}</p>}
                <p className="text-xs">{f.explicacion}</p>
                <p className="font-mono text-[0.65rem] text-muted-foreground">
                  {f.tecnico}
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-auto self-start"
                  onClick={() => onInspeccionar(f.pestana)}
                >
                  <SearchIcon /> Inspeccionar
                </Button>
              </article>
              {i < fases.length - 1 && (
                <span
                  aria-hidden
                  className="flex items-center justify-center text-muted-foreground md:w-0"
                >
                  <ArrowDownIcon className="size-4 md:hidden" />
                  <ArrowRightIcon className="hidden size-4 md:-mx-2 md:block md:translate-x-[0.3rem]" />
                </span>
              )}
            </li>
          ))}
        </ol>

        {ext && (
          <section
            aria-labelledby="progreso-extraccion"
            className="flex flex-col gap-2"
          >
            <h3 id="progreso-extraccion" className="text-sm font-medium">
              Peticiones a Open-Meteo · {ext.inicio} → {ext.fin}
            </h3>
            <ul
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
              aria-live="polite"
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
                  <li
                    key={id}
                    className="neu-elevado flex flex-col gap-1 rounded-md border p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium">{d.nombre}</span>
                      <InsigniaEstado estado={estado} etiqueta={etiqueta} />
                    </div>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {horas !== null ? `${formatoEntero(horas)} h · ` : ""}
                      {formatoDuracion(d.duracionMs)}
                      {d.intentos > 1 ? ` · ${d.intentos} intentos` : ""}
                    </span>
                    {d.error && (
                      <>
                        <p className="break-words text-destructive">
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
          </section>
        )}
      </CardContent>
    </Card>
  )
}
