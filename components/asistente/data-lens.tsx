"use client"

import * as React from "react"
import { CheckCheckIcon, TriangleAlertIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { FILTROS_VACIOS } from "@/lib/etl/filtrado"
import { formatoDecimal, formatoEntero, formatoFechaUtc } from "@/lib/formato"

export type VistaLente = {
  estado: "validos" | "incidencias"
  seleccion: "todos" | "seleccionados" | "sin"
}

export const VISTA_LENTE_INICIAL: VistaLente = {
  estado: "validos",
  seleccion: "todos",
}

const FILAS_MUESTRA = 8

/** Cuenta los filtros avanzados (los de la inspección completa) que están activos. */
function filtrosAvanzados(f: PipelineEtl["filtros"]): number {
  let n = 0
  if (f.desde !== FILTROS_VACIOS.desde) n++
  if (f.hasta !== FILTROS_VACIOS.hasta) n++
  if (f.temperaturaMin !== null || f.temperaturaMax !== null) n++
  if (f.humedadMin !== null || f.humedadMax !== null) n++
  if (f.precipitacionMin !== null || f.precipitacionMax !== null) n++
  if (f.soloLluvia) n++
  return n
}

function Segmentos<T extends string>({
  etiqueta,
  valor,
  opciones,
  onCambio,
  deshabilitado,
}: {
  etiqueta: string
  valor: T
  opciones: { id: T; texto: string; n?: number }[]
  onCambio: (v: T) => void
  deshabilitado?: boolean
}) {
  return (
    <div className="lente-grupo">
      <span className="etiqueta-tecnica" id={`seg-${etiqueta}`}>
        {etiqueta}
      </span>
      <div
        className="lente-segmentos"
        role="radiogroup"
        aria-labelledby={`seg-${etiqueta}`}
      >
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={valor === o.id}
            disabled={deshabilitado}
            data-activo={valor === o.id ? "" : undefined}
            onClick={() => onCambio(o.id)}
          >
            {o.texto}
            {o.n !== undefined && (
              <span className="lente-segmento-n">{formatoEntero(o.n)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Data Lens: vista previa funcional para revisar y filtrar sin bajar hasta la
 * inspección. No tiene lógica de filtrado propia: lee `etl.coinciden`,
 * `etl.filtros` y `etl.seleccion`, los mismos que usa la tabla completa.
 */
export function DataLens({
  etl,
  vista,
  onVista,
  onCerrar,
  onInspeccionCompleta,
  onGuardar,
}: {
  etl: PipelineEtl
  vista: VistaLente
  onVista: (v: VistaLente) => void
  onCerrar: () => void
  onInspeccionCompleta: () => void
  onGuardar: () => void
}) {
  const titulo = React.useRef<HTMLHeadingElement>(null)
  // Al abrirse, el foco pasa al título: quien usa teclado o lector de pantalla
  // empieza por el principio de la lente.
  React.useEffect(() => {
    titulo.current?.focus()
  }, [])

  const rechazados = etl.fases?.limpieza.rechazados ?? []
  const nValidos = etl.validos.length
  const nIncidencias = rechazados.length
  const nSeleccionados = etl.aCargar.length
  const nDescargados = nValidos + nIncidencias
  const ciudadesDescargadas = etl.extraccion
    ? Object.values(etl.extraccion.descargas).filter(
        (d) => d.estado === "completada"
      )
    : []
  const avanzados = filtrosAvanzados(etl.filtros)

  const alternarCiudad = (nombre: string) =>
    etl.setFiltros((f) => ({
      ...f,
      ciudades: f.ciudades.includes(nombre)
        ? f.ciudades.filter((c) => c !== nombre)
        : [...f.ciudades, nombre],
    }))

  // Misma lista que la tabla completa (ya filtrada y ordenada); la selección
  // rápida solo recorta esa lista, no recalcula nada.
  const filasValidas = React.useMemo(() => {
    if (vista.seleccion === "seleccionados") return etl.aCargar
    if (vista.seleccion === "sin")
      return etl.coinciden.filter((f) => !etl.seleccion.has(f.clave))
    return etl.coinciden
  }, [vista.seleccion, etl.aCargar, etl.coinciden, etl.seleccion])

  const incidenciasVisibles = React.useMemo(
    () =>
      etl.filtros.ciudades.length === 0
        ? rechazados
        : rechazados.filter((r) => etl.filtros.ciudades.includes(r.fila.ciudad)),
    // `rechazados` es estable mientras no cambie `etl.fases`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [etl.fases, etl.filtros.ciudades]
  )

  const total =
    vista.estado === "validos" ? filasValidas.length : incidenciasVisibles.length
  const pendientes = etl.coinciden.length - nSeleccionados

  return (
    <section
      className="lente-datos"
      aria-labelledby="titulo-lente"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onCerrar()
        }
      }}
    >
      <header className="lente-cabecera">
        <div>
          <p className="etiqueta-tecnica">Paso 03 · Revisar datos</p>
          <h2
            id="titulo-lente"
            ref={titulo}
            tabIndex={-1}
            className="hud-titulo text-sm"
          >
            Data Lens
          </h2>
        </div>
        <button
          type="button"
          className="lente-cerrar"
          onClick={onCerrar}
          aria-label="Cerrar Data Lens"
        >
          <XIcon aria-hidden />
        </button>
      </header>

      <div className="lente-cuerpo">
        <dl className="lente-cifras">
          <div>
            <dt>Descargados</dt>
            <dd>{formatoEntero(nDescargados)}</dd>
          </div>
          <div>
            <dt>Válidos</dt>
            <dd>{formatoEntero(nValidos)}</dd>
          </div>
          <div data-alerta={nIncidencias > 0 ? "" : undefined}>
            <dt>Con incidencias</dt>
            <dd>{formatoEntero(nIncidencias)}</dd>
          </div>
          <div data-destacada="">
            <dt>Seleccionados</dt>
            <dd>{formatoEntero(nSeleccionados)}</dd>
          </div>
        </dl>
        <p className="lente-ciudades">
          Ciudades incluidas:{" "}
          <b>
            {ciudadesDescargadas.length > 0
              ? ciudadesDescargadas.map((d) => d.nombre).join(", ")
              : "ninguna"}
          </b>
        </p>

        {nIncidencias > 0 && (
          <div className="lente-aviso" role="status">
            <TriangleAlertIcon aria-hidden />
            <p>
              {formatoEntero(nIncidencias)}{" "}
              {nIncidencias === 1 ? "registro tiene" : "registros tienen"}{" "}
              incidencias (duplicados, valores fuera de rango o incompletos) y
              no se pueden subir.
            </p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => onVista({ ...vista, estado: "incidencias" })}
            >
              Ver detalles
            </Button>
          </div>
        )}

        <div className="lente-filtros">
          <div className="lente-grupo">
            <span className="etiqueta-tecnica" id="lente-ciudad">
              Ciudad (ninguna = todas)
            </span>
            <div
              className="lente-fichas"
              role="group"
              aria-labelledby="lente-ciudad"
            >
              {ciudadesDescargadas.map((d) => {
                const activa = etl.filtros.ciudades.includes(d.nombre)
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={activa}
                    data-activo={activa ? "" : undefined}
                    onClick={() => alternarCiudad(d.nombre)}
                  >
                    {d.nombre}
                  </button>
                )
              })}
            </div>
          </div>
          <Segmentos
            etiqueta="Validación"
            valor={vista.estado}
            opciones={[
              { id: "validos", texto: "Válidos", n: etl.coinciden.length },
              {
                id: "incidencias",
                texto: "Con incidencias",
                n: incidenciasVisibles.length,
              },
            ]}
            onCambio={(estado) => onVista({ ...vista, estado })}
          />
          <Segmentos
            etiqueta="Selección"
            valor={vista.seleccion}
            deshabilitado={vista.estado === "incidencias"}
            opciones={[
              { id: "todos", texto: "Todos" },
              { id: "seleccionados", texto: "Seleccionados", n: nSeleccionados },
              { id: "sin", texto: "Sin seleccionar", n: pendientes },
            ]}
            onCambio={(seleccion) => onVista({ ...vista, seleccion })}
          />
        </div>

        {avanzados > 0 && (
          <p className="lente-nota">
            Hay {avanzados} filtro{avanzados === 1 ? "" : "s"} avanzado
            {avanzados === 1 ? "" : "s"} activo{avanzados === 1 ? "" : "s"} en
            la inspección completa; esta muestra también los aplica.
          </p>
        )}

        <div className="lente-tabla">
          <Table
            aria-label={
              vista.estado === "validos"
                ? "Muestra de registros válidos"
                : "Muestra de registros con incidencias"
            }
          >
            <TableHeader>
              {vista.estado === "validos" ? (
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">Seleccionar</span>
                  </TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Fecha (UTC)</TableHead>
                  <TableHead className="text-right">°C</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">mm</TableHead>
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Incidencia</TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {total === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-5 text-center whitespace-normal text-muted-foreground"
                  >
                    {vista.estado === "validos"
                      ? "Ningún registro válido cumple estos filtros."
                      : "No hay registros con incidencias."}
                  </TableCell>
                </TableRow>
              ) : vista.estado === "validos" ? (
                filasValidas.slice(0, FILAS_MUESTRA).map((f) => {
                  const marcada = etl.seleccion.has(f.clave)
                  return (
                    <TableRow
                      key={f.clave}
                      data-state={marcada ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`Seleccionar ${f.clave}`}
                          checked={marcada}
                          onCheckedChange={(v) =>
                            etl.alternarSeleccion([f.clave], v)
                          }
                        />
                      </TableCell>
                      <TableCell>{f.ciudad}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatoFechaUtc(f.fecha_hora)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatoDecimal(f.temperatura_c)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatoDecimal(f.humedad_pct, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatoDecimal(f.precipitacion_mm, 2)}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                incidenciasVisibles.slice(0, FILAS_MUESTRA).map((r) => (
                  <TableRow key={r.fila.uid}>
                    <TableCell>{r.fila.ciudad}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.fila.fecha_hora
                        ? formatoFechaUtc(r.fila.fecha_hora)
                        : String(r.fila.fecha_bruta ?? "—")}
                    </TableCell>
                    <TableCell className="max-w-48 text-xs whitespace-normal text-destructive">
                      {r.motivos.join(" · ")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="lente-nota" aria-live="polite">
          {total === 0
            ? "Sin filas que mostrar."
            : `Mostrando ${Math.min(FILAS_MUESTRA, total)} de ${formatoEntero(total)}.`}
        </p>
      </div>

      <footer className="lente-pie">
        <Button
          size="sm"
          variant="outline"
          onClick={etl.seleccionarCoincidentes}
          disabled={pendientes === 0}
        >
          <CheckCheckIcon /> Seleccionar las {formatoEntero(etl.coinciden.length)}{" "}
          que cumplen
        </Button>
        <Button size="sm" variant="outline" onClick={onInspeccionCompleta}>
          Abrir inspección completa
        </Button>
        {nSeleccionados > 0 && (
          <Button size="sm" onClick={onGuardar}>
            Revisar y guardar
          </Button>
        )}
      </footer>
    </section>
  )
}
