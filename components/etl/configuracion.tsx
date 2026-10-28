"use client"

import * as React from "react"
import { CircleAlertIcon, DownloadCloudIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { COLOR_CIUDAD } from "@/lib/etl/estadisticas"
import {
  FECHA_MINIMA_ARCHIVO,
  MAX_DIAS_EXTRACCION,
  VARIABLES_HORARIAS,
  diasEntre,
} from "@/lib/etl/extraccion"
import { Cifra } from "@/components/hud/cifra"
import { hoyUtc } from "@/lib/formato"

export function Configuracion({
  etl,
  alFocar,
}: {
  etl: PipelineEtl
  alFocar?: (id: string) => void
}) {
  const { config, setConfig, erroresConfig, extraer } = etl
  const ocupado = !!etl.extraccion?.enCurso || !!etl.carga?.enCurso
  const dias = diasEntre(config.inicio, config.fin)
  const diasValidos = dias !== null && dias > 0
  const registrosPrevistos = diasValidos
    ? config.ciudades.length * dias * 24
    : 0
  const todas = config.ciudades.length === CIUDADES.length

  const alternarCiudad = etl.alternarCiudadExtraccion

  return (
    <section className="dock" aria-labelledby="titulo-dock">
      <header className="dock-cabecera">
        <span className="rotulo-vertical" aria-hidden>
          Control · 01
        </span>
        <div>
          <h2 id="titulo-dock" className="hud-titulo text-sm">
            Panel de descarga
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Elige ciudades y fechas, y pulsa «Extraer datos». Descargaremos el
            tiempo de cada hora (UTC) desde Open-Meteo: temperatura en °C,
            humedad en % y lluvia en mm.
          </p>
        </div>
      </header>

      <div className="dock-cuerpo">
        <fieldset className="flex flex-col gap-2" disabled={ocupado}>
          <div className="flex items-center justify-between">
            <legend className="etiqueta-tecnica">Estaciones</legend>
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
          <div className="flex flex-col gap-1">
            {CIUDADES.map((c) => {
              const activa = config.ciudades.includes(c.id)
              return (
                <Label
                  key={c.id}
                  className="cursor-mira ciudad-fila font-normal"
                  data-activa={activa ? "" : undefined}
                  style={
                    { "--color-ciudad": COLOR_CIUDAD[c.nombre] } as React.CSSProperties
                  }
                  onPointerEnter={() => alFocar?.(c.id)}
                  onFocus={() => alFocar?.(c.id)}
                >
                  <Checkbox
                    checked={activa}
                    onCheckedChange={(v) => alternarCiudad(c.id, v)}
                    disabled={ocupado}
                  />
                  <span className="ciudad-fila-nombre">{c.nombre}</span>
                  <span className="ciudad-fila-coord">
                    {c.latitud.toFixed(2)}, {c.longitud.toFixed(2)}
                  </span>
                </Label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span className="etiqueta-tecnica">Intervalo (UTC)</span>
          <div className="intervalo">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="fecha-inicio" className="intervalo-etiqueta">
                Fecha inicial
              </Label>
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
            <span className="intervalo-flecha" aria-hidden>
              →
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="fecha-fin" className="intervalo-etiqueta">
                Fecha final
              </Label>
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
        </div>

        <dl className="dock-telemetria">
          <div>
            <dt className="etiqueta-tecnica">Estaciones</dt>
            <dd className="num-principal">
              <Cifra valor={config.ciudades.length} />
            </dd>
          </div>
          <div>
            <dt className="etiqueta-tecnica">Días</dt>
            <dd className="num-principal">
              {diasValidos ? <Cifra valor={dias} /> : "—"}
              <span className="text-xs"> / {MAX_DIAS_EXTRACCION}</span>
            </dd>
          </div>
          <div>
            <dt className="etiqueta-tecnica">Registros previstos</dt>
            <dd className="num-principal">
              <Cifra valor={registrosPrevistos} fino />
            </dd>
          </div>
          <p className="col-span-3 text-[0.7rem] leading-relaxed text-muted-foreground">
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

        <Button
          size="lg"
          className="accion-principal"
          data-ejecutando={etl.extraccion?.enCurso ? "" : undefined}
          onClick={() => void extraer()}
          disabled={ocupado}
        >
          <DownloadCloudIcon />
          {etl.extraccion?.enCurso ? "Extrayendo…" : "Extraer datos"}
        </Button>
        {etl.carga?.enCurso && (
          <p className="text-xs text-muted-foreground">
            No se puede extraer mientras hay una carga en curso.
          </p>
        )}
      </div>
    </section>
  )
}
