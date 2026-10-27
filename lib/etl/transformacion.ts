import type {
  FilaTransformada,
  ProblemaEstructural,
  RespuestaOpenMeteo,
} from "./tipos"

/** Variable de Open-Meteo → columna de la fila y unidad que se pidió. */
export const COLUMNAS = [
  { variable: "temperature_2m", columna: "temperatura_bruta", unidad: "°C" },
  { variable: "relative_humidity_2m", columna: "humedad_bruta", unidad: "%" },
  { variable: "precipitation", columna: "precipitacion_bruta", unidad: "mm" },
] as const

// Open-Meteo devuelve "2026-09-01T00:00" sin zona; aceptamos también una Z explícita.
const FECHA_HORA_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?(Z)?$/

/**
 * Interpreta una marca de tiempo como UTC de forma explícita (añadiendo "Z"),
 * para que el resultado no dependa de la zona horaria del navegador.
 */
export function interpretarFechaUtc(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = FECHA_HORA_RE.exec(valor)
  if (!m) return null
  const normalizada = `${m[1]}${m[2] ?? ":00"}Z`
  const ms = Date.parse(normalizada)
  if (Number.isNaN(ms)) return null
  const iso = new Date(ms).toISOString()
  // Rechaza fechas imposibles que el motor haya "corregido" (p. ej. 31 de abril).
  if (iso.slice(0, 19) !== normalizada.slice(0, 19)) return null
  return iso
}

export type ResultadoTransformacion = {
  filas: FilaTransformada[]
  problemas: ProblemaEstructural[]
}

/**
 * Convierte los arrays paralelos `hourly.time`, `hourly.temperature_2m`, ...
 * en una fila por posición. No valida los valores: eso es la fase de limpieza.
 * Si los arrays tienen longitudes distintas se genera una fila por cada
 * posición del array más largo y las posiciones que faltan quedan `undefined`
 * (ausentes), nunca a cero.
 */
export function transformarCiudad(
  ciudad: string,
  json: RespuestaOpenMeteo
): ResultadoTransformacion {
  const problemas: ProblemaEstructural[] = []
  const hourly = json.hourly
  if (!hourly || typeof hourly !== "object" || Array.isArray(hourly)) {
    problemas.push({ ciudad, mensaje: "La respuesta no contiene «hourly»." })
    return { filas: [], problemas }
  }
  const tiempos = hourly.time
  if (!Array.isArray(tiempos)) {
    problemas.push({
      ciudad,
      mensaje: "«hourly.time» no es un array; no se pueden construir filas.",
    })
    return { filas: [], problemas }
  }

  // La zona se pidió en UTC; si la respuesta dice otra cosa no podemos fiarnos de las horas.
  const desfase = json.utc_offset_seconds
  const utcConfirmado = desfase === undefined || desfase === 0
  if (!utcConfirmado) {
    problemas.push({
      ciudad,
      mensaje: `utc_offset_seconds = ${String(desfase)}; se esperaba 0 (UTC). Las fechas se rechazan.`,
    })
  }

  const arrays: Record<string, unknown[] | null> = {}
  const avisosColumna: Record<string, string | null> = {}
  let longitudMax = tiempos.length
  for (const { variable, unidad } of COLUMNAS) {
    const valores = hourly[variable]
    if (!Array.isArray(valores)) {
      arrays[variable] = null
      problemas.push({ ciudad, mensaje: `Falta el array «${variable}».` })
      continue
    }
    arrays[variable] = valores
    longitudMax = Math.max(longitudMax, valores.length)
    const unidadRecibida = json.hourly_units?.[variable]
    avisosColumna[variable] =
      unidadRecibida !== undefined && unidadRecibida !== unidad
        ? `unidad de ${variable} inesperada: «${unidadRecibida}» (se esperaba «${unidad}»)`
        : null
    if (avisosColumna[variable]) {
      problemas.push({ ciudad, mensaje: avisosColumna[variable]! })
    }
  }

  const longitudes = [
    `time=${tiempos.length}`,
    ...COLUMNAS.map(
      ({ variable }) => `${variable}=${arrays[variable]?.length ?? "—"}`
    ),
  ]
  const coherentes = COLUMNAS.every(
    ({ variable }) => arrays[variable]?.length === tiempos.length
  )
  if (!coherentes) {
    problemas.push({
      ciudad,
      mensaje: `Longitudes de arrays incoherentes (${longitudes.join(", ")}). Las posiciones que faltan se marcan como ausentes.`,
    })
  }

  const filas: FilaTransformada[] = []
  for (let i = 0; i < longitudMax; i++) {
    const avisos: string[] = []
    if (i >= tiempos.length) avisos.push("posición ausente en time")
    const valores: Record<string, unknown> = {}
    for (const { variable, columna } of COLUMNAS) {
      const arr = arrays[variable]
      if (!arr) {
        avisos.push(`falta el array ${variable}`)
        valores[columna] = undefined
        continue
      }
      if (i >= arr.length) avisos.push(`posición ausente en ${variable}`)
      if (avisosColumna[variable]) avisos.push(avisosColumna[variable]!)
      valores[columna] = arr[i]
    }
    if (!utcConfirmado) avisos.push("la respuesta no está en UTC")
    const fechaBruta = tiempos[i]
    filas.push({
      uid: `${ciudad}#${i}`,
      ciudad,
      indice: i,
      fecha_bruta: fechaBruta,
      fecha_hora: utcConfirmado ? interpretarFechaUtc(fechaBruta) : null,
      temperatura_bruta: valores.temperatura_bruta,
      humedad_bruta: valores.humedad_bruta,
      precipitacion_bruta: valores.precipitacion_bruta,
      avisos,
    })
  }
  return { filas, problemas }
}
