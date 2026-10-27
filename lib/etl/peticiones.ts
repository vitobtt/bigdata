/**
 * Validación de las peticiones que llegan a los endpoints de Supabase.
 * Sin dependencias de servidor para poder probarla de forma aislada.
 */
import { TAMANO_LOTE } from "./carga"
import { NOMBRES_CIUDADES } from "./ciudades"
import { claveMedicion, type Medicion } from "./tipos"
import { describirValor, validarMedicionEntrante } from "./validacion"

/** 500 registros ocupan unos 70 KB en JSON; se deja margen sin aceptar cuerpos arbitrarios. */
export const MAX_BYTES_PETICION = 256 * 1024

export class ErrorPeticion extends Error {
  constructor(
    message: string,
    public estado: number,
    public detalles?: string[]
  ) {
    super(message)
  }
}

export async function leerJsonLimitado(
  request: Request,
  maxBytes = MAX_BYTES_PETICION
): Promise<unknown> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > maxBytes) {
    throw new ErrorPeticion(
      `La petición supera el máximo de ${maxBytes} bytes.`,
      413
    )
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > maxBytes) {
    throw new ErrorPeticion(
      `La petición supera el máximo de ${maxBytes} bytes.`,
      413
    )
  }
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErrorPeticion("El cuerpo no es JSON válido.", 400)
  }
}

function arrayDe(cuerpo: unknown, campo: string): unknown[] {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw new ErrorPeticion(`Se esperaba un objeto con «${campo}».`, 400)
  }
  const arr = (cuerpo as Record<string, unknown>)[campo]
  if (!Array.isArray(arr)) {
    throw new ErrorPeticion(`«${campo}» debe ser un array.`, 400)
  }
  if (arr.length === 0) {
    throw new ErrorPeticion(`«${campo}» está vacío.`, 400)
  }
  if (arr.length > TAMANO_LOTE) {
    throw new ErrorPeticion(
      `Como máximo ${TAMANO_LOTE} elementos por petición (recibidos ${arr.length}).`,
      413
    )
  }
  return arr
}

const MAX_DETALLES = 20

/** Valida un lote de carga. Rechaza el lote entero si un registro no es válido. */
export function validarLoteCarga(cuerpo: unknown): Medicion[] {
  const registros = arrayDe(cuerpo, "registros")
  const detalles: string[] = []
  const validos: Medicion[] = []
  const claves = new Set<string>()
  registros.forEach((r, i) => {
    const v = validarMedicionEntrante(r)
    if (!v.ok) {
      detalles.push(`registro ${i}: ${v.motivos.join("; ")}`)
      return
    }
    const clave = claveMedicion(v.medicion.ciudad, v.medicion.fecha_hora)
    // Postgres no permite que un mismo upsert afecte dos veces a la misma fila.
    if (claves.has(clave)) {
      detalles.push(`registro ${i}: clave duplicada en el lote (${clave})`)
      return
    }
    claves.add(clave)
    validos.push(v.medicion)
  })
  if (detalles.length > 0) {
    throw new ErrorPeticion(
      `${detalles.length} registro(s) no superan la validación del servidor.`,
      422,
      detalles.slice(0, MAX_DETALLES)
    )
  }
  return validos
}

export type ClaveMedicion = Pick<Medicion, "ciudad" | "fecha_hora">

/** Valida las claves que se quieren comprobar en destino. */
export function validarClaves(cuerpo: unknown): ClaveMedicion[] {
  const claves = arrayDe(cuerpo, "claves")
  const detalles: string[] = []
  const resultado: ClaveMedicion[] = []
  claves.forEach((c, i) => {
    const obj = (c ?? {}) as Record<string, unknown>
    const ciudad = obj.ciudad
    const fecha = obj.fecha_hora
    if (typeof ciudad !== "string" || !NOMBRES_CIUDADES.includes(ciudad)) {
      detalles.push(
        `clave ${i}: ciudad no reconocida (${describirValor(ciudad)})`
      )
      return
    }
    if (typeof fecha !== "string" || Number.isNaN(Date.parse(fecha))) {
      detalles.push(
        `clave ${i}: fecha_hora no válida (${describirValor(fecha)})`
      )
      return
    }
    resultado.push({
      ciudad,
      fecha_hora: new Date(Date.parse(fecha)).toISOString(),
    })
  })
  if (detalles.length > 0) {
    throw new ErrorPeticion(
      "Claves no válidas.",
      422,
      detalles.slice(0, MAX_DETALLES)
    )
  }
  return resultado
}

export const CAMPOS_ORDEN_DESTINO = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
] as const
export type CampoOrdenDestino = (typeof CAMPOS_ORDEN_DESTINO)[number]
export const TAMANOS_PAGINA = [10, 25, 50, 100] as const

export type ConsultaDestino = {
  ciudades: string[]
  desde: string | null
  hasta: string | null
  orden: CampoOrdenDestino
  ascendente: boolean
  pagina: number
  tamano: number
}

/** Interpreta los parámetros de lectura de «Datos en Supabase». */
export function interpretarConsultaDestino(
  params: URLSearchParams
): ConsultaDestino {
  const ciudades = params.getAll("ciudad").filter(Boolean)
  for (const c of ciudades) {
    if (!NOMBRES_CIUDADES.includes(c)) {
      throw new ErrorPeticion(`Ciudad no reconocida: ${c}`, 400)
    }
  }
  const fecha = (nombre: string) => {
    const v = params.get(nombre)
    if (!v) return null
    const ms = Date.parse(v)
    if (Number.isNaN(ms))
      throw new ErrorPeticion(`«${nombre}» no es una fecha válida.`, 400)
    return new Date(ms).toISOString()
  }
  const orden = (params.get("orden") ?? "fecha_hora") as CampoOrdenDestino
  if (!CAMPOS_ORDEN_DESTINO.includes(orden)) {
    throw new ErrorPeticion(`No se puede ordenar por «${orden}».`, 400)
  }
  const pagina = Number(params.get("pagina") ?? "0")
  if (!Number.isInteger(pagina) || pagina < 0 || pagina > 100_000) {
    throw new ErrorPeticion("«pagina» debe ser un entero ≥ 0.", 400)
  }
  const tamano = Number(params.get("tamano") ?? "25")
  if (!(TAMANOS_PAGINA as readonly number[]).includes(tamano)) {
    throw new ErrorPeticion(
      `«tamano» debe ser uno de ${TAMANOS_PAGINA.join(", ")}.`,
      400
    )
  }
  return {
    ciudades,
    desde: fecha("desde"),
    hasta: fecha("hasta"),
    orden,
    ascendente: params.get("direccion") !== "desc",
    pagina,
    tamano,
  }
}
