import { NOMBRES_CIUDADES } from "./ciudades"
import { interpretarFechaUtc } from "./transformacion"
import type { Medicion } from "./tipos"

/** Describe un valor no válido para que el motivo de rechazo sea legible. */
export function describirValor(valor: unknown): string {
  if (valor === undefined) return "ausente"
  if (valor === null) return "nulo"
  if (typeof valor === "string") {
    return valor.trim() === "" ? "cadena vacía" : `texto «${valor}»`
  }
  if (typeof valor === "number") {
    if (Number.isNaN(valor)) return "NaN"
    if (!Number.isFinite(valor)) return "infinito"
  }
  return `tipo ${typeof valor}`
}

export function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

type Medidas = {
  temperatura: unknown
  humedad: unknown
  precipitacion: unknown
}

/**
 * Reglas de calidad sobre las tres mediciones. Devuelve los motivos de rechazo.
 * No hay umbrales de temperatura: un valor extremo pero numérico es un dato válido.
 */
export function motivosMedidas({
  temperatura,
  humedad,
  precipitacion,
}: Medidas): string[] {
  const motivos: string[] = []
  if (!esNumeroFinito(temperatura)) {
    motivos.push(`temperatura ${describirValor(temperatura)}`)
  }
  if (!esNumeroFinito(humedad)) {
    motivos.push(`humedad ${describirValor(humedad)}`)
  } else if (humedad < 0 || humedad > 100) {
    motivos.push(`humedad fuera de rango 0–100 % (${humedad})`)
  }
  if (!esNumeroFinito(precipitacion)) {
    motivos.push(`precipitación ${describirValor(precipitacion)}`)
  } else if (precipitacion < 0) {
    motivos.push(`precipitación negativa (${precipitacion} mm)`)
  }
  return motivos
}

const CAMPOS_MEDICION = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const

export type ResultadoValidacionServidor =
  { ok: true; medicion: Medicion } | { ok: false; motivos: string[] }

/**
 * Validación estricta de un registro recibido por la API. Se usa en el
 * servidor: nunca se confía en que el navegador haya limpiado los datos.
 */
export function validarMedicionEntrante(
  valor: unknown
): ResultadoValidacionServidor {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return { ok: false, motivos: ["no es un objeto"] }
  }
  const obj = valor as Record<string, unknown>
  const motivos: string[] = []
  const sobrantes = Object.keys(obj).filter(
    (k) => !(CAMPOS_MEDICION as readonly string[]).includes(k)
  )
  if (sobrantes.length > 0) {
    motivos.push(`campos no permitidos: ${sobrantes.join(", ")}`)
  }
  if (
    typeof obj.ciudad !== "string" ||
    !NOMBRES_CIUDADES.includes(obj.ciudad)
  ) {
    motivos.push(`ciudad no reconocida (${describirValor(obj.ciudad)})`)
  }
  // Solo se acepta ISO completo con Z, el formato que produce la transformación.
  const fecha =
    typeof obj.fecha_hora === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(obj.fecha_hora)
      ? interpretarFechaUtc(obj.fecha_hora.replace(/\.\d{3}Z$/, "Z"))
      : null
  if (!fecha) {
    motivos.push(`fecha_hora no válida (${describirValor(obj.fecha_hora)})`)
  }
  motivos.push(
    ...motivosMedidas({
      temperatura: obj.temperatura_c,
      humedad: obj.humedad_pct,
      precipitacion: obj.precipitacion_mm,
    })
  )
  if (motivos.length > 0) return { ok: false, motivos }
  return {
    ok: true,
    medicion: {
      ciudad: obj.ciudad as string,
      fecha_hora: fecha!,
      temperatura_c: obj.temperatura_c as number,
      humedad_pct: obj.humedad_pct as number,
      precipitacion_mm: obj.precipitacion_mm as number,
    },
  }
}
