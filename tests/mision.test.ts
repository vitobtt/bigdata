import { describe, expect, it } from "vitest"

import {
  pasoSiguiente,
  subtituloNodo,
  calcularMision,
  calcularSugerencia,
  estadoCarga,
  type EntradaMision,
} from "@/lib/mision"

const base: EntradaMision = {
  configValida: true,
  hayErrorConfig: false,
  extraccion: null,
  validos: 0,
  rechazados: 0,
  aCargar: 0,
  carga: null,
  destinoListo: true,
  motivoDestino: null,
  lenteAbierta: false,
}

const descarga = (estado: "completada" | "error" | "descargando" | "pendiente") => ({
  estado,
})
const estados = (e: Partial<EntradaMision>) =>
  calcularMision({ ...base, ...e }).nodos.map((n) => n.estado)

const extraida = {
  validos: 100,
  rechazados: 2,
  extraccion: { enCurso: false, descargas: { a: descarga("completada") } },
}

describe("Mission Path · estados", () => {
  it("al empezar: configurar activo, extraer disponible, el resto pendiente", () => {
    expect(estados({})).toEqual(["activo", "disponible", "pendiente", "pendiente"])
  })

  it("con configuración inválida la extracción no está disponible", () => {
    expect(estados({ configValida: false })[1]).toBe("pendiente")
    expect(estados({ configValida: false, hayErrorConfig: true })[0]).toBe("error")
  })

  it("durante la descarga, extraer está activo y inspeccionar sigue pendiente", () => {
    expect(
      estados({
        extraccion: { enCurso: true, descargas: { a: descarga("descargando") } },
      })
    ).toEqual(["completado", "activo", "pendiente", "pendiente"])
  })

  it("tras una descarga correcta, inspeccionar queda disponible y el tramo 2→3 se ilumina", () => {
    const m = calcularMision({ ...base, ...extraida })
    expect(m.nodos.map((n) => n.estado)).toEqual([
      "completado",
      "completado",
      "disponible",
      "pendiente",
    ])
    expect(m.enlaces).toEqual([true, true, false])
  })

  it("una ciudad con error marca extraer como error, pero se puede inspeccionar lo descargado", () => {
    const e = estados({
      ...extraida,
      extraccion: {
        enCurso: false,
        descargas: { a: descarga("completada"), b: descarga("error") },
      },
    })
    expect(e[1]).toBe("error")
    expect(e[2]).toBe("disponible")
  })

  it("si ningún registro es válido, inspeccionar es un error", () => {
    expect(estados({ ...extraida, validos: 0, rechazados: 5 })[2]).toBe("error")
  })

  it("la lente abierta hace activo a inspeccionar", () => {
    expect(estados({ ...extraida, lenteAbierta: true })[2]).toBe("activo")
  })

  it("con selección, inspeccionar se completa y guardar queda disponible", () => {
    expect(estados({ ...extraida, aCargar: 50 })).toEqual([
      "completado",
      "completado",
      "completado",
      "disponible",
    ])
  })

  it("con la selección lista pero Supabase no disponible, guardar queda pendiente con el motivo", () => {
    const m = calcularMision({
      ...base,
      ...extraida,
      aCargar: 50,
      destinoListo: false,
      motivoDestino: "Supabase no está configurado.",
    })
    expect(m.nodos[3].estado).toBe("pendiente")
    expect(m.nodos[3].mensaje).toBe("Supabase no está configurado.")
  })

  it("estados de carga: en curso, fallo, confirmada", () => {
    const lote = (
      envio: "pendiente" | "enviando" | "completado" | "error",
      verificacion: "pendiente" | "verificando" | "confirmado" | "incompleto" | "error"
    ) => ({ envio, verificacion })
    const con = (carga: EntradaMision["carga"]) =>
      calcularMision({ ...base, ...extraida, aCargar: 50, carga }).nodos[3].estado

    expect(con({ enCurso: true, lotes: [lote("enviando", "pendiente")] })).toBe("activo")
    expect(con({ enCurso: false, lotes: [lote("error", "pendiente")] })).toBe("error")
    expect(con({ enCurso: false, lotes: [lote("completado", "incompleto")] })).toBe("error")
    // Enviado pero sin verificar todavía no cuenta como guardado.
    expect(con({ enCurso: false, lotes: [lote("completado", "pendiente")] })).not.toBe(
      "completado"
    )
    expect(
      con({
        enCurso: false,
        lotes: [lote("completado", "confirmado"), lote("completado", "confirmado")],
      })
    ).toBe("completado")
  })

  it("estadoCarga solo da «confirmada» con envío y verificación confirmados", () => {
    expect(estadoCarga(null)).toBe("ninguna")
    expect(estadoCarga({ enCurso: false, lotes: [] })).toBe("ninguna")
    expect(
      estadoCarga({
        enCurso: false,
        lotes: [{ envio: "completado", verificacion: "confirmado" }],
      })
    ).toBe("confirmada")
  })

  it("re-extraer (carga anterior descartada) devuelve el recorrido a su sitio", () => {
    // El hook pone carga a null al extraer de nuevo.
    expect(
      estados({
        extraccion: { enCurso: true, descargas: { a: descarga("pendiente") } },
        carga: null,
      })
    ).toEqual(["completado", "activo", "pendiente", "pendiente"])
  })
})

