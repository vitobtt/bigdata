"use client"

import * as React from "react"
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react"

import {
  ESTADO_NODO_TEXTO,
  type Mision,
  type Nodo,
  type NodoId,
} from "@/lib/mision"

export type PanelNodo = {
  nodo: NodoId
  mensaje: string
  accion: string
  ejecutar: () => void
}

/** Curva suave entre dos nodos: un tramo del recorrido, no una línea recta. */
const TRAZO = "M0 12 C 14 12, 14 4, 24 4 S 34 12, 48 12"

function Enlace({ encendido }: { encendido: boolean }) {
  return (
    <svg
      className="mision-enlace"
      viewBox="0 0 48 16"
      preserveAspectRatio="none"
      aria-hidden
      data-encendido={encendido ? "" : undefined}
    >
      <path className="mision-enlace-base" d={TRAZO} />
      <path className="mision-enlace-luz" d={TRAZO} pathLength={1} />
      {/* Destello de un solo recorrido, cuando el tramo se ilumina. */}
      <path className="mision-enlace-pulso" d={TRAZO} pathLength={1} />
    </svg>
  )
}

function Simbolo({ nodo }: { nodo: Nodo }) {
  if (nodo.estado === "completado") return <CheckIcon aria-hidden />
  if (nodo.estado === "error") return <TriangleAlertIcon aria-hidden />
  return <span aria-hidden>{nodo.numero}</span>
}

/**
 * Mission Path: cuatro nodos unidos por tramos SVG. Compacto por defecto; solo
 * se expande un panel cuando hay una acción importante. Todos los nodos se
 * pueden pulsar en cualquier momento: no es un asistente paso a paso rígido.
 */
export function MissionPath({
  mision,
  panel,
  onNodo,
  onCerrarPanel,
  nodoAbierto,
}: {
  mision: Mision
  panel: PanelNodo | null
  onNodo: (id: NodoId) => void
  onCerrarPanel: () => void
  /** Nodo cuya herramienta está abierta ahora mismo. */
  nodoAbierto: NodoId | null
}) {
  const panelNodo = panel ? mision.nodos.find((n) => n.id === panel.nodo) : null
  const idPanel = React.useId()

  return (
    <div className="mision-envoltorio">
      {panel && panelNodo && (
        <div
          className="mision-panel"
          role="group"
          aria-labelledby={`${idPanel}-t`}
          data-estado={panelNodo.estado}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              onCerrarPanel()
            }
          }}
        >
          <div className="mision-panel-cabecera">
            <p id={`${idPanel}-t`} className="mision-panel-titulo">
              {panelNodo.numero} / {panelNodo.etiqueta.toUpperCase()}
            </p>
            <span className="mision-panel-estado" data-estado={panelNodo.estado}>
              {ESTADO_NODO_TEXTO[panelNodo.estado]}
            </span>
            <button
              type="button"
              className="mision-panel-cerrar"
              aria-label="Cerrar el aviso"
              onClick={onCerrarPanel}
            >
              <XIcon aria-hidden />
            </button>
          </div>
          <p className="mision-panel-texto">{panel.mensaje}</p>
          <button
            type="button"
            className="mision-panel-accion"
            onClick={panel.ejecutar}
          >
            {panel.accion}
          </button>
        </div>
      )}

      <nav className="mision" aria-label="Ruta de trabajo">
        <ol className="mision-lista">
          {mision.nodos.map((n, i) => {
            const enOperacion =
              n.estado === "activo" && (n.id === "extraer" || n.id === "guardar")
            return (
              <li key={n.id} className="mision-paso">
                <button
                  type="button"
                  className="mision-nodo"
                  data-estado={n.estado}
                  data-abierto={nodoAbierto === n.id ? "" : undefined}
                  // Solo las operaciones reales (descargar, guardar) muestran el arco giratorio.
                  data-operacion={enOperacion ? "" : undefined}
                  aria-current={n.estado === "activo" ? "step" : undefined}
                  aria-disabled={n.estado === "pendiente" ? true : undefined}
                  aria-expanded={
                    panel?.nodo === n.id ||
                    (n.id === "inspeccionar" && nodoAbierto === n.id)
                  }
                  onClick={() => onNodo(n.id)}
                >
                  <span className="mision-circulo">
                    <Simbolo nodo={n} />
                  </span>
                  <span className="mision-nombre">{n.etiqueta}</span>
                  <span className="sr-only">
                    , paso {n.numero}, {ESTADO_NODO_TEXTO[n.estado].toLowerCase()}.{" "}
                    {n.mensaje}
                    {n.estado === "pendiente" && n.falta ? ` ${n.falta}.` : ""}
                  </span>
                </button>
                {i < mision.nodos.length - 1 && (
                  <Enlace encendido={mision.enlaces[i]} />
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
