/**
 * Mensajes del asistente. Son deterministas: cada uno está asociado a un evento
 * real de la aplicación y no hay ningún modelo generando texto.
 */
export type EventoAsistente =
  | "activado"
  | "configurar"
  | "extraccion_iniciada"
  | "extraccion_completada"
  | "extraccion_error"
  | "extraccion_sin_validos"
  | "inspeccion_abierta"
  | "seleccion_lista"
  | "carga_iniciada"
  | "carga_completada"
  | "carga_error"

export const MENSAJES: Record<EventoAsistente, string> = {
  activado:
    "Sistema NIMBUS activado. Estoy preparado para asistirle durante el análisis meteorológico.",
  configurar:
    "Seleccione las ciudades y el intervalo de fechas que desea analizar.",
  extraccion_iniciada: "Iniciando la extracción de datos meteorológicos.",
  extraccion_completada:
    "Extracción completada. Los registros están preparados para su inspección.",
  extraccion_error:
    "La extracción no se ha completado del todo. Revise las ciudades con error antes de continuar.",
  extraccion_sin_validos:
    "La extracción ha terminado, pero ningún registro ha superado la validación. Revise los detalles.",
  inspeccion_abierta:
    "Puede revisar los registros, aplicar filtros y seleccionar la información que desea conservar.",
  seleccion_lista:
    "La selección está lista. Puede comprobar el resumen antes de guardarla.",
  carga_iniciada: "Enviando registros a Supabase.",
  carga_completada:
    "Operación completada. Los registros se han almacenado correctamente.",
  carga_error:
    "No ha sido posible completar la operación. Revise los detalles antes de continuar.",
}

/** Aviso cuando el navegador no tiene ninguna voz en español. */
export const AVISO_SIN_VOZ_ESPANOLA =
  "Este navegador no incluye ninguna voz en español. Puede usar la voz predeterminada del sistema, que puede sonar con otro acento, o continuar sin audio."

export const AVISO_OTRA_REGION =
  "No hay una voz de España instalada; se usa una voz en español de otra región."

export const AVISO_BLOQUEADO =
  "El navegador ha bloqueado la reproducción de audio. Pulse «Repetir» para volver a intentarlo."
