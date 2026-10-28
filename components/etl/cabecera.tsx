"use client"

import * as React from "react"
import {
  CloudDownloadIcon,
  DatabaseIcon,
  FilterIcon,
  ShieldCheckIcon,
  TableIcon,
} from "lucide-react"


/** Giroscopio 3D decorativo: anillos en ejes distintos; gira más rápido durante una descarga o carga. */
export function Reactor({ activo }: { activo: boolean }) {
  return (
    <div
      className="hud-reactor"
      data-activo={activo ? "" : undefined}
      aria-hidden
    >
      <div className="hud-reactor-giro">
        <span className="hud-anillo hud-anillo-a" />
        <span className="hud-anillo hud-anillo-b" />
        <span className="hud-anillo hud-anillo-c" />
        <span className="hud-nucleo" />
      </div>
    </div>
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
    <p className="num-principal text-lg" aria-label="Hora UTC actual">
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
            data-tilt
            className="neu-elevado hud-inclinable flex gap-2 rounded-lg bg-background/40 p-2"
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
