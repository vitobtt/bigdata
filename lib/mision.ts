/**
 * Estado de los cuatro pasos de Mission Path, calculado solo a partir del estado
 * real de la aplicación. No guarda nada propio: si los datos cambian, cambia el
 * recorrido.
 */
export type NodoId = "configurar" | "extraer" | "inspeccionar" | "guardar"

export type EstadoNodo =
  "pendiente" | "disponible" | "activo" | "completado" | "error"

/** `etiqueta` dice qué hace el paso; `nombre` es el nombre técnico de la etapa. */
export const NODOS: {
  id: NodoId
  numero: string
  nombre: string
  etiqueta: string
}[] = [
  { id: "configurar", numero: "01", nombre: "Configurar", etiqueta: "Elegir ciudades" },
  { id: "extraer", numero: "02", nombre: "Extraer", etiqueta: "Extraer datos" },
  { id: "inspeccionar", numero: "03", nombre: "Inspeccionar", etiqueta: "Revisar datos" },
  { id: "guardar", numero: "04", nombre: "Guardar", etiqueta: "Guardar en la nube" },
]

export const ESTADO_NODO_TEXTO: Record<EstadoNodo, string> = {
  pendiente: "No disponible todavía",
  disponible: "Disponible",
  activo: "Activo",
  completado: "Completado",
  error: "Con incidencias",
}

/** Lo mínimo que Mission Path necesita saber; `PipelineEtl` lo cumple. */
export type EntradaMision = {
  configValida: boolean
  hayErrorConfig: boolean
  extraccion: {
    enCurso: boolean
    descargas: Record<
      string,
      { estado: "pendiente" | "descargando" | "completada" | "error" }
    >
  } | null
  validos: number
  rechazados: number
  aCargar: number
  carga: {
    enCurso: boolean
    lotes: {
      envio: "pendiente" | "enviando" | "completado" | "error"
      verificacion:
        | "pendiente"
        | "verificando"
        | "confirmado"
        | "incompleto"
        | "error"
    }[]
  } | null
  /** Supabase accesible y con escritura permitida. */
  destinoListo: boolean
  /** Motivo por el que el destino no está listo (para mostrarlo), si lo hay. */
  motivoDestino: string | null
  lenteAbierta: boolean
}

export type Nodo = {
  id: NodoId
  numero: string
  nombre: string
  /** Expresión orientada a la acción que se muestra en el control. */
  etiqueta: string
  estado: EstadoNodo
  /** Qué falta para habilitar el paso (solo si está pendiente). */
  falta: string | null
  /** Frase corta que explica el estado, en español. */
  mensaje: string
}

type NodoBase = Omit<Nodo, "falta"> & { falta?: string }

export type Mision = {
  nodos: Nodo[]
  /** enlaces[i] une el nodo i con el i+1 y se ilumina cuando el nodo i está completado. */
  enlaces: boolean[]
}

export type EstadoCarga = "ninguna" | "en_curso" | "error" | "confirmada"

export function estadoCarga(carga: EntradaMision["carga"]): EstadoCarga {
  if (!carga) return "ninguna"
  if (carga.enCurso) return "en_curso"
  if (
    carga.lotes.some(
      (l) =>
        l.envio === "error" ||
        l.verificacion === "error" ||
        l.verificacion === "incompleto"
    )
  )
    return "error"
  if (
    carga.lotes.length > 0 &&
    carga.lotes.every(
      (l) => l.envio === "completado" && l.verificacion === "confirmado"
    )
  )
    return "confirmada"
  return "ninguna"
}

