import { describe, expect, it } from "vitest"

import { CIUDADES } from "@/lib/etl/ciudades"
import { descargarCiudad } from "@/lib/etl/extraccion"
import { limpiar } from "@/lib/etl/limpieza"
import { transformarCiudad } from "@/lib/etl/transformacion"

// Llama a la API real. Se activa con: npm run test:red (o ETL_TEST_RED=1)
describe.skipIf(
  import.meta.env.MODE !== "integracion" && !process.env.ETL_TEST_RED
)("Integración real con Open-Meteo", () => {
  it("Madrid, 1 de septiembre de 2026: 24 registros horarios en UTC", async () => {
    const madrid = CIUDADES.find((c) => c.id === "madrid")!
    const r = await descargarCiudad(madrid, "2026-09-01", "2026-09-01")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.json.utc_offset_seconds).toBe(0)
    expect(r.json.hourly_units).toMatchObject({
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      precipitation: "mm",
    })
    const { filas, problemas } = transformarCiudad(madrid.nombre, r.json)
    expect(problemas).toEqual([])
    expect(filas).toHaveLength(24)
    const { validos } = limpiar(filas)
    expect(validos.map((v) => v.fecha_hora.slice(11, 13))).toEqual(
      Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))
    )
    expect(validos.every((v) => v.fecha_hora.startsWith("2026-09-01T"))).toBe(
      true
    )
  })

  it("una fecha futura devuelve un error legible", async () => {
    const r = await descargarCiudad(CIUDADES[0], "2030-01-01", "2030-01-01")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/HTTP 400/)
  })
})
