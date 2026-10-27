"use client"

import * as React from "react"
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  EraserIcon,
  FilterXIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { CampoOrden, Filtros } from "@/lib/etl/filtrado"
import type { Medicion } from "@/lib/etl/tipos"
import { formatoDecimal, formatoEntero, formatoFechaUtc } from "@/lib/formato"
import { TablaPaginada, type Columna } from "./tabla-paginada"

export const COLUMNAS_MEDICION: Columna<Medicion>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (f) => f.ciudad },
  {
    id: "fecha_hora",
    encabezado: "Fecha y hora (UTC)",
    celda: (f) => (
      <span className="font-mono">{formatoFechaUtc(f.fecha_hora)}</span>
    ),
  },
  {
    id: "t",
    encabezado: "Temperatura (°C)",
    celda: (f) => formatoDecimal(f.temperatura_c),
    numerica: true,
  },
  {
    id: "h",
    encabezado: "Humedad (%)",
    celda: (f) => formatoDecimal(f.humedad_pct, 0),
    numerica: true,
  },
  {
    id: "p",
    encabezado: "Precipitación (mm)",
    celda: (f) => formatoDecimal(f.precipitacion_mm, 2),
    numerica: true,
  },
]

export const CAMPOS_ORDEN: { value: CampoOrden; label: string }[] = [
  { value: "ciudad", label: "Ciudad" },
  { value: "fecha_hora", label: "Fecha y hora" },
  { value: "temperatura_c", label: "Temperatura" },
  { value: "humedad_pct", label: "Humedad" },
  { value: "precipitacion_mm", label: "Precipitación" },
]

type Formulario = {
  desde: string
  hasta: string
  temperaturaMin: string
  temperaturaMax: string
  humedadMin: string
  humedadMax: string
  precipitacionMin: string
  precipitacionMax: string
}

const FORMULARIO_VACIO: Formulario = {
  desde: "",
  hasta: "",
  temperaturaMin: "",
  temperaturaMax: "",
  humedadMin: "",
  humedadMax: "",
  precipitacionMin: "",
  precipitacionMax: "",
}

function numeroONulo(s: string): number | null | "invalido" {
  if (s.trim() === "") return null
  const n = Number(s.replace(",", "."))
  return Number.isFinite(n) ? n : "invalido"
}

/** "2026-09-01T05:00" (input datetime-local, leído como UTC) → ISO UTC. */
function fechaONula(s: string): string | null | "invalido" {
  if (!s) return null
  const ms = Date.parse(`${s.length === 16 ? `${s}:00` : s}Z`)
  return Number.isNaN(ms) ? "invalido" : new Date(ms).toISOString()
}

/** Convierte el formulario en filtros y devuelve los errores que encuentre. */
function interpretar(form: Formulario) {
  const errores: string[] = []
  const valores: Partial<Filtros> = {}
  const rangos = [
    ["temperaturaMin", "temperaturaMax", "Temperatura"],
    ["humedadMin", "humedadMax", "Humedad"],
    ["precipitacionMin", "precipitacionMax", "Precipitación"],
  ] as const
  for (const [min, max, nombre] of rangos) {
    const a = numeroONulo(form[min])
    const b = numeroONulo(form[max])
    if (a === "invalido" || b === "invalido")
      errores.push(`${nombre}: valor no numérico.`)
    valores[min] = a === "invalido" ? null : a
    valores[max] = b === "invalido" ? null : b
    if (typeof a === "number" && typeof b === "number" && a > b) {
      errores.push(
        `${nombre}: el mínimo es mayor que el máximo; ningún registro coincidirá.`
      )
    }
  }
  const desde = fechaONula(form.desde)
  const hasta = fechaONula(form.hasta)
  if (desde === "invalido" || hasta === "invalido")
    errores.push("Fecha y hora no válidas.")
  valores.desde = desde === "invalido" ? null : desde
  valores.hasta = hasta === "invalido" ? null : hasta
  if (valores.desde && valores.hasta && valores.desde > valores.hasta) {
    errores.push("Intervalo de fechas: «desde» es posterior a «hasta».")
  }
  return { valores, errores }
}

