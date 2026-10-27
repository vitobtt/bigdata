import { clavesNoEncontradas } from "@/lib/etl/carga"
import { leerJsonLimitado, validarClaves } from "@/lib/etl/peticiones"
import {
  TABLA_MEDICIONES,
  clienteServidor,
  errorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

const PAGINA = 1000

/**
 * Comprueba qué claves (ciudad, fecha_hora) de un lote existen en destino.
 * Por cada ciudad del lote se consulta el intervalo [mín, máx] de fechas, página
 * a página, y se compara en memoria. Así se evita enviar cientos de valores en la URL.
 */
export async function POST(request: Request) {
  try {
    const claves = validarClaves(await leerJsonLimitado(request))
    const supabase = clienteServidor()
    const porCiudad = new Map<string, string[]>()
    for (const c of claves) {
      porCiudad.set(c.ciudad, [
        ...(porCiudad.get(c.ciudad) ?? []),
        c.fecha_hora,
      ])
    }
    const encontrados: { ciudad: string; fecha_hora: string }[] = []
    for (const [ciudad, fechas] of porCiudad) {
      const ordenadas = [...fechas].sort()
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
          .from(TABLA_MEDICIONES)
          .select("ciudad,fecha_hora")
          .eq("ciudad", ciudad)
          .gte("fecha_hora", ordenadas[0])
          .lte("fecha_hora", ordenadas[ordenadas.length - 1])
          .order("fecha_hora", { ascending: true })
          .range(desde, desde + PAGINA - 1)
        if (error) throw errorSupabase(error)
        encontrados.push(...data)
        // Se para con una página vacía: no se asume el límite max-rows del proyecto.
        if (data.length === 0) break
      }
    }
    return Response.json({
      comprobadas: claves.length,
      clavesFaltantes: clavesNoEncontradas(claves, encontrados),
    })
  } catch (e) {
    return respuestaError(e)
  }
}
