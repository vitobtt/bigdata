/**
 * Fixtures SINTÉTICOS para pruebas. No proceden de Open-Meteo y nunca se
 * usan en la aplicación: solo sirven para forzar casos que los datos reales
 * rara vez contienen (nulos, duplicados, longitudes incoherentes...).
 */
import type { RespuestaOpenMeteo } from "@/lib/etl/tipos"

const unidades = {
  time: "iso8601",
  temperature_2m: "°C",
  relative_humidity_2m: "%",
  precipitation: "mm",
}

/** Nulos, cadenas vacías, valores fuera de rango y una temperatura extrema válida. */
export const CON_NULOS_Y_RANGOS: RespuestaOpenMeteo = {
  utc_offset_seconds: 0,
  hourly_units: unidades,
  hourly: {
    time: [
      "2026-09-01T00:00", // 0 válido
      "2026-09-01T01:00", // 1 temperatura null
      "2026-09-01T02:00", // 2 humedad cadena vacía
      "2026-09-01T03:00", // 3 precipitación null
      "2026-09-01T04:00", // 4 humedad 120 %
      "2026-09-01T05:00", // 5 precipitación negativa
      "2026-09-01T06:00", // 6 temperatura extrema (válida)
      "no-es-fecha", // 7 fecha inválida
      null, // 8 sin fecha
      "2026-09-01T09:00", // 9 temperatura como texto
    ],
    temperature_2m: [20.5, null, 21, 22, 23, 24, 55.3, 25, 26, "27"],
    relative_humidity_2m: [60, 61, "", 63, 120, 65, 10, 67, 68, 69],
    precipitation: [0, 0, 0, null, 0, -0.1, 0, 0, 0, 0],
  },
}

/** Horas repetidas: la 01:00 aparece dos veces con valores distintos. */
export const CON_DUPLICADOS: RespuestaOpenMeteo = {
  utc_offset_seconds: 0,
  hourly_units: unidades,
  hourly: {
    time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T01:00"],
    temperature_2m: [20, 21, 99],
    relative_humidity_2m: [50, 51, 52],
    precipitation: [0, 0.2, 0.4],
  },
}

/** Duplicado cuya primera aparición es inválida: debe conservarse la segunda (válida). */
export const DUPLICADO_PRIMERO_INVALIDO: RespuestaOpenMeteo = {
  utc_offset_seconds: 0,
  hourly_units: unidades,
  hourly: {
    time: ["2026-09-01T00:00", "2026-09-01T00:00"],
    temperature_2m: [null, 18],
    relative_humidity_2m: [50, 50],
    precipitation: [0, 0],
  },
}

/** Arrays de longitudes distintas. */
export const LONGITUDES_INCOHERENTES: RespuestaOpenMeteo = {
  utc_offset_seconds: 0,
  hourly_units: unidades,
  hourly: {
    time: ["2026-09-01T00:00", "2026-09-01T01:00", "2026-09-01T02:00"],
    temperature_2m: [20, 21, 22],
    relative_humidity_2m: [50, 51],
    precipitation: [0, 0, 0, 0],
  },
}

export const NO_UTC: RespuestaOpenMeteo = {
  utc_offset_seconds: 7200,
  hourly_units: unidades,
  hourly: {
    time: ["2026-09-01T00:00"],
    temperature_2m: [20],
    relative_humidity_2m: [50],
    precipitation: [0],
  },
}