function CampoNumero({
  id,
  etiqueta,
  valor,
  onChange,
  min,
  max,
}: {
  id: string
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {etiqueta}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
    </div>
  )
}

export function PestanaValidos({ etl }: { etl: PipelineEtl }) {
  const [form, setForm] = React.useState<Formulario>(FORMULARIO_VACIO)
  const { errores } = interpretar(form)

  const ciudadesDisponibles = React.useMemo(
    () => [...new Set(etl.validos.map((v) => v.ciudad))],
    [etl.validos]
  )

  const actualizar = (campo: keyof Formulario, valor: string) => {
    const siguiente = { ...form, [campo]: valor }
    setForm(siguiente)
    etl.setFiltros((f) => ({ ...f, ...interpretar(siguiente).valores }))
  }

  const restablecer = () => {
    setForm(FORMULARIO_VACIO)
    etl.restablecerFiltros()
  }

  const { seleccionadosFueraDeFiltros } = etl.contadoresSeleccion
  const seleccionTotal = etl.seleccion.size
  const pendientesDeSeleccionar = etl.coinciden.length - etl.aCargar.length

  if (etl.validos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay registros válidos todavía. Extrae datos para poder filtrarlos y
        seleccionarlos.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="titulo-filtros"
        className="flex flex-col gap-3 rounded-lg border p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="titulo-filtros" className="text-sm font-semibold">
            Filtros y orden
            <span className="ml-2 font-normal text-muted-foreground">
              válidos → filtros → ordenación → selección → carga
            </span>
          </h3>
          <Button variant="ghost" size="sm" onClick={restablecer}>
            <FilterXIcon /> Restablecer filtros
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium">
              Ciudades (ninguna marcada = todas)
            </legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {ciudadesDisponibles.map((c) => (
                <Label
                  key={c}
                  className="flex items-center gap-1.5 font-normal"
                >
                  <Checkbox
                    checked={etl.filtros.ciudades.includes(c)}
                    onCheckedChange={(v) =>
                      etl.setFiltros((f) => ({
                        ...f,
                        ciudades: v
                          ? [...f.ciudades, c]
                          : f.ciudades.filter((x) => x !== c),
                      }))
                    }
                  />
                  {c}
                </Label>
              ))}
            </div>
            <Label className="mt-2 flex items-center gap-1.5 font-normal">
              <Checkbox
                checked={etl.filtros.soloLluvia}
                onCheckedChange={(v) =>
                  etl.setFiltros((f) => ({ ...f, soloLluvia: v }))
                }
              />
              Solo registros con lluvia (precipitación &gt; 0 mm)
            </Label>
          </fieldset>

          <fieldset className="grid grid-cols-2 content-start gap-2 xl:grid-cols-1">
            <legend className="mb-1 text-xs font-medium">
              Intervalo de fecha y hora (UTC, inclusivo)
            </legend>
            <div className="flex min-w-0 flex-col gap-1">
              <Label
                htmlFor="f-desde"
                className="text-xs font-normal text-muted-foreground"
              >
                Desde
              </Label>
              <Input
                id="f-desde"
                type="datetime-local"
                step={3600}
                value={form.desde}
                min={
                  etl.extraccion ? `${etl.extraccion.inicio}T00:00` : undefined
                }
                max={etl.extraccion ? `${etl.extraccion.fin}T23:00` : undefined}
                onChange={(e) => actualizar("desde", e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label
                htmlFor="f-hasta"
                className="text-xs font-normal text-muted-foreground"
              >
                Hasta
              </Label>
              <Input
                id="f-hasta"
                type="datetime-local"
                step={3600}
                value={form.hasta}
                min={
                  etl.extraccion ? `${etl.extraccion.inicio}T00:00` : undefined
                }
                max={etl.extraccion ? `${etl.extraccion.fin}T23:00` : undefined}
                onChange={(e) => actualizar("hasta", e.target.value)}
                className="h-8"
              />
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1 text-xs font-medium">
              Temperatura y humedad
            </legend>
            <CampoNumero
              id="f-tmin"
              etiqueta="Temp. mín. (°C)"
              valor={form.temperaturaMin}
              onChange={(v) => actualizar("temperaturaMin", v)}
            />
            <CampoNumero
              id="f-tmax"
              etiqueta="Temp. máx. (°C)"
              valor={form.temperaturaMax}
              onChange={(v) => actualizar("temperaturaMax", v)}
            />
            <CampoNumero
              id="f-hmin"
              etiqueta="Hum. mín. (%)"
              min={0}
              max={100}
              valor={form.humedadMin}
              onChange={(v) => actualizar("humedadMin", v)}
            />
            <CampoNumero
              id="f-hmax"
              etiqueta="Hum. máx. (%)"
              min={0}
              max={100}
              valor={form.humedadMax}
              onChange={(v) => actualizar("humedadMax", v)}
            />
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1 text-xs font-medium">
              Precipitación y orden
            </legend>
            <CampoNumero
              id="f-pmin"
              etiqueta="Precip. mín. (mm)"
              min={0}
              valor={form.precipitacionMin}
              onChange={(v) => actualizar("precipitacionMin", v)}
            />
            <CampoNumero
              id="f-pmax"
              etiqueta="Precip. máx. (mm)"
              min={0}
              valor={form.precipitacionMax}
              onChange={(v) => actualizar("precipitacionMax", v)}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span
                id="orden-etiqueta"
                className="text-xs text-muted-foreground"
              >
                Ordenar por
              </span>
              <Select
                items={CAMPOS_ORDEN}
                value={etl.orden.campo}
                onValueChange={(v) =>
                  v && etl.setOrden((o) => ({ ...o, campo: v as CampoOrden }))
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-labelledby="orden-etiqueta"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPOS_ORDEN.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted-foreground">Dirección</span>
              <Button
                variant="outline"
                className="h-8"
                aria-label={`Orden ${etl.orden.direccion === "asc" ? "ascendente" : "descendente"}; pulsa para invertir`}
                onClick={() =>
                  etl.setOrden((o) => ({
                    ...o,
                    direccion: o.direccion === "asc" ? "desc" : "asc",
                  }))
                }
              >
                {etl.orden.direccion === "asc" ? (
                  <ArrowUpNarrowWideIcon />
                ) : (
                  <ArrowDownWideNarrowIcon />
                )}
                {etl.orden.direccion === "asc" ? "Ascendente" : "Descendente"}
              </Button>
            </div>
          </fieldset>
        </div>

        {errores.length > 0 && (
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon />
            <AlertDescription>
              <ul className="list-disc pl-4">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section aria-label="Selección" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={etl.seleccionarCoincidentes}
            disabled={pendientesDeSeleccionar === 0}
          >
            <CheckCheckIcon />
            Seleccionar las {formatoEntero(etl.coinciden.length)} que cumplen
            los filtros
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={etl.vaciarSeleccion}
            disabled={seleccionTotal === 0}
          >
            <EraserIcon /> Vaciar selección
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            <b className="text-foreground tabular-nums">
              {formatoEntero(etl.aCargar.length)}
            </b>{" "}
            seleccionados dentro de los filtros
            {seleccionadosFueraDeFiltros > 0 && (
              <>
                {" · "}
                <b className="text-amber-700 tabular-nums dark:text-amber-400">
                  {formatoEntero(seleccionadosFueraDeFiltros)} seleccionados
                  fuera de los filtros (no se subirán)
                </b>
              </>
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          La casilla de la cabecera marca solo la página visible. Cambiar los
          filtros nunca selecciona registros nuevos automáticamente. La
          paginación solo afecta a la visualización.
        </p>
        <TablaPaginada
          etiqueta="Registros válidos que cumplen los filtros"
          filas={etl.coinciden}
          columnas={COLUMNAS_MEDICION}
          claveFila={(f) => f.clave}
          vacio="Ningún registro válido cumple los filtros actuales."
          seleccion={{
            seleccionada: (f) => etl.seleccion.has(f.clave),
            alternar: (f, v) => etl.alternarSeleccion([f.clave], v),
            alternarPagina: (filas, v) =>
              etl.alternarSeleccion(
                filas.map((f) => f.clave),
                v
              ),
          }}
        />
      </section>
    </div>
  )
}
