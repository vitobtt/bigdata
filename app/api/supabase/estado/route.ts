import {
  TABLA_MEDICIONES,
  clienteServidor,
  dominioProyecto,
  errorSupabase,
  respuestaError,
  supabaseConfigurado,
} from "@/lib/supabase/servidor"

/** Indica si hay credenciales y si la tabla es accesible. Nunca devuelve las credenciales. */
export async function GET() {
  if (!supabaseConfigurado()) {
    return Response.json({
      configurado: false,
      conectado: false,
      mensaje: "Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local.",
    })
  }
  try {
    const { error, count } = await clienteServidor()
      .from(TABLA_MEDICIONES)
      .select("id", { count: "exact", head: true })
    if (error) throw errorSupabase(error)
    return Response.json({
      configurado: true,
      conectado: true,
      proyecto: dominioProyecto(),
      totalRegistros: count ?? null,
      escrituraPermitida:
        process.env.NODE_ENV !== "production" ||
        process.env.ETL_PERMITIR_ESCRITURA === "true",
    })
  } catch (e) {
    const r = respuestaError(e)
    const cuerpo = (await r.json()) as { error: string }
    return Response.json({
      configurado: true,
      conectado: false,
      proyecto: dominioProyecto(),
      mensaje: cuerpo.error,
    })
  }
}
