import { describe, expect, it } from "vitest"

import {
  clavesNoEncontradas,
  crearLotes,
  ejecutarCarga,
  resumirCarga,
  type FuncionesCarga,
} from "@/lib/etl/carga"
import {
  ErrorPeticion,
  MAX_BYTES_PETICION,
  interpretarConsultaDestino,
  leerJsonLimitado,
  validarClaves,
  validarLoteCarga,
} from "@/lib/etl/peticiones"
import type { Medicion } from "@/lib/etl/tipos"

function mediciones(n: number, ciudad = "Madrid"): Medicion[] {
  return Array.from({ length: n }, (_, i) => ({
    ciudad,
    fecha_hora: new Date(Date.UTC(2026, 8, 1) + i * 3_600_000).toISOString(),
    temperatura_c: 20 + (i % 10),
    humedad_pct: 50,
    precipitacion_mm: 0,
  }))
}

/**
 * Destino SIMULADO en memoria con semántica de upsert por (ciudad, fecha_hora).
 * Sirve para probar la lógica de lotes; no sustituye la prueba contra Supabase.
 */
function destinoSimulado(opciones: { fallarLlamadas?: number[] } = {}) {
  const filas = new Map<string, Medicion>()
  let llamadas = 0
  const enviados: Medicion[][] = []
  const funciones: Omit<FuncionesCarga, "alCambiar"> = {
    enviar: async (registros) => {
      llamadas++
      enviados.push(registros)
      if (opciones.fallarLlamadas?.includes(llamadas)) {
        return { ok: false, error: "HTTP 502: fallo simulado" }
      }
      for (const r of registros) {
        filas.set(`${r.ciudad}|${Date.parse(r.fecha_hora)}`, r)
      }
      return { ok: true, filasAfectadas: registros.length }
    },
    verificar: async (registros) => ({
      ok: true,
      clavesFaltantes: clavesNoEncontradas(registros, [...filas.values()]),
    }),
  }
  return { filas, funciones, enviados, llamadas: () => llamadas }
}

describe("Lotes de carga", () => {
  it("divide en lotes de 500 como máximo y copia los registros", () => {
    const datos = mediciones(1201)
    const lotes = crearLotes(datos)
    expect(lotes.map((l) => l.registros.length)).toEqual([500, 500, 201])
    datos[0].temperatura_c = -999
    expect(lotes[0].registros[0].temperatura_c).toBe(20)
    expect(() => crearLotes(datos, 501)).toThrow()
  })

  it("los lotes enviados son exactamente el conjunto congelado, en el mismo orden", async () => {
    const datos = mediciones(1100).reverse()
    const d = destinoSimulado()
    await ejecutarCarga(crearLotes(datos), {
      ...d.funciones,
      alCambiar: () => {},
    })
    expect(d.enviados.flat()).toEqual(datos)
  })
})

describe("8. Segunda carga sin duplicados (destino simulado)", () => {
  it("cargar dos veces el mismo conjunto deja el mismo número de filas", async () => {
    const datos = mediciones(720)
    const d = destinoSimulado()
    const opciones = { ...d.funciones, alCambiar: () => {} }
    await ejecutarCarga(crearLotes(datos), opciones)
    expect(d.filas.size).toBe(720)
    const segunda = await ejecutarCarga(crearLotes(datos), opciones)
    expect(d.filas.size).toBe(720)
    expect(resumirCarga(segunda).registrosConfirmados).toBe(720)
  })
})

describe("9. Fallo parcial de carga", () => {
  it("conserva los lotes correctos y reintenta solo los fallidos", async () => {
    const datos = mediciones(1300) // 3 lotes
    const d = destinoSimulado({ fallarLlamadas: [2] })
    const estados: string[][] = []
    const opciones = {
      ...d.funciones,
      alCambiar: (ls: { envio: string }[]) =>
        estados.push(ls.map((l) => l.envio)),
    }
    const tras1 = await ejecutarCarga(crearLotes(datos), opciones)
    expect(tras1.map((l) => l.envio)).toEqual([
      "completado",
      "error",
      "completado",
    ])
    expect(tras1[1].errorEnvio).toMatch(/fallo simulado/)
    expect(tras1.map((l) => l.verificacion)).toEqual([
      "confirmado",
      "pendiente",
      "confirmado",
    ])
    expect(resumirCarga(tras1)).toMatchObject({
      registrosEnviadosOk: 800,
      registrosFallidos: 500,
      registrosConfirmados: 800,
      lotesFallidos: 1,
    })
    // Los estados intermedios son reales: se ve el lote 2 "enviando".
    expect(estados).toContainEqual(["completado", "enviando", "pendiente"])

    const tras2 = await ejecutarCarga(tras1, opciones)
    expect(d.llamadas()).toBe(4) // 3 + solo el reintento del lote 2
    expect(d.enviados[3]).toEqual(datos.slice(500, 1000))
    expect(
      tras2.every(
        (l) => l.envio === "completado" && l.verificacion === "confirmado"
      )
    ).toBe(true)
    expect(d.filas.size).toBe(1300)
  })

  it("una excepción de red se registra como error del lote", async () => {
    const tras = await ejecutarCarga(crearLotes(mediciones(3)), {
      enviar: async () => {
        throw new TypeError("Failed to fetch")
      },
      verificar: async () => ({ ok: true, clavesFaltantes: [] }),
      alCambiar: () => {},
    })
    expect(tras[0]).toMatchObject({
      envio: "error",
      errorEnvio: "Failed to fetch",
    })
  })

  it("si faltan claves en destino, la verificación lo indica", async () => {
    const datos = mediciones(3)
    const tras = await ejecutarCarga(crearLotes(datos), {
      enviar: async () => ({ ok: true, filasAfectadas: null }),
      verificar: async (r) => ({
        ok: true,
        clavesFaltantes: clavesNoEncontradas(r, r.slice(1)),
      }),
      alCambiar: () => {},
    })
    expect(tras[0].verificacion).toBe("incompleto")
    expect(tras[0].clavesFaltantes).toEqual([`Madrid|${datos[0].fecha_hora}`])
    expect(resumirCarga(tras).filasAfectadas).toBeNull()
  })
})

