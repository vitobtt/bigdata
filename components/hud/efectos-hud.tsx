"use client"

import * as React from "react"

/**
 * Microinteracciones globales del HUD, por delegación de eventos (sin tocar cada botón):
 * - Onda de energía al pulsar cualquier botón.
 * - Foco de luz que sigue al puntero sobre los paneles de cristal.
 * - Inclinación 3D con reflejo especular en los elementos marcados con `data-tilt`.
 * Todo se desactiva con «reducir movimiento».
 */
export function EfectosHud() {
  React.useEffect(() => {
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reducir.matches) return

    const alPulsar = (e: PointerEvent) => {
      const boton = (e.target as Element | null)?.closest<HTMLElement>(
        '[data-slot="button"]:not(:disabled)'
      )
      if (!boton) return
      const caja = boton.getBoundingClientRect()
      const onda = document.createElement("span")
      onda.className = "hud-onda"
      const d = Math.max(caja.width, caja.height) * 2
      onda.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - caja.left - d / 2}px;top:${e.clientY - caja.top - d / 2}px`
      boton.append(onda)
      onda.addEventListener("animationend", () => onda.remove(), { once: true })
    }

    let cuadro = 0
    const alMover = (e: PointerEvent) => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        const objetivo = e.target as Element | null
        const panel = objetivo?.closest<HTMLElement>(".hud-panel")
        if (panel) {
          const c = panel.getBoundingClientRect()
          panel.style.setProperty("--mx", `${e.clientX - c.left}px`)
          panel.style.setProperty("--my", `${e.clientY - c.top}px`)
        }
        const t = objetivo?.closest<HTMLElement>("[data-tilt]")
        if (t) {
          const c = t.getBoundingClientRect()
          const x = (e.clientX - c.left) / c.width
          const y = (e.clientY - c.top) / c.height
          t.style.setProperty("--ry", `${(x - 0.5) * 14}deg`)
          t.style.setProperty("--rx", `${(0.5 - y) * 14}deg`)
          t.style.setProperty("--gx", `${x * 100}%`)
          t.style.setProperty("--gy", `${y * 100}%`)
          t.dataset.inclinado = ""
        }
      })
    }

    const alSalir = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest<HTMLElement>("[data-tilt]")
      if (!t || t.contains(e.relatedTarget as Node | null)) return
      t.style.removeProperty("--rx")
      t.style.removeProperty("--ry")
      delete t.dataset.inclinado
    }

    document.addEventListener("pointerdown", alPulsar)
    document.addEventListener("pointermove", alMover, { passive: true })
    document.addEventListener("pointerout", alSalir)
    return () => {
      cancelAnimationFrame(cuadro)
      document.removeEventListener("pointerdown", alPulsar)
      document.removeEventListener("pointermove", alMover)
      document.removeEventListener("pointerout", alSalir)
    }
  }, [])

  return null
}
