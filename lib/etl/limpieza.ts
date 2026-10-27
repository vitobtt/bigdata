import { motivosMedidas } from "./validacion"
import {
  claveMedicion,
  type FilaRechazada,
  type FilaTransformada,
  type FilaValida,
} from "./tipos"

export type ResultadoLimpieza = {
  validos: FilaValida[]
  rechazados: FilaRechazada[]
}

/**
 * Aplica las reglas de calidad y elimina duplicados.
 *
 * Duplicados: se compara la clave (ciudad, fecha_hora) solo entre registros
 * que ya han superado las reglas de calidad, para que un duplicado válido no
 * se pierda en favor de uno inválido. Se conserva la PRIMERA aparición en el
 * orden de llegada (orden de ciudades extraídas y, dentro de cada ciudad,
 * posición en el array); las siguientes se rechazan indicando cuál se conservó.
 */
export function limpiar(filas: FilaTransformada[]): ResultadoLimpieza {
  const validos: FilaValida[] = []
  const rechazados: FilaRechazada[] = []
  const vistos = new Map<string, string>() // clave → uid conservado

  for (const fila of filas) {
    const motivos = [...fila.avisos]
    if (typeof fila.ciudad !== "string" || fila.ciudad.trim() === "") {
      motivos.push("sin ciudad")
    }
    if (fila.fecha_hora === null) {
      motivos.push(
        fila.fecha_bruta === undefined || fila.fecha_bruta === null
          ? "sin fecha"
          : `fecha no válida (${String(fila.fecha_bruta)})`
      )
    }
    motivos.push(
      ...motivosMedidas({
        temperatura: fila.temperatura_bruta,
        humedad: fila.humedad_bruta,
        precipitacion: fila.precipitacion_bruta,
      })
    )
    if (motivos.length > 0) {
      rechazados.push({ fila, motivos })
      continue
    }

    const clave = claveMedicion(fila.ciudad, fila.fecha_hora!)
    const conservado = vistos.get(clave)
    if (conservado !== undefined) {
      rechazados.push({
        fila,
        motivos: [`duplicado de ${clave}; se conserva la primera aparición`],
        duplicadoDe: conservado,
      })
      continue
    }
    vistos.set(clave, fila.uid)
    validos.push({
      uid: fila.uid,
      clave,
      ciudad: fila.ciudad,
      fecha_hora: fila.fecha_hora!,
      temperatura_c: fila.temperatura_bruta as number,
      humedad_pct: fila.humedad_bruta as number,
      precipitacion_mm: fila.precipitacion_bruta as number,
    })
  }
  return { validos, rechazados }
}