describe("Verificación de claves", () => {
  it("compara instantes aunque Postgres devuelva +00:00", () => {
    const enviados = [
      { ciudad: "Madrid", fecha_hora: "2026-09-01T00:00:00.000Z" },
    ]
    const destino = [
      { ciudad: "Madrid", fecha_hora: "2026-09-01T00:00:00+00:00" },
    ]
    expect(clavesNoEncontradas(enviados, destino)).toEqual([])
    expect(
      clavesNoEncontradas(enviados, [{ ...destino[0], ciudad: "Bilbao" }])
    ).toHaveLength(1)
  })
})

describe("Validación en servidor", () => {
  const valido = mediciones(1)[0]

  it("acepta un lote correcto y normaliza la fecha", () => {
    expect(
      validarLoteCarga({
        registros: [{ ...valido, fecha_hora: "2026-09-01T00:00:00Z" }],
      })
    ).toEqual([{ ...valido, fecha_hora: "2026-09-01T00:00:00.000Z" }])
  })

  it.each([
    [{ ...valido, temperatura_c: null }, /temperatura nulo/],
    [{ ...valido, humedad_pct: "50" }, /humedad texto/],
    [{ ...valido, humedad_pct: 101 }, /fuera de rango/],
    [{ ...valido, precipitacion_mm: -1 }, /negativa/],
    [{ ...valido, ciudad: "Londres" }, /ciudad no reconocida/],
    [{ ...valido, fecha_hora: "2026-09-01T00:00" }, /fecha_hora no válida/],
    [{ ...valido, id: 5 }, /campos no permitidos: id/],
  ])("rechaza %o", (registro, motivo) => {
    try {
      validarLoteCarga({ registros: [registro] })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorPeticion)
      expect((e as ErrorPeticion).estado).toBe(422)
      expect((e as ErrorPeticion).detalles?.[0]).toMatch(motivo)
    }
  })

  it("rechaza claves duplicadas dentro del lote, lotes vacíos y > 500", () => {
    expect(() => validarLoteCarga({ registros: [valido, valido] })).toThrow(
      /no superan/
    )
    expect(() => validarLoteCarga({ registros: [] })).toThrow(/vacío/)
    expect(() => validarLoteCarga({ registros: mediciones(501) })).toThrow(
      /Como máximo 500/
    )
    expect(() => validarLoteCarga([valido])).toThrow(/objeto/)
  })

  it("limita el tamaño del cuerpo", async () => {
    const grande = new Request("http://x", {
      method: "POST",
      body: "x".repeat(MAX_BYTES_PETICION + 1),
    })
    await expect(leerJsonLimitado(grande)).rejects.toMatchObject({
      estado: 413,
    })
    const roto = new Request("http://x", { method: "POST", body: "{" })
    await expect(leerJsonLimitado(roto)).rejects.toMatchObject({ estado: 400 })
  })

  it("valida claves y parámetros de consulta", () => {
    expect(() =>
      validarClaves({ claves: [{ ciudad: "X", fecha_hora: "a" }] })
    ).toThrow()
    const q = interpretarConsultaDestino(
      new URLSearchParams(
        "ciudad=Madrid&ciudad=Bilbao&orden=temperatura_c&direccion=desc&tamano=50&pagina=2"
      )
    )
    expect(q).toMatchObject({
      ciudades: ["Madrid", "Bilbao"],
      orden: "temperatura_c",
      ascendente: false,
      tamano: 50,
      pagina: 2,
    })
    expect(() =>
      interpretarConsultaDestino(new URLSearchParams("orden=id;drop"))
    ).toThrow()
    expect(() =>
      interpretarConsultaDestino(new URLSearchParams("tamano=5000"))
    ).toThrow()
  })
})
