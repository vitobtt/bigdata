"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { descargarJson } from "@/lib/formato"
import { cn } from "@/lib/utils"

/** Límite de caracteres que se pintan; el archivo descargado siempre es completo. */
const MAX_CARACTERES = 20_000

export function PestanaJson({ etl }: { etl: PipelineEtl }) {
  const ext = etl.extraccion
  const conJson = ext ? ext.ciudades.filter((id) => ext.descargas[id].json) : []
  const [elegida, setElegida] = React.useState<string | null>(null)
  const actual = elegida && conJson.includes(elegida) ? elegida : conJson[0]

  if (!ext || conJson.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aún no hay respuestas. Pulsa «Extraer datos».
      </p>
    )
  }
  const d = ext.descargas[actual]
  const texto = JSON.stringify(d.json, null, 2)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Ciudad"
          className="flex flex-wrap gap-1"
        >
          {conJson.map((id) => (
            <Button
              key={id}
              role="tab"
              aria-selected={id === actual}
              size="sm"
              variant={id === actual ? "default" : "outline"}
              onClick={() => setElegida(id)}
            >
              {ext.descargas[id].nombre}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              descargarJson(
                `open-meteo_${actual}_${ext.inicio}_${ext.fin}.json`,
                d.json
              )
            }
          >
            <DownloadIcon /> JSON de {d.nombre}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              descargarJson(
                `open-meteo_todas_${ext.inicio}_${ext.fin}.json`,
                Object.fromEntries(
                  conJson.map((id) => [id, ext.descargas[id].json])
                )
              )
            }
          >
            <DownloadIcon /> Todos ({conJson.length})
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Respuesta original recibida{" "}
        {d.recibidoEn && (
          <>el {d.recibidoEn.replace("T", " ").slice(0, 19)} UTC </>
        )}
        de <code className="break-all">{d.url}</code>. Observa que{" "}
        <code>hourly</code> contiene arrays paralelos: la posición <i>i</i> de
        cada array corresponde a la misma hora.
      </p>
      <pre
        className={cn(
          "neu-hundido max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs"
        )}
        tabIndex={0}
        aria-label={`JSON original de ${d.nombre}`}
      >
        {texto.length > MAX_CARACTERES
          ? `${texto.slice(0, MAX_CARACTERES)}\n\n… (${texto.length - MAX_CARACTERES} caracteres más; descarga el archivo para verlo completo)`
          : texto}
      </pre>
    </div>
  )
}
