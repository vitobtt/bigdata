"use client"

import * as React from "react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { estadoCarga, type EstadoCarga } from "@/lib/mision"
import { MENSAJES } from "@/lib/voz/mensajes"
import type { ServicioVoz } from "@/lib/voz/servicio-voz"

/**
 * Convierte cambios reales de estado en mensajes del asistente. Habla solo en
 * las transiciones (no mientras un estado se mantiene) y nunca anuncia un éxito
 * antes de que la operación lo haya confirmado.
 */
export function useNarracion({
  etl,
  servicio,
  activa,
  lenteAbierta,
}: {
  etl: PipelineEtl
  servicio: ServicioVoz
  activa: boolean
  lenteAbierta: boolean
}) {
  const enCurso = !!etl.extraccion?.enCurso
  const hayExtraccion = !!etl.extraccion
  const hayErrorDescarga = !!etl.extraccion &&
    Object.values(etl.extraccion.descargas).some((d) => d.estado === "error")
  const validos = etl.validos.length
  const aCargar = etl.aCargar.length
  const cargaEstado = estadoCarga(etl.carga)

  const previo = React.useRef<{
    activa: boolean
    enCurso: boolean
    lente: boolean
    carga: EstadoCarga
  }>({ activa: false, enCurso: false, lente: false, carga: "ninguna" })
  // Lo que ya se ha dicho en la extracción actual: no se repite al cambiar filtros.
  const dicho = React.useRef({ lente: false, seleccion: false })
  // Valores más recientes para leerlos dentro del efecto sin añadirlos a sus dependencias.
  const reciente = React.useRef({ hayExtraccion, hayErrorDescarga, validos })
  React.useEffect(() => {
    reciente.current = { hayExtraccion, hayErrorDescarga, validos }
  })

  React.useEffect(() => {
    const p = previo.current
    const r = reciente.current

    if (activa && !p.activa) {
      servicio.decir(MENSAJES.activado)
      // Solo tiene sentido pedir la configuración si aún no se ha extraído nada.
      if (!r.hayExtraccion) servicio.decir(MENSAJES.configurar, { encolar: true })
    }

    if (enCurso && !p.enCurso) {
      dicho.current = { lente: false, seleccion: false }
      servicio.decir(MENSAJES.extraccion_iniciada)
    } else if (!enCurso && p.enCurso) {
      servicio.decir(
        r.hayErrorDescarga
          ? MENSAJES.extraccion_error
          : r.validos === 0
            ? MENSAJES.extraccion_sin_validos
            : MENSAJES.extraccion_completada
      )
    }

    if (lenteAbierta && !p.lente && !dicho.current.lente) {
      dicho.current.lente = true
      servicio.decir(MENSAJES.inspeccion_abierta)
    }

    if (cargaEstado !== p.carga) {
      if (cargaEstado === "en_curso") servicio.decir(MENSAJES.carga_iniciada)
      else if (p.carga === "en_curso" && cargaEstado === "confirmada")
        servicio.decir(MENSAJES.carga_completada)
      else if (p.carga === "en_curso" && cargaEstado === "error")
        servicio.decir(MENSAJES.carga_error)
    }

    previo.current = { activa, enCurso, lente: lenteAbierta, carga: cargaEstado }
  }, [activa, enCurso, lenteAbierta, cargaEstado, servicio])

  // «Selección lista»: una sola vez por extracción y con una pequeña espera,
  // para no hablar encima de quien aún está marcando casillas.
  React.useEffect(() => {
    if (
      aCargar === 0 ||
      !hayExtraccion ||
      enCurso ||
      cargaEstado !== "ninguna" ||
      dicho.current.seleccion
    )
      return
    const t = setTimeout(() => {
      dicho.current.seleccion = true
      servicio.decir(MENSAJES.seleccion_lista)
    }, 1200)
    return () => clearTimeout(t)
  }, [aCargar, hayExtraccion, enCurso, cargaEstado, servicio])
}
