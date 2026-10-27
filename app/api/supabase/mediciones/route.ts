import type { NextRequest } from "next/server"

import { interpretarConsultaDestino } from "@/lib/etl/peticiones"
import {
  TABLA_MEDICIONES,
  clienteServidor,
  errorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

/** Lectura paginada de lo que realmente está persistido en Supabase. */
export async function GET(request: NextRequest) {
  try {
    const q = interpretarConsultaDestino(request.nextUrl.searchParams)
    const supabase = clienteServidor()
    let consulta = supabase
      .from(TABLA_MEDICIONES)
      .select(
        "id,ciudad,fecha_hora,temperatura_c,humedad_pct,precipitacion_mm,importado_en",
        { count: "exact" }
      )
    if (q.ciudades.length > 0) consulta = consulta.in("ciudad", q.ciudades)
    if (q.desde) consulta = consulta.gte("fecha_hora", q.desde)
    if (q.hasta) consulta = consulta.lte("fecha_hora", q.hasta)
    const desde = q.pagina * q.tamano
    const { data, error, count } = await consulta
      // Sin ORDER BY la base de datos no garantiza ningún orden.
      .order(q.orden, { ascending: q.ascendente })
      .order("id", { ascending: true })
      .range(desde, desde + q.tamano - 1)
    if (error) throw errorSupabase(error)
    return Response.json({ filas: data, total: count ?? null, ...q })
  } catch (e) {
    return respuestaError(e)
  }
}
