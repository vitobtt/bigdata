import type { FilaValida, Medicion } from "./tipos"

export type Filtros = {
  /** Ciudades incluidas; vacío = todas. */
  ciudades: string[]
  /** ISO UTC inclusivo o null. */
  desde: string | null
  hasta: string | null
  temperaturaMin: number | null
  temperaturaMax: number | null
  humedadMin: number | null
  humedadMax: number | null
  precipitacionMin: number | null
  precipitacionMax: number | null
  /** precipitación > 0 */
  soloLluvia: boolean
}

export const FILTROS_VACIOS: Filtros = {
  ciudades: [],
  desde: null,
  hasta: null,
  temperaturaMin: null,
  temperaturaMax: null,
  humedadMin: null,
  humedadMax: null,
  precipitacionMin: null,
  precipitacionMax: null,
  soloLluvia: false,
}

export type CampoOrden =
  "ciudad" | "fecha_hora" | "temperatura_c" | "humedad_pct" | "precipitacion_mm"

export type Orden = { campo: CampoOrden; direccion: "asc" | "desc" }

export const ORDEN_POR_DEFECTO: Orden = {
  campo: "fecha_hora",
  direccion: "asc",
}

function dentro(valor: number, min: number | null, max: number | null) {
  return (min === null || valor >= min) && (max === null || valor <= max)
}

export function cumpleFiltros(fila: Medicion, f: Filtros): boolean {
  if (f.ciudades.length > 0 && !f.ciudades.includes(fila.ciudad)) return false
  // Las fechas son ISO UTC con el mismo formato, así que se comparan en milisegundos.
  const t = Date.parse(fila.fecha_hora)
  if (f.desde !== null && t < Date.parse(f.desde)) return false
  if (f.hasta !== null && t > Date.parse(f.hasta)) return false
  if (!dentro(fila.temperatura_c, f.temperaturaMin, f.temperaturaMax))
    return false
  if (!dentro(fila.humedad_pct, f.humedadMin, f.humedadMax)) return false
  if (!dentro(fila.precipitacion_mm, f.precipitacionMin, f.precipitacionMax))
    return false
  if (f.soloLluvia && !(fila.precipitacion_mm > 0)) return false
  return true
}

export function filtrar<T extends Medicion>(filas: T[], f: Filtros): T[] {
  return filas.filter((fila) => cumpleFiltros(fila, f))
}

function comparar(a: Medicion, b: Medicion, campo: CampoOrden): number {
  if (campo === "ciudad") return a.ciudad.localeCompare(b.ciudad, "es")
  if (campo === "fecha_hora")
    return Date.parse(a.fecha_hora) - Date.parse(b.fecha_hora)
  return a[campo] - b[campo]
}

/**
 * Ordena sin modificar el array de entrada. Los empates se resuelven siempre
 * por ciudad y fecha ascendentes para que el orden sea determinista.
 */
export function ordenar<T extends Medicion>(filas: T[], orden: Orden): T[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...filas].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

/**
 * válidos → filtros → ordenación. La paginación se aplica después y solo a la vista.
 */
export function filtrarYOrdenar<T extends Medicion>(
  filas: T[],
  f: Filtros,
  orden: Orden
): T[] {
  return ordenar(filtrar(filas, f), orden)
}

/**
 * Igual que filtrarYOrdenar, midiendo la duración real. El resultado (las filas)
 * es determinista; solo la duración, que es informativa, varía entre ejecuciones.
 */
export function filtrarYOrdenarMedido<T extends Medicion>(
  filas: T[],
  f: Filtros,
  orden: Orden
): { filas: T[]; duracionMs: number } {
  const t0 = performance.now()
  const resultado = filtrarYOrdenar(filas, f, orden)
  return { filas: resultado, duracionMs: performance.now() - t0 }
}

/**
 * Conjunto exacto a cargar: filas que cumplen los filtros actuales, en el orden
 * elegido, y que están seleccionadas. Una fila seleccionada que ya no cumple
 * los filtros NO se sube.
 */
export function conjuntoACargar(
  ordenadas: FilaValida[],
  seleccion: ReadonlySet<string>
): FilaValida[] {
  return ordenadas.filter((f) => seleccion.has(f.clave))
}

export type ContadoresSeleccion = {
  seleccionados: number
  seleccionadosFueraDeFiltros: number
}

export function contarSeleccion(
  validos: FilaValida[],
  aCargar: FilaValida[],
  seleccion: ReadonlySet<string>
): ContadoresSeleccion {
  let seleccionadosValidos = 0
  for (const f of validos) if (seleccion.has(f.clave)) seleccionadosValidos++
  return {
    seleccionados: aCargar.length,
    seleccionadosFueraDeFiltros: seleccionadosValidos - aCargar.length,
  }
}

export function paginar<T>(filas: T[], pagina: number, tamano: number): T[] {
  return filas.slice(pagina * tamano, pagina * tamano + tamano)
}

export function aMedicion(f: Medicion): Medicion {
  return {
    ciudad: f.ciudad,
    fecha_hora: f.fecha_hora,
    temperatura_c: f.temperatura_c,
    humedad_pct: f.humedad_pct,
    precipitacion_mm: f.precipitacion_mm,
  }
}

/** Huella FNV-1a (32 bits) del conjunto en orden, para comprobar que vista previa y envío coinciden. */
export function huellaConjunto(filas: Medicion[]): string {
  let h = 0x811c9dc5
  for (const f of filas) {
    const s = `${f.ciudad}|${f.fecha_hora}|${f.temperatura_c}|${f.humedad_pct}|${f.precipitacion_mm};`
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}
