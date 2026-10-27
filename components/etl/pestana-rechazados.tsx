"use client"

import * as React from "react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { FilaRechazada } from "@/lib/etl/tipos"
import { formatoBruto, formatoEntero } from "@/lib/formato"
import { TablaPaginada, type Columna } from "./tabla-paginada"

const COLUMNAS: Columna<FilaRechazada>[] = [
  {
    id: "ciudad",
    encabezado: "Ciudad",
    celda: (r) => r.fila.ciudad || "(vacía)",
  },
  {
    id: "i",
    encabezado: "Posición i",
    celda: (r) => r.fila.indice,
    numerica: true,
  },
  {
    id: "fecha",
    encabezado: "time[i] recibido",
    celda: (r) => (
      <span className="font-mono">{formatoBruto(r.fila.fecha_bruta)}</span>
    ),
  },
  {
    id: "t",
    encabezado: "Temperatura (°C)",
    celda: (r) => formatoBruto(r.fila.temperatura_bruta),
    numerica: true,
  },
  {
    id: "h",
    encabezado: "Humedad (%)",
    celda: (r) => formatoBruto(r.fila.humedad_bruta),
    numerica: true,
  },
  {
    id: "p",
    encabezado: "Precipitación (mm)",
    celda: (r) => formatoBruto(r.fila.precipitacion_bruta),
    numerica: true,
  },
  {
    id: "motivo",
    encabezado: "Motivo del rechazo",
    celda: (r) => (
      <ul className="min-w-56 whitespace-normal">
        {r.motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    ),
  },
]

export function PestanaRechazados({ etl }: { etl: PipelineEtl }) {
  const rechazados = React.useMemo(
    () => etl.fases?.limpieza.rechazados ?? [],
    [etl.fases]
  )
  const resumen = React.useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const r of rechazados) {
      for (const m of r.motivos) {
        // Agrupa por tipo de motivo (sin el valor concreto).
        const tipo = m
          .replace(/\s*\(.*\)$/, "")
          .replace(/duplicado de .*/, "duplicado")
        cuenta.set(tipo, (cuenta.get(tipo) ?? 0) + 1)
      }
    }
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  }, [rechazados])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Registros descartados por <b>calidad</b> en la fase de limpieza. Los
        registros que no cumplen tus filtros no aparecen aquí: siguen siendo
        válidos.
      </p>
      {resumen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {resumen.map(([tipo, n]) => (
            <li key={tipo} className="rounded-md border px-2 py-0.5">
              {tipo}: <b className="tabular-nums">{formatoEntero(n)}</b>
            </li>
          ))}
        </ul>
      )}
      <TablaPaginada
        etiqueta="Registros rechazados"
        filas={rechazados}
        columnas={COLUMNAS}
        claveFila={(r) => r.fila.uid}
        vacio={
          etl.fases
            ? "Ningún registro rechazado: todos los datos recibidos superan las reglas de calidad."
            : "Sin datos todavía."
        }
      />
    </div>
  )
}
