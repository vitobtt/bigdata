"use client"

import * as React from "react"

import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { useAsistenteVoz } from "@/hooks/use-asistente-voz"
import { useNarracion } from "@/hooks/use-narracion"
import { validarConfigExtraccion } from "@/lib/etl/extraccion"
import { hoyUtc } from "@/lib/formato"
import {
  calcularMision,
  calcularSugerencia,
  type NodoId,
} from "@/lib/mision"
import type { Pestana } from "../etl/pipeline"
import { ControlesVoz } from "./controles-voz"
import {
  DataLens,
  VISTA_LENTE_INICIAL,
  type VistaLente,
} from "./data-lens"
import { MissionPath, type PanelNodo } from "./mission-path"

const alMontar = () => () => {}

function desplazarA(id: string) {
  const titulo = document.getElementById(id)
  const destino = titulo?.closest("section") ?? titulo
  if (!destino) return
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  destino.scrollIntoView({
    behavior: reducido ? "auto" : "smooth",
    block: "start",
  })
  if (titulo) {
    titulo.setAttribute("tabindex", "-1")
    titulo.focus({ preventScroll: true })
  }
}

/**
 * Asistente de NIMBUS: voz opcional, Mission Path y Data Lens. Lee el mismo
 * estado que el resto de la página y no cambia ninguna de sus operaciones.
 */
