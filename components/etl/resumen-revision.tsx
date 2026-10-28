import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatoEntero } from "@/lib/formato"

type Segmento = { id: string; etiqueta: string; n: number; clase: string }

/**
 * Resumen real del espacio de revisión: cuántos registros hay en cada estado.
 * Los rechazados se clasifican por el motivo que ya devuelve la validación.
 */
export function ResumenRevision({ etl }: { etl: PipelineEtl }) {
  const rechazados = etl.fases?.limpieza.rechazados ?? []
  let duplicados = 0
  let fueraRango = 0
  let incompletos = 0
  for (const r of rechazados) {
    if (r.duplicadoDe !== undefined || r.motivos.some((m) => m.startsWith("duplicado")))
      duplicados++
    else if (r.motivos.some((m) => /fuera de rango|negativa/.test(m)))
      fueraRango++
    else incompletos++
  }
  const validos = etl.validos.length
  const seleccionados = etl.aCargar.length
  const sinSeleccionar = Math.max(0, validos - seleccionados)

  const segmentos: Segmento[] = [
    { id: "sel", etiqueta: "Seleccionados", n: seleccionados, clase: "seg-sel" },
    { id: "val", etiqueta: "Válidos sin seleccionar", n: sinSeleccionar, clase: "seg-val" },
    { id: "inc", etiqueta: "Incompletos", n: incompletos, clase: "seg-inc" },
    { id: "rng", etiqueta: "Fuera de rango", n: fueraRango, clase: "seg-rng" },
    { id: "dup", etiqueta: "Duplicados", n: duplicados, clase: "seg-dup" },
  ]
  const total = segmentos.reduce((a, s) => a + s.n, 0)
  if (total === 0) return null

  return (
    <div className="resumen-revision">
      <div
        className="resumen-barra"
        role="img"
        aria-label={segmentos
          .map((s) => `${s.etiqueta}: ${formatoEntero(s.n)}`)
          .join(", ")}
      >
        {segmentos
          .filter((s) => s.n > 0)
          .map((s) => (
            <span
              key={s.id}
              className={s.clase}
              style={{ flexGrow: s.n }}
              title={`${s.etiqueta}: ${formatoEntero(s.n)}`}
            />
          ))}
      </div>
      <ul className="resumen-leyenda">
        {segmentos.map((s) => (
          <li key={s.id} data-vacio={s.n === 0 ? "" : undefined}>
            <span className={`resumen-punto ${s.clase}`} aria-hidden />
            <span className="etiqueta-tecnica">{s.etiqueta}</span>
            <span className="num-secundario">{formatoEntero(s.n)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
