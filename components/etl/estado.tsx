import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type Estado = "pendiente" | "en_curso" | "completada" | "error"

export const ESTADO_TEXTO: Record<Estado, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  error: "Con errores",
}

const ESTADOS: Record<
  Estado,
  { etiqueta: string; icono: typeof CircleCheckIcon; clase: string }
> = {
  pendiente: {
    etiqueta: "Pendiente",
    icono: CircleDashedIcon,
    clase: "text-muted-foreground border-border",
  },
  en_curso: {
    etiqueta: "En curso",
    icono: LoaderCircleIcon,
    clase:
      "text-sky-700 border-sky-300 bg-sky-50 dark:text-sky-300 dark:border-sky-800 dark:bg-sky-950",
  },
  completada: {
    etiqueta: "Completada",
    icono: CircleCheckIcon,
    clase:
      "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950",
  },
  error: {
    etiqueta: "Con errores",
    icono: CircleAlertIcon,
    clase: "text-destructive border-destructive/40 bg-destructive/5",
  },
}

/** Estado con icono + texto: no depende solo del color. */
export function InsigniaEstado({
  estado,
  etiqueta,
  className,
}: {
  estado: Estado
  etiqueta?: string
  className?: string
}) {
  const e = ESTADOS[estado]
  const Icono = e.icono
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        e.clase,
        estado === "completada" && "hud-confirmar",
        estado === "error" && "hud-alerta",
        className
      )}
    >
      <Icono
        aria-hidden
        className={cn("size-3.5", estado === "en_curso" && "animate-spin")}
      />
      {etiqueta ?? e.etiqueta}
    </span>
  )
}
