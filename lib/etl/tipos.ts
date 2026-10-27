/** Registro normalizado: una ciudad y una hora. Es la forma que se carga en Supabase. */
export type Medicion = {
  ciudad: string
  /** Instante en ISO 8601 con zona UTC explícita, p. ej. 2026-09-01T00:00:00.000Z */
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

/** Valor tal y como llegó en el JSON. `undefined` significa que la posición no existía en el array. */
export type ValorBruto = unknown

/** Resultado de la fase de transformación: arrays paralelos convertidos en filas, sin validar. */
export type FilaTransformada = {
  /** Identificador estable de la fila dentro de la sesión: ciudad + posición en el array. */
  uid: string
  ciudad: string
  /** Posición en los arrays originales. */
  indice: number
  fecha_bruta: ValorBruto
  /** ISO UTC si la fecha se pudo interpretar; null en caso contrario. */
  fecha_hora: string | null
  temperatura_bruta: ValorBruto
  humedad_bruta: ValorBruto
  precipitacion_bruta: ValorBruto
  /** Problemas detectados al construir la fila (posiciones ausentes, unidades, zona). */
  avisos: string[]
}

export type FilaValida = Medicion & {
  uid: string
  /** Clave de negocio única: ciudad|fecha_hora */
  clave: string
}

export type FilaRechazada = {
  fila: FilaTransformada
  motivos: string[]
  /** Si es un duplicado, clave de la fila que se conservó. */
  duplicadoDe?: string
}

export type ProblemaEstructural = {
  ciudad: string
  mensaje: string
}

export type RespuestaOpenMeteo = {
  latitude?: number
  longitude?: number
  utc_offset_seconds?: number
  timezone?: string
  hourly_units?: Record<string, string>
  hourly?: Record<string, unknown>
  [clave: string]: unknown
}

export function claveMedicion(ciudad: string, fechaHoraIso: string): string {
  return `${ciudad}|${fechaHoraIso}`
}
