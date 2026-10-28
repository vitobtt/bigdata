"use client"

import { RotateCcwIcon, Volume2Icon, VolumeXIcon } from "lucide-react"

import type { EstadoVoz, ServicioVoz } from "@/lib/voz/servicio-voz"
import { VisualizadorVoz } from "./visualizador-voz"

/**
 * Controles discretos del asistente: activar, silenciar, repetir y volumen.
 * El audio empieza desactivado; todo lo que dice la voz también se ve en pantalla.
 */
export function ControlesVoz({
  estado,
  servicio,
  montado,
}: {
  estado: EstadoVoz
  servicio: ServicioVoz
  montado: boolean
}) {
  // Hasta que el cliente monta no se sabe si hay soporte: no se pinta nada distinto.
  if (!montado) return <div className="voz" aria-hidden />

  if (!estado.soportado) {
    return (
      <div className="voz">
        <button
          type="button"
          className="voz-boton"
          disabled
          aria-label="Asistente de voz no disponible: este navegador no admite síntesis de voz"
          title="Este navegador no admite síntesis de voz. NIMBUS funciona igual sin audio."
        >
          <VolumeXIcon aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className="voz" role="group" aria-label="Asistente de voz">
      <VisualizadorVoz hablando={estado.hablando && estado.activa} />
      <button
        type="button"
        className="voz-boton"
        aria-pressed={estado.activa}
        aria-label={
          estado.activa
            ? "Desactivar el asistente de voz"
            : "Activar el asistente de voz"
        }
        title={estado.activa ? "Desactivar voz" : "Activar voz"}
        data-activo={estado.activa ? "" : undefined}
        onClick={() => (estado.activa ? servicio.desactivar() : servicio.activar())}
      >
        <Volume2Icon aria-hidden />
      </button>
      {estado.activa && (
        <>
          <button
            type="button"
            className="voz-boton"
            aria-pressed={estado.silenciada}
            aria-label={estado.silenciada ? "Quitar el silencio" : "Silenciar ahora"}
            title={estado.silenciada ? "Quitar silencio" : "Silenciar"}
            onClick={() => servicio.silenciar(!estado.silenciada)}
          >
            <VolumeXIcon aria-hidden />
          </button>
          <button
            type="button"
            className="voz-boton"
            aria-label="Repetir el último mensaje"
            title="Repetir último mensaje"
            disabled={!estado.ultimoMensaje || estado.silenciada}
            onClick={() => servicio.repetir()}
          >
            <RotateCcwIcon aria-hidden />
          </button>
          <label className="voz-volumen">
            <span className="sr-only">Volumen del asistente</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((estado.silenciada ? 0 : estado.volumen) * 100)}
              aria-valuetext={`${Math.round((estado.silenciada ? 0 : estado.volumen) * 100)} %`}
              onChange={(e) => servicio.fijarVolumen(Number(e.target.value) / 100)}
            />
          </label>
        </>
      )}
    </div>
  )
}
