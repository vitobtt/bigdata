"use client"

import * as React from "react"

import {
  crearLotes,
  ejecutarCarga,
  type Lote,
  type RespuestaEnvio,
  type RespuestaVerificacion,
} from "@/lib/etl/carga"
import { CIUDADES, buscarCiudad } from "@/lib/etl/ciudades"
import {
  descargarCiudad,
  validarConfigExtraccion,
  type ConfigExtraccion,
} from "@/lib/etl/extraccion"
import {
  aMedicion,
  conjuntoACargar,
  contarSeleccion,
  filtrarYOrdenarMedido,
  huellaConjunto,
  FILTROS_VACIOS,
  ORDEN_POR_DEFECTO,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtrado"
import { limpiar, type ResultadoLimpieza } from "@/lib/etl/limpieza"
import {
  transformarCiudad,
  type ResultadoTransformacion,
} from "@/lib/etl/transformacion"
import type { FilaValida, Medicion, RespuestaOpenMeteo } from "@/lib/etl/tipos"
import { hoyUtc } from "@/lib/formato"

export type EstadoDescarga =
  "pendiente" | "descargando" | "completada" | "error"

export type DescargaCiudad = {
  id: string
  nombre: string
  estado: EstadoDescarga
  url?: string
  /** JSON original tal y como llegó; se conserva durante la sesión. */
  json?: RespuestaOpenMeteo
  error?: string
  duracionMs?: number
  recibidoEn?: string
  intentos: number
}

export type Extraccion = {
  ciudades: string[]
  inicio: string
  fin: string
  descargas: Record<string, DescargaCiudad>
  enCurso: boolean
  duracionMs?: number
}

export type Fases = {
  transformacion: ResultadoTransformacion & {
    posicionesEntrada: number
    respuestasEntrada: number
    duracionMs: number
  }
  limpieza: ResultadoLimpieza & { duracionMs: number }
}

export type Carga = {
  /** Copia congelada al iniciar la carga: no cambia aunque cambien filtros o selección. */
  congelado: Medicion[]
  huella: string
  lotes: Lote[]
  enCurso: boolean
  iniciadaEn: string
  duracionMs?: number
}

export type EstadoSupabase =
  | { cargando: true }
  | {
      cargando: false
      configurado: boolean
      conectado: boolean
      mensaje?: string
      totalRegistros?: number | null
      /** Dominio del proyecto en la nube, p. ej. abcd.supabase.co */
      proyecto?: string | null
      escrituraPermitida?: boolean
    }

/** Transformación y limpieza a partir de los JSON originales, midiendo la duración real. */
function ejecutarFases(ext: Extraccion): Fases {
  const t0 = performance.now()
  const filas: ResultadoTransformacion["filas"] = []
  const problemas: ResultadoTransformacion["problemas"] = []
  let posicionesEntrada = 0
  let respuestasEntrada = 0
  // Se recorre en el orden de extracción: define qué duplicado aparece primero.
  for (const id of ext.ciudades) {
    const d = ext.descargas[id]
    if (!d?.json) continue
    respuestasEntrada++
    const time = d.json.hourly?.time
    posicionesEntrada += Array.isArray(time) ? time.length : 0
    const r = transformarCiudad(d.nombre, d.json)
    filas.push(...r.filas)
    problemas.push(...r.problemas)
  }
  const t1 = performance.now()
  const limpieza = limpiar(filas)
  const t2 = performance.now()
  return {
    transformacion: {
      filas,
      problemas,
      posicionesEntrada,
      respuestasEntrada,
      duracionMs: t1 - t0,
    },
    limpieza: { ...limpieza, duracionMs: t2 - t1 },
  }
}

async function enviarLote(registros: Medicion[]): Promise<RespuestaEnvio> {
  const r = await fetch("/api/supabase/carga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registros }),
  })
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) {
    const detalles = cuerpo?.detalles?.length
      ? ` (${cuerpo.detalles.join(" · ")})`
      : ""
    return {
      ok: false,
      error: `HTTP ${r.status}: ${cuerpo?.error ?? "respuesta no válida"}${detalles}`,
    }
  }
  return { ok: true, filasAfectadas: cuerpo?.filasAfectadas ?? null }
}

async function verificarLote(
  registros: Medicion[]
): Promise<RespuestaVerificacion> {
  const r = await fetch("/api/supabase/verificacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      claves: registros.map(({ ciudad, fecha_hora }) => ({
        ciudad,
        fecha_hora,
      })),
    }),
  })
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok || !Array.isArray(cuerpo?.clavesFaltantes)) {
    return {
      ok: false,
      error: `HTTP ${r.status}: ${cuerpo?.error ?? "respuesta no válida"}`,
    }
  }
  return { ok: true, clavesFaltantes: cuerpo.clavesFaltantes }
}

