"use client"

import * as React from "react"

import { crearServicioVoz } from "@/lib/voz/servicio-voz"

/**
 * Crea el servicio de voz una sola vez por montaje y expone su estado.
 * Al desmontar cancela el audio y suelta los eventos del navegador.
 */
export function useAsistenteVoz() {
  const [servicio] = React.useState(() => crearServicioVoz())
  React.useEffect(() => {
    servicio.iniciar()
    return () => servicio.destruir()
  }, [servicio])
  const estado = React.useSyncExternalStore(
    servicio.subscribe,
    servicio.getSnapshot,
    servicio.getServerSnapshot
  )
  return { servicio, estado }
}
