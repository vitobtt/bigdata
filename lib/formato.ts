const numero = new Intl.NumberFormat("es-ES")

export function formatoEntero(n: number): string {
  return numero.format(n)
}

export function formatoDecimal(n: number, decimales = 1): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/** "2026-09-01T05:00:00.000Z" → "2026-09-01 05:00" (siempre UTC, sin conversión local). */
export function formatoFechaUtc(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ")
}

export function formatoDuracion(ms: number | undefined | null): string {
  if (ms == null) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${formatoDecimal(ms / 1000, 2)} s`
}

/** Representación literal de un valor bruto del JSON (null, "", ausente…). */
export function formatoBruto(valor: unknown): string {
  if (valor === undefined) return "(ausente)"
  if (valor === null) return "null"
  if (typeof valor === "string") return JSON.stringify(valor)
  return String(valor)
}

export function hoyUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Ofrece un archivo para descargar desde el navegador. */
export function descargarJson(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