describe("Mission Path · sugerencias", () => {
  const sug = (e: Partial<EntradaMision>, ciclo = 1) => {
    const entrada = { ...base, ...e }
    return calcularSugerencia(calcularMision(entrada), { ...entrada, ciclo })
  }

  it("no hay sugerencia mientras no hay nada importante que hacer", () => {
    expect(sug({})).toBeNull()
    expect(
      sug({ extraccion: { enCurso: true, descargas: { a: descarga("descargando") } } })
    ).toBeNull()
  })

  it("al terminar la descarga sugiere inspeccionar", () => {
    expect(sug(extraida)?.nodo).toBe("inspeccionar")
  })

  it("con la selección lista sugiere guardar", () => {
    expect(sug({ ...extraida, aCargar: 10 })?.nodo).toBe("guardar")
  })

  it("un fallo de guardado tiene prioridad", () => {
    const s = sug({
      ...extraida,
      aCargar: 10,
      carga: { enCurso: false, lotes: [{ envio: "error", verificacion: "pendiente" }] },
    })
    expect(s?.nodo).toBe("guardar")
    expect(s?.clave).toMatch(/error/)
  })

  it("la clave cambia con cada extracción", () => {
    expect(sug(extraida, 1)?.clave).not.toBe(sug(extraida, 2)?.clave)
  })
})

describe("Mission Path · etiquetas y explicaciones", () => {
  it("usa etiquetas orientadas a la acción y conserva la numeración", () => {
    const m = calcularMision(base)
    expect(m.nodos.map((n) => `${n.numero} ${n.etiqueta}`)).toEqual([
      "01 Elegir ciudades",
      "02 Extraer datos",
      "03 Revisar datos",
      "04 Guardar en la nube",
    ])
  })

  it("todo paso pendiente explica qué falta", () => {
    const m = calcularMision(base)
    for (const n of m.nodos.filter((n) => n.estado === "pendiente"))
      expect(n.falta, n.etiqueta).toBeTruthy()
    expect(m.nodos[2].falta).toBe("Primero extrae los datos")
    expect(m.nodos[3].falta).toBe("Primero marca registros")
  })

  it("el motivo de Supabase se muestra como explicación del paso de guardar", () => {
    const m = calcularMision({
      ...base,
      ...extraida,
      aCargar: 5,
      destinoListo: false,
      motivoDestino: "Supabase no está configurado.",
    })
    expect(m.nodos[3].falta).toBe("Supabase no está configurado")
  })

  it("el subtítulo distingue cada estado con un texto propio", () => {
    const m = calcularMision({ ...base, ...extraida })
    const textos = m.nodos.map((n) => subtituloNodo(n, false))
    expect(textos).toEqual([
      "Hecho · volver",
      "Hecho · volver",
      "Siguiente paso",
      "Primero marca registros",
    ])
    expect(subtituloNodo(m.nodos[0], false)).not.toBe(subtituloNodo(m.nodos[2], false))
  })

  it("pasoSiguiente apunta al último paso accionable", () => {
    expect(pasoSiguiente(calcularMision(base))?.id).toBe("extraer")
    expect(pasoSiguiente(calcularMision({ ...base, ...extraida }))?.id).toBe("inspeccionar")
    expect(
      pasoSiguiente(calcularMision({ ...base, ...extraida, aCargar: 3 }))?.id
    ).toBe("guardar")
  })
})
