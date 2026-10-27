"use client"

import { CircleAlertIcon, DownloadCloudIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import {
  FECHA_MINIMA_ARCHIVO,
  MAX_DIAS_EXTRACCION,
  VARIABLES_HORARIAS,
  diasEntre,
} from "@/lib/etl/extraccion"
import { formatoEntero, hoyUtc } from "@/lib/formato"

export function Configuracion({ etl }: { etl: PipelineEtl }) {
  const { config, setConfig, erroresConfig, extraer } = etl
  const ocupado = !!etl.extraccion?.enCurso || !!etl.carga?.enCurso
  const dias = diasEntre(config.inicio, config.fin)
  const diasValidos = dias !== null && dias > 0
  const registrosPrevistos = diasValidos
    ? config.ciudades.length * dias * 24
    : 0
  const todas = config.ciudades.length === CIUDADES.length

  const alternarCiudad = (id: string, marcada: boolean) =>
    setConfig((c) => ({
      ...c,
      ciudades: marcada
        ? CIUDADES.map((x) => x.id).filter(
            (x) => x === id || c.ciudades.includes(x)
          )
        : c.ciudades.filter((x) => x !== id),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Configuración de extracción</CardTitle>
        <CardDescription>
          API histórica de Open-Meteo · datos horarios en UTC · °C, % y mm
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2" disabled={ocupado}>
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium">Ciudades</legend>
            <Button
              variant="link"
              size="xs"
              className="px-0"
              disabled={ocupado}
              onClick={() =>
                setConfig((c) => ({
                  ...c,
                  ciudades: todas ? [] : CIUDADES.map((x) => x.id),
                }))
              }
            >
              {todas ? "Ninguna" : "Todas"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {CIUDADES.map((c) => (
              <Label
                key={c.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-2 font-normal has-data-checked:border-primary/50 has-data-checked:bg-muted/50"
              >
                <Checkbox
                  checked={config.ciudades.includes(c.id)}
                  onCheckedChange={(v) => alternarCiudad(c.id, v)}
                  disabled={ocupado}
                />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="font-mono text-[0.7rem] whitespace-nowrap text-muted-foreground">
                    {c.latitud}, {c.longitud}
                  </span>
                </span>
              </Label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha-inicio">Fecha inicial (UTC)</Label>
            <Input
              id="fecha-inicio"
              type="date"
              min={FECHA_MINIMA_ARCHIVO}
              max={hoyUtc()}
              value={config.inicio}
              disabled={ocupado}
              onChange={(e) =>
                setConfig((c) => ({ ...c, inicio: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha-fin">Fecha final (UTC)</Label>
            <Input
              id="fecha-fin"
              type="date"
              min={FECHA_MINIMA_ARCHIVO}
              max={hoyUtc()}
              value={config.fin}
              disabled={ocupado}
              onChange={(e) =>
                setConfig((c) => ({ ...c, fin: e.target.value }))
              }
            />
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">Ciudades</dt>
            <dd className="font-mono text-lg tabular-nums">
              {config.ciudades.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Días</dt>
            <dd className="font-mono text-lg tabular-nums">
              {diasValidos ? dias : "—"}
              <span className="text-xs text-muted-foreground">
                {" "}
                / {MAX_DIAS_EXTRACCION}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Registros previstos
            </dt>
            <dd className="font-mono text-lg tabular-nums">
              {formatoEntero(registrosPrevistos)}
            </dd>
          </div>
          <p className="col-span-3 text-xs text-muted-foreground">
            {config.ciudades.length} petición(es) HTTP · ciudades × días × 24 h
            · variables: {VARIABLES_HORARIAS.join(", ")}
          </p>
        </dl>

        {erroresConfig.length > 0 && (
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon />
            <AlertTitle>Revisa la configuración</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {erroresConfig.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Button size="lg" onClick={() => void extraer()} disabled={ocupado}>
          <DownloadCloudIcon />
          {etl.extraccion?.enCurso ? "Extrayendo…" : "Extraer datos"}
        </Button>
        {etl.carga?.enCurso && (
          <p className="text-xs text-muted-foreground">
            No se puede extraer mientras hay una carga en curso.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
