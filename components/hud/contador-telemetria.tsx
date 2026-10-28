import { Cifra } from "@/components/hud/cifra"
import { formatoDecimal } from "@/lib/formato"
import { cn } from "@/lib/utils"

/**
 * Valor numérico importante, a la manera de un instrumento de precisión:
 * índice, cifra grande con separadores finos, unidad y una regla de
 * referencia con la proporción real (parte / total) si se conoce.
 */
export function ContadorTelemetria({
  indice,
  etiqueta,
  valor,
  unidad,
  referencia,
  nota,
  destacado,
}: {
  indice: string
  etiqueta: string
  valor: number
  unidad: string
  /** Proporción real respecto a un total. Si el total es 0 no se dibuja. */
  referencia?: { parte: number; total: number; texto: string }
  nota?: string
  destacado?: boolean
}) {
  const proporcion =
    referencia && referencia.total > 0
      ? Math.min(1, referencia.parte / referencia.total)
      : null
  return (
    <div className={cn("telemetria", destacado && "telemetria-destacada")}>
      <dt className="telemetria-etiqueta">
        <span className="telemetria-indice">{indice}</span>
        {etiqueta}
      </dt>
      <dd className="telemetria-valor">
        <span className="num-principal telemetria-cifra">
          <Cifra valor={valor} fino />
        </span>
        <span className="telemetria-unidad">{unidad}</span>
      </dd>
      {proporcion !== null && referencia ? (
        <dd className="telemetria-regla" aria-hidden>
          <span
            className="telemetria-regla-relleno"
            style={{ transform: `scaleX(${proporcion})` }}
          />
          <span className="telemetria-regla-marcas" />
        </dd>
      ) : (
        <dd className="telemetria-regla telemetria-regla-vacia" aria-hidden />
      )}
      <dd className="telemetria-nota">
        {referencia && proporcion !== null
          ? `${formatoDecimal(proporcion * 100, 0)} % · ${referencia.texto}`
          : (nota ?? referencia?.texto)}
        {nota && referencia && proporcion !== null ? ` · ${nota}` : ""}
      </dd>
    </div>
  )
}
