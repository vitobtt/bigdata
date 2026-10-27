import { CIUDADES } from "./ciudades"
import type { Medicion } from "./tipos"

/**
 * Color fijo de cada ciudad (paleta categórica validada para daltonismo).
 * Sigue a la ciudad, nunca a su posición: filtrar no repinta las demás.
 */
export const COLOR_CIUDAD: Record<string, string> = Object.fromEntries(
  CIUDADES.map((c, i) => [c.nombre, `var(--chart-${i + 1})`])
)

export type EstadisticasCiudad = {
  ciudad: string
  registros: number
  temperaturaMin: number
  temperaturaMax: number
  temperaturaMedia: number
  humedadMedia: number
  lluviaTotal: number
  horasConLluvia: number
}

/** Resumen por ciudad, en el orden fijo de CIUDADES. Solo incluye ciudades con datos. */
export function estadisticasPorCiudad(filas: Medicion[]): EstadisticasCiudad[] {
  const acumulado = new Map<
    string,
    EstadisticasCiudad & { sumaT: number; sumaH: number }
  >()
  for (const f of filas) {
    let e = acumulado.get(f.ciudad)
    if (!e) {
      e = {
        ciudad: f.ciudad,
        registros: 0,
        temperaturaMin: Infinity,
        temperaturaMax: -Infinity,
        temperaturaMedia: 0,
        humedadMedia: 0,
        lluviaTotal: 0,
        horasConLluvia: 0,
        sumaT: 0,
        sumaH: 0,
      }
      acumulado.set(f.ciudad, e)
    }
    e.registros++
    e.temperaturaMin = Math.min(e.temperaturaMin, f.temperatura_c)
    e.temperaturaMax = Math.max(e.temperaturaMax, f.temperatura_c)
    e.sumaT += f.temperatura_c
    e.sumaH += f.humedad_pct
    e.lluviaTotal += f.precipitacion_mm
    if (f.precipitacion_mm > 0) e.horasConLluvia++
  }
  return CIUDADES.flatMap((c) => {
    const e = acumulado.get(c.nombre)
    if (!e) return []
    const { sumaT, sumaH, ...resto } = e
    return [
      {
        ...resto,
        temperaturaMedia: sumaT / e.registros,
        humedadMedia: sumaH / e.registros,
        // Evita arrastrar errores de coma flotante (0.1 + 0.2…) en la suma.
        lluviaTotal: Math.round(e.lluviaTotal * 100) / 100,
      },
    ]
  })
}
