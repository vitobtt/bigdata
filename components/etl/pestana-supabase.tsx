"use client"

import * as React from "react"
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CircleAlertIcon,
  DatabaseIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { TAMANOS_PAGINA, type CampoOrdenDestino } from "@/lib/etl/peticiones"
import { formatoDecimal, formatoFechaUtc } from "@/lib/formato"
import { TablaPaginada, type Columna } from "./tabla-paginada"

type FilaDestino = {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

const ORDENES: { value: CampoOrdenDestino; label: string }[] = [
  { value: "fecha_hora", label: "Fecha y hora" },
  { value: "ciudad", label: "Ciudad" },
  { value: "temperatura_c", label: "Temperatura" },
  { value: "humedad_pct", label: "Humedad" },
  { value: "precipitacion_mm", label: "Precipitación" },
  { value: "importado_en", label: "Importado en" },
]

const COLUMNAS: Columna<FilaDestino>[] = [
  { id: "id", encabezado: "id", celda: (f) => f.id, numerica: true },
  { id: "ciudad", encabezado: "ciudad", celda: (f) => f.ciudad },
  {
    id: "fecha",
    encabezado: "fecha_hora (UTC)",
    celda: (f) => (
      <span className="font-mono">{formatoFechaUtc(f.fecha_hora)}</span>
    ),
  },
  {
    id: "t",
    encabezado: "temperatura_c (°C)",
    celda: (f) => formatoDecimal(f.temperatura_c),
    numerica: true,
  },
  {
    id: "h",
    encabezado: "humedad_pct (%)",
    celda: (f) => formatoDecimal(f.humedad_pct, 0),
    numerica: true,
  },
  {
    id: "p",
    encabezado: "precipitacion_mm (mm)",
    celda: (f) => formatoDecimal(f.precipitacion_mm, 2),
    numerica: true,
  },
  {
    id: "imp",
    encabezado: "importado_en (UTC)",
    celda: (f) => (
      <span className="font-mono text-xs">
        {f.importado_en.replace("T", " ").slice(0, 19)}
      </span>
    ),
  },
]

type Resultado =
  | { estado: "inactivo" }
  | { estado: "cargando" }
  | {
      estado: "ok"
      filas: FilaDestino[]
      total: number | null
      leidoEn: string
    }
  | { estado: "error"; mensaje: string }

export function PestanaSupabase({ etl }: { etl: PipelineEtl }) {
  const [ciudades, setCiudades] = React.useState<string[]>([])
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  const [orden, setOrden] = React.useState<CampoOrdenDestino>("fecha_hora")
  const [asc, setAsc] = React.useState(true)
  const [pagina, setPagina] = React.useState(0)
  const [tamano, setTamano] = React.useState<number>(25)
  const [resultado, setResultado] = React.useState<Resultado>({
    estado: "inactivo",
  })
  const [refresco, setRefresco] = React.useState(0)

  const disponible = !etl.supabase.cargando && etl.supabase.configurado

  const params = React.useMemo(() => {
    const p = new URLSearchParams()
    for (const c of ciudades) p.append("ciudad", c)
    if (desde) p.set("desde", `${desde}:00Z`)
    if (hasta) p.set("hasta", `${hasta}:00Z`)
    p.set("orden", orden)
    p.set("direccion", asc ? "asc" : "desc")
    p.set("pagina", String(pagina))
    p.set("tamano", String(tamano))
    return p.toString()
  }, [ciudades, desde, hasta, orden, asc, pagina, tamano])

  React.useEffect(() => {
    if (!disponible) return
    const control = new AbortController()
    // Lectura de un sistema externo (Supabase, vía nuestra API) cuando cambian los parámetros.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultado({ estado: "cargando" })
    fetch(`/api/supabase/mediciones?${params}`, {
      cache: "no-store",
      signal: control.signal,
    })
      .then(async (r) => {
        const cuerpo = await r.json()
        if (!r.ok) throw new Error(cuerpo?.error ?? `HTTP ${r.status}`)
        setResultado({
          estado: "ok",
          filas: cuerpo.filas,
          total: cuerpo.total,
          leidoEn: new Date().toISOString(),
        })
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError")
          setResultado({ estado: "error", mensaje: e.message })
      })
    return () => control.abort()
  }, [params, disponible, refresco, etl.versionDestino])

  const cambiarFiltro =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPagina(0)
    }

  if (!disponible) {
    return (
      <Alert>
        <DatabaseIcon />
        <AlertTitle>Sin conexión configurada</AlertTitle>
        <AlertDescription>
          {etl.supabase.cargando
            ? "Comprobando configuración…"
            : "Configura SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local para leer los datos persistidos."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="flex items-start gap-1.5">
          <DatabaseIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <b>Datos guardados en tu base de datos de Supabase (en la nube).</b>{" "}
            La aplicación se ejecuta en tu ordenador, pero esta tabla se pide en
            cada consulta a{" "}
            <code>
              {(!etl.supabase.cargando && etl.supabase.proyecto) ||
                "tu proyecto de Supabase"}
            </code>{" "}
            a través de tu servidor local. Aquí solo aparece lo que ya se ha
            subido; lo que tienes extraído en el navegador y aún no has subido
            no se muestra. El orden lo fija la consulta (
            <code>
              ORDER BY {orden} {asc ? "ASC" : "DESC"}, id
            </code>
            ).
          </span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRefresco((n) => n + 1)}
        >
          <RefreshCwIcon
            className={
              resultado.estado === "cargando" ? "animate-spin" : undefined
            }
          />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <legend className="mb-1 text-xs font-medium">
            Ciudades (ninguna = todas)
          </legend>
          {NOMBRES_CIUDADES.map((c) => (
            <Label key={c} className="flex items-center gap-1.5 font-normal">
              <Checkbox
                checked={ciudades.includes(c)}
                onCheckedChange={(v) =>
                  cambiarFiltro(setCiudades)(
                    v ? [...ciudades, c] : ciudades.filter((x) => x !== c)
                  )
                }
              />
              {c}
            </Label>
          ))}
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-xs font-medium">
            Fecha y hora (UTC)
          </legend>
          <Input
            aria-label="Desde (UTC)"
            type="datetime-local"
            step={3600}
            className="h-8"
            value={desde}
            onChange={(e) => cambiarFiltro(setDesde)(e.target.value)}
          />
          <Input
            aria-label="Hasta (UTC)"
            type="datetime-local"
            step={3600}
            className="h-8"
            value={hasta}
            onChange={(e) => cambiarFiltro(setHasta)(e.target.value)}
          />
        </fieldset>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 text-xs font-medium">Orden</legend>
          <Select
            items={ORDENES}
            value={orden}
            onValueChange={(v) =>
              v && cambiarFiltro(setOrden)(v as CampoOrdenDestino)
            }
          >
            <SelectTrigger size="sm" aria-label="Ordenar por" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDENES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Orden ${asc ? "ascendente" : "descendente"}; pulsa para invertir`}
            onClick={() => cambiarFiltro(setAsc)(!asc)}
          >
            {asc ? <ArrowUpNarrowWideIcon /> : <ArrowDownWideNarrowIcon />}
            {asc ? "Asc." : "Desc."}
          </Button>
        </fieldset>
      </div>

      {resultado.estado === "error" && (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertTitle>No se pudieron leer los datos</AlertTitle>
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <TablaPaginada
        etiqueta="Datos en Supabase"
        filas={resultado.estado === "ok" ? resultado.filas : []}
        columnas={COLUMNAS}
        claveFila={(f) => String(f.id)}
        vacio={
          resultado.estado === "cargando"
            ? "Consultando Supabase…"
            : "No hay registros en Supabase que cumplan estos filtros."
        }
        paginacionExterna={{
          total:
            resultado.estado === "ok"
              ? (resultado.total ?? resultado.filas.length)
              : 0,
          pagina,
          tamano,
          tamanos: TAMANOS_PAGINA,
          cambiarPagina: setPagina,
          cambiarTamano: (t) => {
            setTamano(t)
            setPagina(0)
          },
        }}
      />
      {resultado.estado === "ok" && (
        <p className="text-xs text-muted-foreground">
          Leído de Supabase el{" "}
          {resultado.leidoEn.replace("T", " ").slice(0, 19)} UTC.
        </p>
      )}
    </div>
  )
}
