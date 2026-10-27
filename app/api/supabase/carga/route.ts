import { leerJsonLimitado, validarLoteCarga } from "@/lib/etl/peticiones"
import {
  TABLA_MEDICIONES,
  clienteServidor,
  comprobarEscrituraPermitida,
  errorSupabase,
  respuestaError,
} from "@/lib/supabase/servidor"

/**
 * Recibe un lote (≤ 500 registros), lo valida de nuevo y hace un upsert por
 * (ciudad, fecha_hora). Si un registro no es válido se rechaza el lote entero.
 */
export async function POST(request: Request) {
  try {
    comprobarEscrituraPermitida()
    const registros = validarLoteCarga(await leerJsonLimitado(request))
    const supabase = clienteServidor()
    const { error, count } = await supabase
      .from(TABLA_MEDICIONES)
      .upsert(registros, { onConflict: "ciudad,fecha_hora", count: "exact" })
    if (error) throw errorSupabase(error)
    // count = filas afectadas (insertadas + actualizadas); Postgres no las desglosa aquí.
    return Response.json({
      recibidos: registros.length,
      filasAfectadas: count ?? null,
    })
  } catch (e) {
    return respuestaError(e)
  }
}