export function usePipelineEtl() {
  const [config, setConfig] = React.useState<ConfigExtraccion>({
    ciudades: CIUDADES.map((c) => c.id),
    inicio: "2026-09-01",
    fin: "2026-09-30",
  })
  const [erroresConfig, setErroresConfig] = React.useState<string[]>([])
  const [extraccion, setExtraccion] = React.useState<Extraccion | null>(null)
  const extraccionRef = React.useRef<Extraccion | null>(null)
  const [fases, setFases] = React.useState<Fases | null>(null)
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_VACIOS)
  const [orden, setOrden] = React.useState<Orden>(ORDEN_POR_DEFECTO)
  const [seleccion, setSeleccion] = React.useState<ReadonlySet<string>>(
    new Set()
  )
  const [carga, setCarga] = React.useState<Carga | null>(null)
  const cargandoRef = React.useRef(false)
  const [supabase, setSupabase] = React.useState<EstadoSupabase>({
    cargando: true,
  })
  const [versionDestino, setVersionDestino] = React.useState(0)

  /** Con `silencioso`, refresca el estado sin pasar por «comprobando» (p. ej. tras una carga). */
  const comprobarSupabase = React.useCallback(async (silencioso = false) => {
    if (!silencioso) setSupabase({ cargando: true })
    try {
      const r = await fetch("/api/supabase/estado", { cache: "no-store" })
      setSupabase({ cargando: false, ...(await r.json()) })
    } catch (e) {
      setSupabase({
        cargando: false,
        configurado: false,
        conectado: false,
        mensaje: `No se pudo consultar el servidor: ${(e as Error).message}`,
      })
    }
  }, [])

  React.useEffect(() => {
    // Sincronización con un sistema externo (el servidor) al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void comprobarSupabase()
  }, [comprobarSupabase])

  /** Aplica cambios a la extracción y, si cambian los datos, recalcula las fases. */
  const actualizarExtraccion = React.useCallback(
    (cambiar: (e: Extraccion) => Extraccion, recalcular: boolean) => {
      const actual = extraccionRef.current
      if (!actual) return
      const siguiente = cambiar(actual)
      extraccionRef.current = siguiente
      setExtraccion(siguiente)
      if (recalcular) {
        const nuevas = ejecutarFases(siguiente)
        setFases(nuevas)
        // La selección solo puede contener claves que siguen siendo válidas.
        const claves = new Set(nuevas.limpieza.validos.map((v) => v.clave))
        setSeleccion((s) => new Set([...s].filter((k) => claves.has(k))))
      }
    },
    []
  )

  const descargar = React.useCallback(
    async (id: string) => {
      const ext = extraccionRef.current
      const ciudad = buscarCiudad(id)
      if (!ext || !ciudad) return
      actualizarExtraccion(
        (e) => ({
          ...e,
          descargas: {
            ...e.descargas,
            [id]: {
              ...e.descargas[id],
              estado: "descargando",
              error: undefined,
              intentos: e.descargas[id].intentos + 1,
            },
          },
        }),
        false
      )
      const t0 = performance.now()
      const r = await descargarCiudad(ciudad, ext.inicio, ext.fin)
      const duracionMs = performance.now() - t0
      // Un reintento SUSTITUYE el JSON de esa ciudad: no se acumulan filas repetidas.
      actualizarExtraccion(
        (e) => ({
          ...e,
          descargas: {
            ...e.descargas,
            [id]: {
              ...e.descargas[id],
              url: r.url,
              duracionMs,
              ...(r.ok
                ? {
                    estado: "completada",
                    json: r.json,
                    recibidoEn: new Date().toISOString(),
                  }
                : { estado: "error", error: r.error, json: undefined }),
            },
          },
        }),
        true
      )
    },
    [actualizarExtraccion]
  )

  const extraer = React.useCallback(async () => {
    if (extraccionRef.current?.enCurso || cargandoRef.current) return
    const errores = validarConfigExtraccion(config, hoyUtc())
    setErroresConfig(errores)
    if (errores.length > 0) return
    const ciudades = CIUDADES.filter((c) => config.ciudades.includes(c.id))
    const nueva: Extraccion = {
      ciudades: ciudades.map((c) => c.id),
      inicio: config.inicio,
      fin: config.fin,
      enCurso: true,
      descargas: Object.fromEntries(
        ciudades.map((c) => [
          c.id,
          { id: c.id, nombre: c.nombre, estado: "pendiente", intentos: 0 },
        ])
      ),
    }
    extraccionRef.current = nueva
    setExtraccion(nueva)
    setFases(null)
    setSeleccion(new Set())
    setCarga(null)
    const t0 = performance.now()
    // Secuencial: así se ve qué ciudad se está procesando y cuáles faltan.
    for (const c of ciudades) await descargar(c.id)
    const duracionMs = performance.now() - t0
    actualizarExtraccion((e) => ({ ...e, enCurso: false, duracionMs }), false)
  }, [config, descargar, actualizarExtraccion])

  const reintentarCiudad = React.useCallback(
    async (id: string) => {
      const ext = extraccionRef.current
      if (!ext || ext.enCurso || cargandoRef.current) return
      actualizarExtraccion((e) => ({ ...e, enCurso: true }), false)
      const t0 = performance.now()
      await descargar(id)
      const duracionMs = performance.now() - t0
      actualizarExtraccion((e) => ({ ...e, enCurso: false, duracionMs }), false)
    },
    [descargar, actualizarExtraccion]
  )

  // válidos → filtros → ordenación (la paginación ocurre después, solo en la vista)
  const validos: FilaValida[] = React.useMemo(
    () => fases?.limpieza.validos ?? [],
    [fases]
  )
  const filtrado = React.useMemo(
    () => filtrarYOrdenarMedido(validos, filtros, orden),
    [validos, filtros, orden]
  )
  const coinciden = filtrado.filas
  // → selección: solo las seleccionadas que siguen cumpliendo los filtros, en el orden elegido
  const aCargar = React.useMemo(
    () => conjuntoACargar(coinciden, seleccion),
    [coinciden, seleccion]
  )
  const contadoresSeleccion = React.useMemo(
    () => contarSeleccion(validos, aCargar, seleccion),
    [validos, aCargar, seleccion]
  )
  const huellaACargar = React.useMemo(() => huellaConjunto(aCargar), [aCargar])

  const alternarSeleccion = React.useCallback(
    (claves: string[], valor: boolean) => {
      setSeleccion((s) => {
        const n = new Set(s)
        for (const k of claves) {
          if (valor) n.add(k)
          else n.delete(k)
        }
        return n
      })
    },
    []
  )

  const seleccionarCoincidentes = React.useCallback(() => {
    alternarSeleccion(
      coinciden.map((f) => f.clave),
      true
    )
  }, [coinciden, alternarSeleccion])

  /** Marca o desmarca una ciudad para la próxima extracción (mantiene el orden fijo). */
  const alternarCiudadExtraccion = React.useCallback(
    (id: string, marcada: boolean) =>
      setConfig((c) => ({
        ...c,
        ciudades: marcada
          ? CIUDADES.map((x) => x.id).filter(
              (x) => x === id || c.ciudades.includes(x)
            )
          : c.ciudades.filter((x) => x !== id),
      })),
    []
  )

  const vaciarSeleccion = React.useCallback(() => setSeleccion(new Set()), [])
  const restablecerFiltros = React.useCallback(() => {
    setFiltros(FILTROS_VACIOS)
    setOrden(ORDEN_POR_DEFECTO)
  }, [])

  const correrCarga = React.useCallback(
    async (lotes: Lote[]) => {
      const t0 = performance.now()
      setCarga((c) => (c ? { ...c, enCurso: true, lotes } : c))
      try {
        await ejecutarCarga(lotes, {
          enviar: enviarLote,
          verificar: verificarLote,
          alCambiar: (ls) => setCarga((c) => (c ? { ...c, lotes: ls } : c)),
        })
      } finally {
        const duracionMs = performance.now() - t0
        setCarga((c) => (c ? { ...c, enCurso: false, duracionMs } : c))
        cargandoRef.current = false
        setVersionDestino((v) => v + 1)
        // Actualiza el recuento de filas persistidas que se muestra en la cabecera.
        void comprobarSupabase(true)
      }
    },
    [comprobarSupabase]
  )

  const iniciarCarga = React.useCallback(() => {
    // La ref evita dobles envíos aunque se pulse dos veces antes de re-renderizar.
    if (cargandoRef.current || aCargar.length === 0) return
    cargandoRef.current = true
    const congelado = aCargar.map(aMedicion)
    const lotes = crearLotes(congelado)
    setCarga({
      congelado,
      huella: huellaConjunto(congelado),
      lotes,
      enCurso: true,
      iniciadaEn: new Date().toISOString(),
    })
    void correrCarga(lotes)
  }, [aCargar, correrCarga])

  const reintentarCarga = React.useCallback(() => {
    if (cargandoRef.current || !carga) return
    cargandoRef.current = true
    void correrCarga(carga.lotes)
  }, [carga, correrCarga])

  return {
    config,
    setConfig,
    alternarCiudadExtraccion,
    erroresConfig,
    extraccion,
    extraer,
    reintentarCiudad,
    fases,
    validos,
    filtros,
    setFiltros,
    orden,
    setOrden,
    restablecerFiltros,
    coinciden,
    duracionFiltradoMs: filtrado.duracionMs,
    seleccion,
    alternarSeleccion,
    seleccionarCoincidentes,
    vaciarSeleccion,
    aCargar,
    huellaACargar,
    contadoresSeleccion,
    carga,
    iniciarCarga,
    reintentarCarga,
    supabase,
    comprobarSupabase,
    versionDestino,
  }
}

export type PipelineEtl = ReturnType<typeof usePipelineEtl>