export function AsistenteNimbus({
  etl,
  alInspeccionar,
}: {
  etl: PipelineEtl
  /** Abre la inspección completa en la pestaña indicada. */
  alInspeccionar: (p: Pestana) => void
}) {
  const montado = React.useSyncExternalStore(
    alMontar,
    () => true,
    () => false
  )
  const { servicio, estado: voz } = useAsistenteVoz()

  const [lenteAbierta, setLenteAbierta] = React.useState(false)
  const [vista, setVista] = React.useState<VistaLente>(VISTA_LENTE_INICIAL)
  const [abierto, setAbierto] = React.useState<NodoId | null>(null)
  const [descartada, setDescartada] = React.useState<string | null>(null)
  const disparador = React.useRef<HTMLElement | null>(null)

  // Número de extracciones iniciadas: identifica la «ronda» de trabajo actual.
  const enCurso = !!etl.extraccion?.enCurso
  const [ciclo, setCiclo] = React.useState(0)
  const [enCursoPrevio, setEnCursoPrevio] = React.useState(false)
  if (enCurso !== enCursoPrevio) {
    setEnCursoPrevio(enCurso)
    if (enCurso) setCiclo((c) => c + 1)
  }

  const s = etl.supabase
  const destinoListo =
    !s.cargando && s.configurado && s.conectado && s.escrituraPermitida !== false
  const motivoDestino = s.cargando
    ? "Comprobando la conexión con Supabase."
    : !s.configurado
      ? "Supabase no está configurado."
      : !s.conectado
        ? "No se puede acceder a Supabase."
        : s.escrituraPermitida === false
          ? "La escritura en Supabase está bloqueada."
          : null

  const configValida =
    validarConfigExtraccion(etl.config, hoyUtc()).length === 0
  const mision = calcularMision({
    configValida,
    hayErrorConfig: etl.erroresConfig.length > 0 && !configValida,
    extraccion: etl.extraccion,
    validos: etl.validos.length,
    rechazados: etl.fases?.limpieza.rechazados.length ?? 0,
    aCargar: etl.aCargar.length,
    carga: etl.carga,
    destinoListo,
    motivoDestino,
    lenteAbierta,
  })

  useNarracion({ etl, servicio, activa: voz.activa, lenteAbierta })

  const cerrarLente = React.useCallback((devolverFoco = true) => {
    setLenteAbierta(false)
    const el = disparador.current
    disparador.current = null
    if (devolverFoco && el?.isConnected)
      requestAnimationFrame(() => el.focus({ preventScroll: true }))
  }, [])

  const abrirLente = () => {
    disparador.current = document.activeElement as HTMLElement | null
    setAbierto(null)
    setLenteAbierta(true)
  }

  // El panel solo se expande por una acción importante (o porque el usuario
  // pulsó un paso que aún no está disponible).
  const sugerencia = calcularSugerencia(mision, { lenteAbierta, carga: etl.carga, ciclo })
  const sugerenciaVisible =
    sugerencia && sugerencia.clave !== descartada && !lenteAbierta && !abierto
      ? sugerencia
      : null

  const irAGuardar = () => {
    cerrarLente(false)
    setAbierto(null)
    alInspeccionar("carga")
  }

  const ejecutar = (id: NodoId) => {
    setAbierto(null)
    if (sugerencia) setDescartada(sugerencia.clave)
    if (id === "configurar") {
      cerrarLente(false)
      desplazarA("titulo-dock")
    } else if (id === "extraer") {
      cerrarLente(false)
      desplazarA("titulo-flujo")
    } else if (id === "inspeccionar") {
      abrirLente()
    } else {
      irAGuardar()
    }
  }

  const alPulsarNodo = (id: NodoId) => {
    const nodo = mision.nodos.find((n) => n.id === id)!
    if (id === "inspeccionar" && lenteAbierta) return cerrarLente()
    // Un paso que aún no tiene nada que mostrar explica por qué, en lugar de abrir algo vacío.
    if (nodo.estado === "pendiente") {
      setAbierto((a) => (a === id ? null : id))
      return
    }
    ejecutar(id)
  }

  let panel: PanelNodo | null = null
  if (abierto) {
    const nodo = mision.nodos.find((n) => n.id === abierto)!
    const hayRegistros = etl.validos.length > 0
    const alternativa: { accion: string; ejecutar: () => void } =
      !etl.extraccion
        ? {
            accion: "Elegir ciudades",
            ejecutar: () => ejecutar("configurar"),
          }
        : abierto === "guardar" && hayRegistros && etl.aCargar.length === 0
          ? { accion: "Revisar datos", ejecutar: () => ejecutar("inspeccionar") }
          : abierto === "guardar" && etl.aCargar.length > 0
            ? {
                accion: "Ver estado de Supabase",
                ejecutar: () => {
                  setAbierto(null)
                  alInspeccionar("supabase")
                },
              }
            : { accion: "Extraer datos", ejecutar: () => ejecutar("extraer") }
    panel = { nodo: abierto, mensaje: nodo.mensaje, ...alternativa }
  } else if (sugerenciaVisible) {
    const { nodo, mensaje, accion } = sugerenciaVisible
    panel = {
      nodo,
      mensaje,
      accion,
      ejecutar: () => ejecutar(nodo),
    }
  }

  const cerrarPanel = () => {
    setAbierto(null)
    if (sugerencia) setDescartada(sugerencia.clave)
  }

  const visible = !!etl.extraccion || voz.activa || lenteAbierta
  const nodoAbierto: NodoId | null = lenteAbierta ? "inspeccionar" : null

  return (
    <aside className="asistente" aria-label="Asistente NIMBUS">
      {montado && voz.activa && voz.hablando && voz.ultimoMensaje && (
        // Los subtítulos son visuales: la voz ya la oye quien tiene el audio activado.
        <p className="asistente-subtitulo" aria-hidden>
          {voz.ultimoMensaje}
        </p>
      )}

      {montado && voz.aviso && (
        <div className="asistente-aviso" role="status">
          <p>{voz.aviso}</p>
          {voz.sinVozEspanola && voz.activa && !voz.usarVozSistema && (
            <div className="asistente-aviso-acciones">
              <button type="button" onClick={servicio.aceptarVozSistema}>
                Usar voz del sistema
              </button>
              <button type="button" onClick={servicio.desactivar}>
                Continuar sin audio
              </button>
            </div>
          )}
        </div>
      )}

      {lenteAbierta && (
        <DataLens
          etl={etl}
          vista={vista}
          onVista={setVista}
          onCerrar={() => cerrarLente()}
          onInspeccionCompleta={() => {
            cerrarLente(false)
            alInspeccionar("validos")
            // Tras el desplazamiento, el foco queda al comienzo de la inspección.
            requestAnimationFrame(() => {
              const t = document.getElementById("titulo-taller")
              t?.setAttribute("tabindex", "-1")
              t?.focus({ preventScroll: true })
            })
          }}
          onGuardar={irAGuardar}
        />
      )}

      <div className="asistente-barra">
        {visible && (
          <MissionPath
            mision={mision}
            panel={panel}
            onNodo={alPulsarNodo}
            onCerrarPanel={cerrarPanel}
            nodoAbierto={nodoAbierto}
          />
        )}
        <ControlesVoz estado={voz} servicio={servicio} montado={montado} />
      </div>
    </aside>
  )
}
