import { claveMedicion, type Medicion } from "./tipos"

export const TAMANO_LOTE = 500

export type EstadoEnvio = "pendiente" | "enviando" | "completado" | "error"
export type EstadoVerificacion =
  "pendiente" | "verificando" | "confirmado" | "incompleto" | "error"

export type Lote = {
  numero: number
  registros: Medicion[]
  envio: EstadoEnvio
  errorEnvio?: string
  /**
   * Filas que Postgres declara afectadas por el upsert. Supabase no distingue
   * entre insertadas y actualizadas, así que no se inventa ese desglose.
   * null si la respuesta no incluyó el recuento.
   */
  filasAfectadas?: number | null
  duracionEnvioMs?: number
  verificacion: EstadoVerificacion
  errorVerificacion?: string
  /** Claves enviadas que no se encontraron en destino. */
  clavesFaltantes?: string[]
}

export type RespuestaEnvio =
  { ok: true; filasAfectadas: number | null } | { ok: false; error: string }

export type RespuestaVerificacion =
  { ok: true; clavesFaltantes: string[] } | { ok: false; error: string }

export type FuncionesCarga = {
  enviar: (registros: Medicion[]) => Promise<RespuestaEnvio>
  verificar: (registros: Medicion[]) => Promise<RespuestaVerificacion>
  /** Recibe una copia nueva del estado tras cada cambio. */
  alCambiar: (lotes: Lote[]) => void
  ahora?: () => number
}

export function crearLotes(
  registros: Medicion[],
  tamano = TAMANO_LOTE
): Lote[] {
  if (tamano < 1 || tamano > TAMANO_LOTE) {
    throw new Error(`El tamaño de lote debe estar entre 1 y ${TAMANO_LOTE}`)
  }
  const lotes: Lote[] = []
  for (let i = 0; i < registros.length; i += tamano) {
    lotes.push({
      numero: lotes.length + 1,
      // Copia: el lote no debe cambiar aunque cambie el array original.
      registros: registros.slice(i, i + tamano).map((r) => ({ ...r })),
      envio: "pendiente",
      verificacion: "pendiente",
    })
  }
  return lotes
}

/**
 * Envía, uno a uno, los lotes que no se han completado (pendientes o con error)
 * y después verifica en destino los lotes enviados que aún no están confirmados.
 * Un fallo en un lote no deshace ni repite los lotes ya completados: como la
 * carga es un upsert por (ciudad, fecha_hora), reintentar es idempotente.
 */
export async function ejecutarCarga(
  lotesIniciales: Lote[],
  {
    enviar,
    verificar,
    alCambiar,
    ahora = () => performance.now(),
  }: FuncionesCarga
): Promise<Lote[]> {
  let lotes = lotesIniciales.map((l) => ({ ...l }))
  const actualizar = (i: number, cambios: Partial<Lote>) => {
    lotes = lotes.map((l, j) => (j === i ? { ...l, ...cambios } : l))
    alCambiar(lotes)
  }

  for (let i = 0; i < lotes.length; i++) {
    if (lotes[i].envio === "completado") continue
    actualizar(i, {
      envio: "enviando",
      errorEnvio: undefined,
      verificacion: "pendiente",
      errorVerificacion: undefined,
      clavesFaltantes: undefined,
    })
    const inicio = ahora()
    let r: RespuestaEnvio
    try {
      r = await enviar(lotes[i].registros)
    } catch (e) {
      r = { ok: false, error: (e as Error).message }
    }
    const duracionEnvioMs = ahora() - inicio
    if (r.ok) {
      actualizar(i, {
        envio: "completado",
        filasAfectadas: r.filasAfectadas,
        duracionEnvioMs,
      })
    } else {
      actualizar(i, { envio: "error", errorEnvio: r.error, duracionEnvioMs })
    }
  }

  for (let i = 0; i < lotes.length; i++) {
    const l = lotes[i]
    if (l.envio !== "completado" || l.verificacion === "confirmado") continue
    actualizar(i, { verificacion: "verificando" })
    let r: RespuestaVerificacion
    try {
      r = await verificar(l.registros)
    } catch (e) {
      r = { ok: false, error: (e as Error).message }
    }
    if (!r.ok) {
      actualizar(i, { verificacion: "error", errorVerificacion: r.error })
    } else if (r.clavesFaltantes.length > 0) {
      actualizar(i, {
        verificacion: "incompleto",
        clavesFaltantes: r.clavesFaltantes,
      })
    } else {
      actualizar(i, { verificacion: "confirmado", clavesFaltantes: [] })
    }
  }
  return lotes
}

export type InformeCarga = {
  totalRegistros: number
  lotes: number
  lotesCompletados: number
  lotesFallidos: number
  registrosEnviadosOk: number
  registrosFallidos: number
  registrosConfirmados: number
  /** Suma de filas afectadas, o null si algún lote no informó el recuento. */
  filasAfectadas: number | null
}

export function resumirCarga(lotes: Lote[]): InformeCarga {
  let registrosEnviadosOk = 0
  let registrosFallidos = 0
  let registrosConfirmados = 0
  let filasAfectadas: number | null = 0
  for (const l of lotes) {
    if (l.envio === "completado") {
      registrosEnviadosOk += l.registros.length
      if (filasAfectadas !== null) {
        filasAfectadas =
          l.filasAfectadas == null ? null : filasAfectadas + l.filasAfectadas
      }
    } else if (l.envio === "error") {
      registrosFallidos += l.registros.length
    }
    if (l.verificacion === "confirmado")
      registrosConfirmados += l.registros.length
    if (l.verificacion === "incompleto") {
      registrosConfirmados +=
        l.registros.length - (l.clavesFaltantes?.length ?? 0)
    }
  }
  return {
    totalRegistros: lotes.reduce((n, l) => n + l.registros.length, 0),
    lotes: lotes.length,
    lotesCompletados: lotes.filter((l) => l.envio === "completado").length,
    lotesFallidos: lotes.filter((l) => l.envio === "error").length,
    registrosEnviadosOk,
    registrosFallidos,
    registrosConfirmados,
    filasAfectadas: lotes.some((l) => l.envio === "completado")
      ? filasAfectadas
      : 0,
  }
}

/**
 * Compara las claves enviadas con los instantes encontrados en destino.
 * Se compara en milisegundos porque Postgres devuelve "+00:00" en lugar de "Z".
 */
export function clavesNoEncontradas(
  enviados: Pick<Medicion, "ciudad" | "fecha_hora">[],
  encontrados: Pick<Medicion, "ciudad" | "fecha_hora">[]
): string[] {
  const enDestino = new Set(
    encontrados.map((e) => `${e.ciudad}|${Date.parse(e.fecha_hora)}`)
  )
  return enviados
    .filter((e) => !enDestino.has(`${e.ciudad}|${Date.parse(e.fecha_hora)}`))
    .map((e) => claveMedicion(e.ciudad, e.fecha_hora))
}
