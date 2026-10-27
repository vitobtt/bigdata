import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { ErrorPeticion } from "@/lib/etl/peticiones"

export const TABLA_MEDICIONES = "mediciones_meteorologicas"

/**
 * Lee la configuración del servidor. La clave secreta salta RLS, por eso solo
 * existe en variables SIN prefijo NEXT_PUBLIC_ y este módulo importa
 * "server-only": si un componente de cliente lo importase, el build fallaría.
 */
function leerConfiguracion() {
  const url = process.env.SUPABASE_URL?.trim()
  // SUPABASE_SERVICE_ROLE_KEY se admite para proyectos con claves heredadas (JWT).
  const clave =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !clave) return null
  return { url, clave }
}

export function supabaseConfigurado(): boolean {
  return leerConfiguracion() !== null
}

/** Dominio del proyecto (p. ej. abcd.supabase.co). La URL no es secreta; la clave sí. */
export function dominioProyecto(): string | null {
  const config = leerConfiguracion()
  if (!config) return null
  try {
    return new URL(config.url).hostname
  } catch {
    return null
  }
}

let cliente: { url: string; clave: string; sb: SupabaseClient } | null = null

/** Detecta los errores de configuración habituales sin revelar la clave. */
function validarConfiguracion({ url, clave }: { url: string; clave: string }) {
  let valida = false
  try {
    valida = new URL(url).protocol === "https:"
  } catch {}
  if (!valida) {
    throw new ErrorPeticion(
      "SUPABASE_URL no es una URL válida. Debe ser https://<referencia-del-proyecto>.supabase.co (¿has pegado una clave en su lugar?).",
      503
    )
  }
  if (clave.startsWith("sb_publishable_")) {
    throw new ErrorPeticion(
      "SUPABASE_SECRET_KEY contiene la clave publicable (sb_publishable_…). Usa la clave secreta (sb_secret_…).",
      503
    )
  }
}

export function clienteServidor(): SupabaseClient {
  const config = leerConfiguracion()
  if (!config) {
    throw new ErrorPeticion(
      "Supabase no está configurado: faltan SUPABASE_URL y SUPABASE_SECRET_KEY (en .env.local en local, o en Environment Variables si está desplegada en Vercel).",
      503
    )
  }
  validarConfiguracion(config)
  // Se recrea el cliente si cambian las variables de entorno.
  if (cliente?.url !== config.url || cliente.clave !== config.clave) {
    cliente = {
      ...config,
      sb: createClient(config.url, config.clave, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    }
  }
  return cliente.sb
}

/**
 * La aplicación no tiene autenticación. Las escrituras quedan habilitadas en
 * desarrollo y se bloquean en producción salvo que se active explícitamente
 * ETL_PERMITIR_ESCRITURA=true (lo cual solo debe hacerse tras proteger los
 * endpoints con autenticación).
 */
export function comprobarEscrituraPermitida() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ETL_PERMITIR_ESCRITURA !== "true"
  ) {
    throw new ErrorPeticion(
      "La escritura está deshabilitada en producción: la aplicación no tiene autenticación. Consulta el README.",
      403
    )
  }
}

/** Respuesta de error uniforme. Nunca incluye credenciales. */
export function respuestaError(e: unknown): Response {
  if (e instanceof ErrorPeticion) {
    return Response.json(
      { error: e.message, detalles: e.detalles },
      { status: e.estado }
    )
  }
  console.error("[api/supabase] error inesperado:", (e as Error)?.message)
  return Response.json(
    { error: "Error interno del servidor." },
    { status: 500 }
  )
}

/** Convierte un error de PostgREST en un mensaje útil para el alumnado. */
export function errorSupabase(error: {
  message: string
  code?: string
  hint?: string | null
}): ErrorPeticion {
  let mensaje = `Supabase: ${error.message}`
  if (error.code === "42P01" || error.code === "PGRST205") {
    mensaje = `La tabla ${TABLA_MEDICIONES} no existe. Ejecuta la migración de supabase/migrations.`
  } else if (error.code === "42501") {
    mensaje = `Permiso denegado sobre ${TABLA_MEDICIONES}. Revisa los GRANT de la migración y que usas la clave secreta.`
  }
  return new ErrorPeticion(mensaje, 502, error.hint ? [error.hint] : undefined)
}
