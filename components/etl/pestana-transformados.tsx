"use client"

import { CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { FilaTransformada } from "@/lib/etl/tipos"
import { formatoBruto, formatoFechaUtc } from "@/lib/formato"
import { TablaPaginada, type Columna } from "./tabla-paginada"

function Bruto({ valor }: { valor: unknown }) {
  const malo = typeof valor !== "number" || !Number.isFinite(valor)
  return (
    <span className={malo ? "font-semibold text-destructive" : undefined}>
      {formatoBruto(valor)}
    </span>
  )
}

const COLUMNAS: Columna<FilaTransformada>[] = [
  { id: "ciudad", encabezado: "Ciudad", celda: (f) => f.ciudad },
  {
    id: "indice",
    encabezado: "Posición i",
    celda: (f) => f.indice,
    numerica: true,
  },
  {
    id: "fecha_bruta",
    encabezado: "time[i] recibido",
    celda: (f) => (
      <span className="font-mono">{formatoBruto(f.fecha_bruta)}</span>
    ),
  },
  {
    id: "fecha_hora",
    encabezado: "fecha_hora (UTC)",
    celda: (f) =>
      f.fecha_hora ? (
        <span className="font-mono">{formatoFechaUtc(f.fecha_hora)}</span>
      ) : (
        <span className="font-semibold text-destructive">no válida</span>
      ),
  },
  {
    id: "t",
    encabezado: "temperatura_c (°C)",
    celda: (f) => <Bruto valor={f.temperatura_bruta} />,
    numerica: true,
  },
  {
    id: "h",
    encabezado: "humedad_pct (%)",
    celda: (f) => <Bruto valor={f.humedad_bruta} />,
    numerica: true,
  },
  {
    id: "p",
    encabezado: "precipitacion_mm (mm)",
    celda: (f) => <Bruto valor={f.precipitacion_bruta} />,
    numerica: true,
  },
]

export function PestanaTransformados({ etl }: { etl: PipelineEtl }) {
  const t = etl.fases?.transformacion
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Una fila por ciudad y posición de los arrays. Los valores se muestran
        tal y como llegaron (aún sin validar): <code>null</code> y{" "}
        <code>(ausente)</code> se conservan, no se convierten en 0.
      </p>
      {t && t.problemas.length > 0 && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Problemas estructurales en las respuestas</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {t.problemas.map((p, i) => (
                <li key={i}>
                  <b>{p.ciudad}:</b> {p.mensaje}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <TablaPaginada
        etiqueta="Datos transformados"
        filas={t?.filas ?? []}
        columnas={COLUMNAS}
        claveFila={(f) => f.uid}
        vacio="Sin datos transformados todavía."
      />
    </div>
  )
}