export function calcularMision(e: EntradaMision): Mision {
  const ext = e.extraccion
  const descargando = !!ext?.enCurso
  const hayErrorDescarga = !!(ext && Object.values(ext.descargas).some((d) => d.estado === "error"))
  const cargaEstado = estadoCarga(e.carga)

  // 01 · Configurar
  const configurar: NodoBase = {
    ...NODOS[0],
    estado: ext ? "completado" : e.hayErrorConfig ? "error" : "activo",
    mensaje: ext
      ? "Configuración aplicada en la última extracción."
      : e.hayErrorConfig
        ? "Revise las ciudades y las fechas."
        : e.configValida
          ? "Elija ciudades y fechas; la configuración es válida."
          : "Elija al menos una ciudad y un intervalo de fechas.",
  }

  // 02 · Extraer
  let extraer: NodoBase
  if (descargando) {
    extraer = {
      ...NODOS[1],
      estado: "activo",
      mensaje: "Descargando datos desde Open-Meteo.",
    }
  } else if (ext && hayErrorDescarga) {
    extraer = {
      ...NODOS[1],
      estado: "error",
      mensaje: "Alguna ciudad no se ha podido descargar.",
    }
  } else if (ext) {
    extraer = {
      ...NODOS[1],
      estado: "completado",
      mensaje: "Descarga completada.",
    }
  } else if (e.configValida) {
    extraer = {
      ...NODOS[1],
      estado: "disponible",
      mensaje: "La configuración es válida; puede extraer los datos.",
    }
  } else {
    extraer = {
      ...NODOS[1],
      estado: "pendiente",
      mensaje: "Configure primero ciudades y fechas.",
      falta: "Elige ciudades y fechas válidas",
    }
  }

  // 03 · Inspeccionar
  let inspeccionar: NodoBase
  if (!ext || descargando || e.validos + e.rechazados === 0) {
    inspeccionar = {
      ...NODOS[2],
      estado: ext && !descargando && hayErrorDescarga ? "error" : "pendiente",
      mensaje: !ext
        ? "Aún no hay registros que revisar."
        : descargando
          ? "Disponible cuando termine la descarga."
          : "No se ha descargado ningún registro.",
      falta: !ext
        ? "Primero extrae los datos"
        : descargando
          ? "Espera a que termine la descarga"
          : "No hay registros descargados",
    }
  } else if (e.validos === 0) {
    inspeccionar = {
      ...NODOS[2],
      estado: "error",
      mensaje: "Ningún registro ha superado la validación.",
    }
  } else if (e.aCargar > 0 || cargaEstado !== "ninguna") {
    inspeccionar = {
      ...NODOS[2],
      estado: "completado",
      mensaje: `${e.aCargar} registros seleccionados.`,
    }
  } else if (e.lenteAbierta) {
    inspeccionar = {
      ...NODOS[2],
      estado: "activo",
      mensaje: "Revisando registros.",
    }
  } else {
    inspeccionar = {
      ...NODOS[2],
      estado: "disponible",
      mensaje: "Los registros están preparados para su revisión.",
    }
  }

  // 04 · Guardar
  let guardar: NodoBase
  if (cargaEstado === "en_curso") {
    guardar = { ...NODOS[3], estado: "activo", mensaje: "Enviando a Supabase." }
  } else if (cargaEstado === "error") {
    guardar = {
      ...NODOS[3],
      estado: "error",
      mensaje: "Algún lote no se ha guardado o no se ha podido confirmar.",
    }
  } else if (cargaEstado === "confirmada") {
    guardar = {
      ...NODOS[3],
      estado: "completado",
      mensaje: "Los registros están guardados y confirmados.",
    }
  } else if (e.aCargar === 0) {
    guardar = {
      ...NODOS[3],
      estado: "pendiente",
      mensaje: "Seleccione registros para poder guardarlos.",
      falta: "Primero marca registros",
    }
  } else if (!e.destinoListo) {
    guardar = {
      ...NODOS[3],
      estado: "pendiente",
      mensaje: e.motivoDestino ?? "Supabase no está disponible.",
      falta: (e.motivoDestino ?? "Supabase no está disponible").replace(/\.$/, ""),
    }
  } else {
    guardar = {
      ...NODOS[3],
      estado: "disponible",
      mensaje: "La selección está lista para guardarse.",
    }
  }

  const nodos = [configurar, extraer, inspeccionar, guardar].map((n) => ({
    ...n,
    falta: n.falta ?? null,
  }))
  return {
    nodos,
    enlaces: nodos.slice(0, 3).map((n) => n.estado === "completado"),
  }
}

export type Sugerencia = {
  /** Cambia cuando cambia la situación; sirve para no volver a abrir un panel descartado. */
  clave: string
  nodo: NodoId
  mensaje: string
  accion: string
}

/**
 * Acción importante del momento, si la hay. El panel solo se expande por esto;
 * el resto del tiempo Mission Path permanece compacto.
 */
export function calcularSugerencia(
  m: Mision,
  e: Pick<EntradaMision, "lenteAbierta" | "carga"> & { ciclo: number }
): Sugerencia | null {
  const [, extraer, inspeccionar, guardar] = m.nodos
  if (guardar.estado === "error")
    return {
      clave: `guardar-error-${e.ciclo}`,
      nodo: "guardar",
      mensaje: "No se ha podido completar el guardado. Revise los lotes.",
      accion: "Ver detalles",
    }
  if (extraer.estado === "error")
    return {
      clave: `extraer-error-${e.ciclo}`,
      nodo: "extraer",
      mensaje: "Alguna ciudad no se ha podido descargar.",
      accion: "Ver detalles",
    }
  if (inspeccionar.estado === "disponible")
    return {
      clave: `inspeccionar-${e.ciclo}`,
      nodo: "inspeccionar",
      mensaje: "Los registros están preparados para su revisión.",
      accion: "Revisar datos",
    }
  if (inspeccionar.estado === "completado" && guardar.estado === "disponible")
    return {
      clave: `guardar-${e.ciclo}`,
      nodo: "guardar",
      mensaje: "La selección está lista. Compruebe el resumen antes de guardar.",
      accion: "Revisar y guardar",
    }
  return null
}

/** Texto corto bajo la etiqueta del paso: dice dónde está el usuario y qué puede hacer. */
export function subtituloNodo(n: Nodo, enOperacion: boolean): string {
  switch (n.estado) {
    case "pendiente":
      return n.falta ?? "No disponible"
    case "disponible":
      return "Siguiente paso"
    case "activo":
      return enOperacion ? "En curso…" : "Estás aquí"
    case "completado":
      return "Hecho · volver"
    case "error":
      return "Con incidencias · ver"
  }
}

/**
 * Paso que el usuario debería mirar ahora: el último que se puede pulsar o está
 * en marcha. Sirve para el resumen de la vista compacta.
 */
export function pasoSiguiente(m: Mision): Nodo | null {
  for (let i = m.nodos.length - 1; i >= 0; i--) {
    const e = m.nodos[i].estado
    if (e === "disponible" || e === "activo" || e === "error") return m.nodos[i]
  }
  return null
}
