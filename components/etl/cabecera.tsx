"use client"

import * as React from "react"
import {
  CloudDownloadIcon,
  DatabaseIcon,
  FilterIcon,
  ShieldCheckIcon,
  TableIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/** Radar decorativo: gira más rápido mientras hay una descarga o una carga en curso. */
export function Reactor({ activo }: { activo: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-14 shrink-0 text-primary drop-shadow-[0_0_10px_rgb(42_212_255/0.6)]"
      aria-hidden
    >
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
      />
      <g
        className={cn(
          "origin-center",
          activo
            ? "motion-safe:animate-[spin_2s_linear_infinite]"
            : "motion-safe:animate-[spin_14s_linear_infinite]"
        )}
      >
        <circle
          cx="32"
          cy="32"
          r="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="10 6"
        />
      </g>
      <g
        className={cn(
          "origin-center",
          activo
            ? "motion-safe:animate-[spin_3s_linear_infinite_reverse]"
            : "motion-safe:animate-[spin_20s_linear_infinite_reverse]"
        )}
      >
        <circle
          cx="32"
          cy="32"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeDasharray="2 4"
        />
      </g>
      <circle
        cx="32"
        cy="32"
        r="9"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
      />
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </svg>
  )
}

const suscribirSegundo = (avisar: () => void) => {
  const id = setInterval(avisar, 1000)
  return () => clearInterval(id)
}

/** Reloj UTC real. En el servidor no se pinta la hora, para no desajustar la hidratación. */
export function RelojUtc() {
  const ahora = React.useSyncExternalStore(
    suscribirSegundo,
    () => new Date().toISOString().slice(0, 19),
    () => null
  )
  return (
    <p className="font-mono text-sm tabular-nums" aria-label="Hora UTC actual">
      <span className="hud-titulo mr-2 text-[0.65rem] text-muted-foreground">
        UTC
      </span>
      <span className="hud-brillo">
        {ahora ? ahora.replace("T", " ") : "—"}
      </span>
    </p>
  )
}

const PASOS = [
  {
    icono: CloudDownloadIcon,
    titulo: "Descargar",
    texto:
      "Pedimos a Open-Meteo el tiempo de cada hora: temperatura, humedad y lluvia.",
  },
  {
    icono: TableIcon,
    titulo: "Ordenar en filas",
    texto:
      "La respuesta llega en listas separadas; las juntamos en una fila por ciudad y hora.",
  },
  {
    icono: ShieldCheckIcon,
    titulo: "Revisar",
    texto:
      "Apartamos las filas con datos vacíos, imposibles o repetidos, y decimos por qué.",
  },
  {
    icono: FilterIcon,
    titulo: "Elegir",
    texto:
      "Tú decides qué filas subir: filtra, ordena y marca las que quieras.",
  },
  {
    icono: DatabaseIcon,
    titulo: "Guardar",
    texto:
      "Las enviamos a Supabase (base de datos en la nube) y comprobamos que han llegado.",
  },
]

/** Explicación del proceso en lenguaje sencillo, para quien no conoce el tema. */
export function ComoFunciona() {
  return (
    <section aria-labelledby="como-funciona" className="vidrio rounded-xl p-3">
      <h2
        id="como-funciona"
        className="hud-titulo mb-2 text-[0.7rem] text-primary"
      >
        Cómo funciona, en 5 pasos
      </h2>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {PASOS.map((p, i) => (
          <li
            key={p.titulo}
            className="neu-elevado flex gap-2 rounded-lg bg-background/40 p-2"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/50 font-mono text-xs text-primary">
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-1 text-sm font-semibold">
                <p.icono className="size-3.5 text-primary" aria-hidden />{" "}
                {p.titulo}
              </p>
              <p className="text-xs text-muted-foreground">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
