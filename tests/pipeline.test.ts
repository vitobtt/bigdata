import { describe, expect, it } from "vitest"

import barcelona from "./fixtures/barcelona-2026-09-01.json"
import {
  CON_DUPLICADOS,
  CON_NULOS_Y_RANGOS,
  DUPLICADO_PRIMERO_INVALIDO,
  LONGITUDES_INCOHERENTES,
  NO_UTC,
} from "./fixtures/sinteticos"
import {
  construirUrlArchivo,
  descargarCiudad,
  validarConfigExtraccion,
} from "@/lib/etl/extraccion"
import { CIUDADES } from "@/lib/etl/ciudades"
import {
  interpretarFechaUtc,
  transformarCiudad,
} from "@/lib/etl/transformacion"
import { limpiar } from "@/lib/etl/limpieza"
import {
  FILTROS_VACIOS,
  aMedicion,
  conjuntoACargar,
  contarSeleccion,
  filtrarYOrdenar,
  huellaConjunto,
  paginar,
} from "@/lib/etl/filtrado"
import type { FilaValida, RespuestaOpenMeteo } from "@/lib/etl/tipos"

const madrid = CIUDADES.find((c) => c.id === "madrid")!

describe("1. Extracción", () => {
  it("construye la URL con UTC, °C, mm y las tres variables", () => {
    const url = new URL(construirUrlArchivo(madrid, "2026-09-01", "2026-09-01"))
    expect(url.origin + url.pathname).toBe(
      "https://archive-api.open-meteo.com/v1/archive"
    )
    expect(url.searchParams.get("timezone")).toBe("UTC")
    expect(url.searchParams.get("temperature_unit")).toBe("celsius")
    expect(url.searchParams.get("precipitation_unit")).toBe("mm")
    expect(url.searchParams.get("hourly")).toBe(
      "temperature_2m,relative_humidity_2m,precipitation"
    )
    expect(url.searchParams.get("latitude")).toBe("40.4168")
    expect(url.searchParams.get("longitude")).toBe("-3.7038")
  })

  it("valida el periodo: máximo 31 días, orden, fechas reales y futuro", () => {
    const hoy = "2026-10-27"
    const ok = { ciudades: ["madrid"], inicio: "2026-09-01", fin: "2026-09-30" }
    expect(validarConfigExtraccion(ok, hoy)).toEqual([])
    expect(validarConfigExtraccion({ ...ok, fin: "2026-10-01" }, hoy)).toEqual(
      []
    )
    expect(
      validarConfigExtraccion({ ...ok, fin: "2026-10-02" }, hoy)[0]
    ).toMatch(/32 días/)
    expect(validarConfigExtraccion({ ...ok, ciudades: [] }, hoy)).toHaveLength(
      1
    )
    expect(
      validarConfigExtraccion(
        { ...ok, inicio: "2026-09-10", fin: "2026-09-01" },
        hoy
      )[0]
    ).toMatch(/posterior/)
    expect(
      validarConfigExtraccion(
        { ...ok, inicio: "2026-02-30", fin: "2026-03-01" },
        hoy
      )[0]
    ).toMatch(/inicial no es válida/)
    expect(
      validarConfigExtraccion(
        { ...ok, inicio: "2026-10-27", fin: "2026-10-28" },
        hoy
      )[0]
    ).toMatch(/hoy/)
  })

  it("una ciudad durante un día da 24 registros horarios en UTC (muestra real capturada)", () => {
    const { filas, problemas } = transformarCiudad("Barcelona", barcelona)
    expect(problemas).toEqual([])
    expect(filas).toHaveLength(24)
    expect(filas[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(filas[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
    const { validos, rechazados } = limpiar(filas)
    expect(validos).toHaveLength(24)
    expect(rechazados).toHaveLength(0)
  })

  it("convierte los errores HTTP de Open-Meteo en un resultado de error, sin lanzar", async () => {
    const fetchFalso = (async () =>
      new Response(
        JSON.stringify({ error: true, reason: "Fecha fuera de rango" }),
        {
          status: 400,
        }
      )) as unknown as typeof fetch
    const r = await descargarCiudad(
      madrid,
      "2026-09-01",
      "2026-09-01",
      fetchFalso
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/HTTP 400: Fecha fuera de rango/)

    const fetchCaido = (async () => {
      throw new TypeError("Failed to fetch")
    }) as unknown as typeof fetch
    const r2 = await descargarCiudad(
      madrid,
      "2026-09-01",
      "2026-09-01",
      fetchCaido
    )
    expect(r2.ok).toBe(false)
  })
})

describe("2. Transformación de arrays paralelos", () => {
  it("cada posición i combina time[i] con las tres variables[i]", () => {
    const { filas } = transformarCiudad("Barcelona", barcelona)
    const h = barcelona.hourly
    for (let i = 0; i < 24; i++) {
      expect(filas[i].temperatura_bruta).toBe(h.temperature_2m[i])
      expect(filas[i].humedad_bruta).toBe(h.relative_humidity_2m[i])
      expect(filas[i].precipitacion_bruta).toBe(h.precipitation[i])
      expect(filas[i].ciudad).toBe("Barcelona")
    }
  })

  it("interpreta las fechas como UTC explícito, independientemente de la zona local", () => {
    expect(interpretarFechaUtc("2026-09-01T00:00")).toBe(
      "2026-09-01T00:00:00.000Z"
    )
    expect(interpretarFechaUtc("2026-09-01T00:00Z")).toBe(
      "2026-09-01T00:00:00.000Z"
    )
    expect(interpretarFechaUtc("2026-09-31T00:00")).toBeNull()
    expect(interpretarFechaUtc("2026-09-01T00:00+02:00")).toBeNull()
    expect(interpretarFechaUtc("")).toBeNull()
    expect(interpretarFechaUtc(null)).toBeNull()
  })

  it("detecta longitudes incoherentes y marca las posiciones ausentes", () => {
    const { filas, problemas } = transformarCiudad(
      "Madrid",
      LONGITUDES_INCOHERENTES
    )
    expect(problemas.some((p) => /incoherentes/.test(p.mensaje))).toBe(true)
    expect(filas).toHaveLength(4)
    expect(filas[2].humedad_bruta).toBeUndefined()
    const { validos, rechazados } = limpiar(filas)
    expect(validos).toHaveLength(2)
    expect(rechazados.map((r) => r.fila.indice)).toEqual([2, 3])
    expect(rechazados[0].motivos).toContain(
      "posición ausente en relative_humidity_2m"
    )
    expect(rechazados[1].motivos).toContain("posición ausente en time")
  })

  it("rechaza todo si la respuesta no está en UTC", () => {
    const { filas, problemas } = transformarCiudad("Madrid", NO_UTC)
    expect(problemas[0].mensaje).toMatch(/utc_offset_seconds = 7200/)
    expect(limpiar(filas).validos).toHaveLength(0)
  })

  it("sin hourly.time no genera filas y lo informa", () => {
    const { filas, problemas } = transformarCiudad("Madrid", {
      hourly: {},
    } as RespuestaOpenMeteo)
    expect(filas).toHaveLength(0)
    expect(problemas).toHaveLength(1)
  })
})

describe("3. Nulos: nunca se convierten en cero", () => {
  const { filas } = transformarCiudad("Sevilla", CON_NULOS_Y_RANGOS)
  const { validos, rechazados } = limpiar(filas)
  const motivosDe = (i: number) =>
    rechazados.find((r) => r.fila.indice === i)?.motivos ?? []

  it("conserva null y cadena vacía tal cual en la transformación", () => {
    expect(filas[1].temperatura_bruta).toBeNull()
    expect(filas[2].humedad_bruta).toBe("")
    expect(filas[3].precipitacion_bruta).toBeNull()
  })

  it("rechaza con motivo explícito cada caso", () => {
    expect(motivosDe(1)).toEqual(["temperatura nulo"])
    expect(motivosDe(2)).toEqual(["humedad cadena vacía"])
    expect(motivosDe(3)).toEqual(["precipitación nulo"])
    expect(motivosDe(4)[0]).toMatch(/humedad fuera de rango/)
    expect(motivosDe(5)[0]).toMatch(/precipitación negativa/)
    expect(motivosDe(7)[0]).toMatch(/fecha no válida/)
    expect(motivosDe(8)).toEqual(["sin fecha"])
    expect(motivosDe(9)).toEqual(["temperatura texto «27»"])
  })

  it("no descarta temperaturas extremas", () => {
    expect(validos.map((v) => v.temperatura_c)).toEqual([20.5, 55.3])
    expect(validos.every((v) => v.precipitacion_mm === 0)).toBe(true)
    expect(validos).toHaveLength(2)
    expect(rechazados).toHaveLength(8)
  })
})

describe("4. Duplicados por (ciudad, fecha_hora)", () => {
  it("conserva la primera aparición y rechaza las siguientes con motivo", () => {
    const { validos, rechazados } = limpiar(
      transformarCiudad("Bilbao", CON_DUPLICADOS).filas
    )
    expect(validos).toHaveLength(2)
    expect(validos[1].temperatura_c).toBe(21)
    expect(rechazados).toHaveLength(1)
    expect(rechazados[0].fila.temperatura_bruta).toBe(99)
    expect(rechazados[0].duplicadoDe).toBe("Bilbao#1")
    expect(rechazados[0].motivos[0]).toMatch(
      /duplicado de Bilbao\|2026-09-01T01:00:00.000Z/
    )
  })

  it("si la primera aparición es inválida, se conserva la válida", () => {
    const { validos, rechazados } = limpiar(
      transformarCiudad("Bilbao", DUPLICADO_PRIMERO_INVALIDO).filas
    )
    expect(validos).toHaveLength(1)
    expect(validos[0].temperatura_c).toBe(18)
    expect(rechazados[0].duplicadoDe).toBeUndefined()
  })

  it("la misma hora en ciudades distintas no es un duplicado", () => {
    const filas = [
      ...transformarCiudad("Bilbao", barcelona).filas,
      ...transformarCiudad("Madrid", barcelona).filas,
    ]
    expect(limpiar(filas).validos).toHaveLength(48)
  })
})

/** 3 ciudades × 10 horas con valores deterministas. */
function validosDePrueba(): FilaValida[] {
  const filas: FilaValida[] = []
  for (const ciudad of ["Bilbao", "Madrid", "Sevilla"]) {
    for (let h = 0; h < 10; h++) {
      const fecha_hora = new Date(Date.UTC(2026, 8, 1, h)).toISOString()
      filas.push({
        uid: `${ciudad}#${h}`,
        clave: `${ciudad}|${fecha_hora}`,
        ciudad,
        fecha_hora,
        temperatura_c: (h * 7 + ciudad.length) % 30,
        humedad_pct: 40 + h,
        precipitacion_mm: h % 3 === 0 ? 0.5 * h : 0,
      })
    }
  }
  return filas
}

describe("5. Filtros y ordenación antes de paginar", () => {
  it("ordena el conjunto completo y luego pagina", () => {
    const validos = validosDePrueba()
    const ordenadas = filtrarYOrdenar(validos, FILTROS_VACIOS, {
      campo: "temperatura_c",
      direccion: "desc",
    })
    const maxGlobal = Math.max(...validos.map((v) => v.temperatura_c))
    // La primera fila de la página 1 es el máximo global, no el de los 10 primeros.
    expect(paginar(ordenadas, 0, 10)[0].temperatura_c).toBe(maxGlobal)
    const temps = ordenadas.map((o) => o.temperatura_c)
    expect(temps).toEqual([...temps].sort((a, b) => b - a))
  })

  it("aplica todos los filtros y el de lluvia como precipitación > 0", () => {
    const validos = validosDePrueba()
    const lluvia = filtrarYOrdenar(
      validos,
      { ...FILTROS_VACIOS, soloLluvia: true },
      { campo: "fecha_hora", direccion: "asc" }
    )
    // h = 3, 6, 9 por ciudad (h = 0 tiene 0 mm y queda fuera).
    expect(lluvia).toHaveLength(9)
    expect(lluvia.every((f) => f.precipitacion_mm > 0)).toBe(true)

    const combinado = filtrarYOrdenar(
      validos,
      {
        ...FILTROS_VACIOS,
        ciudades: ["Madrid"],
        desde: "2026-09-01T02:00:00.000Z",
        hasta: "2026-09-01T05:00:00.000Z",
        humedadMin: 43,
      },
      { campo: "fecha_hora", direccion: "desc" }
    )
    expect(combinado.map((f) => f.fecha_hora.slice(11, 13))).toEqual([
      "05",
      "04",
      "03",
    ])
  })
})

describe("6–7. Selección entre páginas y conjunto a cargar", () => {
  it("selecciona todas las filas filtradas aunque estén en otras páginas", () => {
    const validos = validosDePrueba()
    const filtros = { ...FILTROS_VACIOS, ciudades: ["Madrid", "Sevilla"] }
    const orden = { campo: "fecha_hora", direccion: "asc" } as const
    const ordenadas = filtrarYOrdenar(validos, filtros, orden)
    expect(paginar(ordenadas, 0, 5)).toHaveLength(5)
    const seleccion = new Set(ordenadas.map((f) => f.clave))
    expect(conjuntoACargar(ordenadas, seleccion)).toHaveLength(20)
  })

  it("al estrechar los filtros, las seleccionadas que quedan fuera no se suben y se cuentan", () => {
    const validos = validosDePrueba()
    const orden = { campo: "fecha_hora", direccion: "asc" } as const
    const seleccion = new Set(
      filtrarYOrdenar(validos, FILTROS_VACIOS, orden).map((f) => f.clave)
    )
    const ordenadas = filtrarYOrdenar(
      validos,
      { ...FILTROS_VACIOS, ciudades: ["Bilbao"] },
      orden
    )
    const aCargar = conjuntoACargar(ordenadas, seleccion)
    expect(aCargar).toHaveLength(10)
    expect(contarSeleccion(validos, aCargar, seleccion)).toEqual({
      seleccionados: 10,
      seleccionadosFueraDeFiltros: 20,
    })
  })

  it("al ampliar los filtros no se seleccionan filas nuevas automáticamente", () => {
    const validos = validosDePrueba()
    const orden = { campo: "fecha_hora", direccion: "asc" } as const
    const seleccion = new Set(
      filtrarYOrdenar(
        validos,
        { ...FILTROS_VACIOS, ciudades: ["Bilbao"] },
        orden
      ).map((f) => f.clave)
    )
    const todas = filtrarYOrdenar(validos, FILTROS_VACIOS, orden)
    expect(conjuntoACargar(todas, seleccion)).toHaveLength(10)
  })

  it("la vista previa y el envío tienen el mismo contenido y orden", () => {
    const validos = validosDePrueba()
    const orden = { campo: "temperatura_c", direccion: "desc" } as const
    const ordenadas = filtrarYOrdenar(validos, FILTROS_VACIOS, orden)
    const seleccion = new Set(
      ordenadas.filter((_, i) => i % 2 === 0).map((f) => f.clave)
    )
    const vistaPrevia = conjuntoACargar(ordenadas, seleccion)
    // El envío es la copia congelada en este mismo orden.
    const enviado = vistaPrevia.map(aMedicion)
    expect(enviado.map((e) => e.ciudad + e.fecha_hora)).toEqual(
      vistaPrevia.map((v) => v.ciudad + v.fecha_hora)
    )
    expect(huellaConjunto(enviado)).toBe(huellaConjunto(vistaPrevia))
    // La huella cambia si cambia el orden.
    expect(huellaConjunto([...enviado].reverse())).not.toBe(
      huellaConjunto(enviado)
    )
  })
})
