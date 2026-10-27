import type { Ciudad } from "./ciudades"
import type { RespuestaOpenMeteo } from "./tipos"

export const URL_ARCHIVO_OPEN_METEO =
  "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export const MAX_DIAS_EXTRACCION = 31
/** Primer día con datos en el archivo histórico de Open-Meteo. */
export const FECHA_MINIMA_ARCHIVO = "1940-01-01"

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Convierte "AAAA-MM-DD" en milisegundos UTC, o null si no es una fecha real. */
export function fechaUtcMs(fecha: string): number | null {
  if (!FECHA_RE.test(fecha)) return null
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  // Date.parse acepta 2026-02-31 en algunos motores; se comprueba el viaje de ida y vuelta.
  if (new Date(ms).toISOString().slice(0, 10) !== fecha) return null
  return ms
}

export function diasEntre(inicio: string, fin: string): number | null {
  const a = fechaUtcMs(inicio)
  const b = fechaUtcMs(fin)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86_400_000) + 1
}

export type ConfigExtraccion = {
  ciudades: string[]
  inicio: string
  fin: string
}

/** Devuelve la lista de errores de validación (vacía si la configuración es correcta). */
export function validarConfigExtraccion(
  config: ConfigExtraccion,
  hoyUtc: string
): string[] {
  const errores: string[] = []
  if (config.ciudades.length === 0) {
    errores.push("Selecciona al menos una ciudad.")
  }
  const inicioMs = fechaUtcMs(config.inicio)
  const finMs = fechaUtcMs(config.fin)
  if (inicioMs === null) errores.push("La fecha inicial no es válida.")
  if (finMs === null) errores.push("La fecha final no es válida.")
  if (inicioMs !== null && finMs !== null) {
    if (finMs < inicioMs) {
      errores.push("La fecha final debe ser igual o posterior a la inicial.")
    } else {
      const dias = diasEntre(config.inicio, config.fin)!
      if (dias > MAX_DIAS_EXTRACCION) {
        errores.push(
          `El periodo tiene ${dias} días; el máximo por extracción es ${MAX_DIAS_EXTRACCION}.`
        )
      }
    }
    if (inicioMs < fechaUtcMs(FECHA_MINIMA_ARCHIVO)!) {
      errores.push("El archivo histórico empieza el 1 de enero de 1940.")
    }
    const hoyMs = fechaUtcMs(hoyUtc)
    if (hoyMs !== null && finMs > hoyMs) {
      errores.push("La fecha final no puede ser posterior a hoy (UTC).")
    }
  }
  return errores
}

export function construirUrlArchivo(
  ciudad: Ciudad,
  inicio: string,
  fin: string
): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${URL_ARCHIVO_OPEN_METEO}?${params.toString()}`
}

export type ResultadoDescarga =
  | { ok: true; url: string; json: RespuestaOpenMeteo; estadoHttp: number }
  | { ok: false; url: string; error: string; estadoHttp?: number }

/** Descarga una ciudad. Nunca lanza: los fallos se devuelven como resultado. */
export async function descargarCiudad(
  ciudad: Ciudad,
  inicio: string,
  fin: string,
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<ResultadoDescarga> {
  const url = construirUrlArchivo(ciudad, inicio, fin)
  let respuesta: Response
  try {
    respuesta = await fetchFn(url, { signal })
  } catch (e) {
    return {
      ok: false,
      url,
      error: `No se pudo conectar con Open-Meteo: ${(e as Error).message}`,
    }
  }
  let cuerpo: unknown
  try {
    cuerpo = await respuesta.json()
  } catch {
    return {
      ok: false,
      url,
      estadoHttp: respuesta.status,
      error: `Respuesta no JSON (HTTP ${respuesta.status}).`,
    }
  }
  const obj = cuerpo as Record<string, unknown> | null
  if (!respuesta.ok || (obj && obj.error === true)) {
    const motivo =
      obj && typeof obj.reason === "string" ? obj.reason : "error desconocido"
    return {
      ok: false,
      url,
      estadoHttp: respuesta.status,
      error: `Open-Meteo respondió HTTP ${respuesta.status}: ${motivo}`,
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      ok: false,
      url,
      estadoHttp: respuesta.status,
      error: "La respuesta no es un objeto JSON.",
    }
  }
  return {
    ok: true,
    url,
    json: obj as RespuestaOpenMeteo,
    estadoHttp: respuesta.status,
  }
}
