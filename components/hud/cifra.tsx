"use client"

import * as React from "react"

import { formatoEntero } from "@/lib/formato"

/** Número que «rueda» hasta su valor nuevo (como un odómetro) en lugar de saltar. */
/** `fino`: separador de millares como espacio fino, más técnico que el punto. */
export function Cifra({
  valor,
  ms = 700,
  fino = false,
}: {
  valor: number
  ms?: number
  fino?: boolean
}) {
  const [mostrado, setMostrado] = React.useState(valor)
  const actual = React.useRef(valor)

  React.useEffect(() => {
    const desde = actual.current
    if (
      desde === valor ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      actual.current = valor
      const id = requestAnimationFrame(() => setMostrado(valor))
      return () => cancelAnimationFrame(id)
    }
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const suave = 1 - Math.pow(1 - p, 4)
      actual.current = Math.round(desde + (valor - desde) * suave)
      setMostrado(actual.current)
      if (p < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [valor, ms])

  return (
    <span key={valor} className="hud-cifra">
      {fino ? formatoEntero(mostrado).replace(/\./g, " ") : formatoEntero(mostrado)}
    </span>
  )
}
