"use client"

import * as React from "react"

const GLIFOS = "01<>/\\|{}[]#$%&*+=ΣΔΩ"

/** Título que se «descifra» letra a letra al cargar (secuencia de arranque tipo JARVIS). */
export function TextoDescifrado({ texto }: { texto: string }) {
  const [vista, setVista] = React.useState(texto)

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t0 = performance.now()
    const dur = 900
    let id = 0
    const paso = (t: number) => {
      const fijas = Math.floor(((t - t0) / dur) * texto.length)
      setVista(
        texto
          .split("")
          .map((c, i) =>
            i < fijas || c === " "
              ? c
              : GLIFOS[Math.floor(Math.random() * GLIFOS.length)]
          )
          .join("")
      )
      if (fijas < texto.length) id = requestAnimationFrame(paso)
      else setVista(texto)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [texto])

  return (
    <span aria-label={texto}>
      <span aria-hidden>{vista}</span>
    </span>
  )
}
