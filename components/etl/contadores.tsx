import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatoEntero } from "@/lib/formato"
import { cn } from "@/lib/utils"

export function Contadores({ etl }: { etl: PipelineEtl }) {
  const total = etl.fases?.transformacion.filas.length ?? 0
  const rechazados = etl.fases?.limpieza.rechazados.length ?? 0
  const fuera = etl.contadoresSeleccion.seleccionadosFueraDeFiltros
  const items = [
    {
      etiqueta: "Total extraído",
      valor: total,
      ayuda: "filas tras transformar",
    },
    {
      etiqueta: "Válidos",
      valor: etl.validos.length,
      ayuda: "superan la limpieza",
    },
    {
      etiqueta: "Rechazados",
      valor: rechazados,
      ayuda: "por calidad o duplicado",
    },
    {
      etiqueta: "Coinciden con los filtros",
      valor: etl.coinciden.length,
      ayuda: "de los válidos",
    },
    {
      etiqueta: "Seleccionados para cargar",
      valor: etl.aCargar.length,
      ayuda: fuera
        ? `+${formatoEntero(fuera)} seleccionados fuera de filtros (no se suben)`
        : "seleccionados y dentro de los filtros",
      destacado: true,
    },
  ]
  return (
    <dl
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      aria-live="polite"
    >
      {items.map((i) => (
        <div
          key={i.etiqueta}
          className={cn(
            "flex flex-col rounded-lg border bg-card p-3",
            i.destacado &&
              "col-span-2 border-primary/40 bg-primary/5 sm:col-span-1"
          )}
        >
          <dt className="text-xs font-medium text-muted-foreground">
            {i.etiqueta}
          </dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums">
            {formatoEntero(i.valor)}
          </dd>
          <dd
            className={cn(
              "text-xs text-muted-foreground",
              i.destacado &&
                fuera > 0 &&
                "font-medium text-amber-700 dark:text-amber-400"
            )}
          >
            {i.ayuda}
          </dd>
        </div>
      ))}
    </dl>
  )
}
