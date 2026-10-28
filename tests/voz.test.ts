import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { elegirVoz, crearServicioVoz } from "@/lib/voz/servicio-voz"
import { AVISO_SIN_VOZ_ESPANOLA } from "@/lib/voz/mensajes"

const voz = (name: string, lang: string, localService = true) => ({
  name,
  lang,
  localService,
  default: false,
})

describe("elegirVoz", () => {
  it("no devuelve nada si no hay voces en español", () => {
    expect(elegirVoz([voz("Alex", "en-US"), voz("Thomas", "fr-FR")])).toBeNull()
  })

  it("prefiere España sobre otras regiones", () => {
    const r = elegirVoz([voz("Juan", "es-MX"), voz("Monica", "es-ES")])
    expect(r?.lang).toBe("es-ES")
  })

  it("prefiere una voz natural masculina de España", () => {
    const r = elegirVoz([
      voz("Microsoft Helena - Spanish (Spain)", "es-ES"),
      voz("Microsoft Alvaro Online (Natural) - Spanish (Spain)", "es-ES", false),
      voz("Google español", "es-ES", false),
    ])
    expect(r?.name).toMatch(/Alvaro/)
  })

  it("acepta otra región si es lo único que hay y entiende es_ES con guion bajo", () => {
    expect(elegirVoz([voz("Diego", "es-AR")])?.name).toBe("Diego")
    expect(elegirVoz([voz("Jorge", "es_ES")])?.name).toBe("Jorge")
  })
})

class Utterance {
  voice: unknown = null
  lang = ""
  rate = 1
  pitch = 1
  volume = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  constructor(public text: string) {}
}

function motorFalso(voces: ReturnType<typeof voz>[]) {
  const dichos: Utterance[] = []
  const oyentes = new Map<string, () => void>()
  const motor = {
    getVoices: vi.fn(() => voces),
    speak: vi.fn((u: Utterance) => dichos.push(u)),
    cancel: vi.fn(),
    addEventListener: vi.fn((n: string, cb: () => void) => oyentes.set(n, cb)),
    removeEventListener: vi.fn((n: string) => oyentes.delete(n)),
  }
  return { motor: motor as unknown as SpeechSynthesis, dichos, oyentes, spy: motor }
}

describe("servicio de voz", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("empieza desactivado y no habla hasta que se activa", () => {
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(0)
    expect(s.getSnapshot().activa).toBe(false)
    // Aun así recuerda el último mensaje para poder repetirlo.
    expect(s.getSnapshot().ultimoMensaje).toBe("Hola")
  })

  it("habla en es-ES a 0,9 con la voz elegida una vez activado", () => {
    const { motor, dichos } = motorFalso([
      voz("Helena", "es-ES"),
      voz("Jorge", "es-ES"),
    ])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(1)
    expect(dichos[0].lang).toBe("es-ES")
    expect(dichos[0].rate).toBe(0.9)
    expect((dichos[0].voice as { name: string }).name).toBe("Jorge")
  })

  it("marca hablando entre onstart y onend", () => {
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    dichos[0].onstart?.()
    expect(s.getSnapshot().hablando).toBe(true)
    dichos[0].onend?.()
    expect(s.getSnapshot().hablando).toBe(false)
  })

  it("silenciar corta el audio al instante y bloquea los siguientes", () => {
    const { motor, dichos, spy } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    dichos[0].onstart?.()
    spy.cancel.mockClear()
    s.silenciar(true)
    expect(spy.cancel).toHaveBeenCalled()
    expect(s.getSnapshot().hablando).toBe(false)
    s.decir("Otro")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(1)
  })

  it("no repite el mismo mensaje en una ventana corta, pero repetir() sí lo repite", () => {
    let t = 1000
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor, () => t)
    s.iniciar()
    s.activar()
    s.decir("Aviso")
    t += 500
    s.decir("Aviso")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(1)
    s.repetir()
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(2)
    t += 10_000
    s.decir("Aviso")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(3)
  })

  it("un cambio rápido de estado sustituye al mensaje pendiente", () => {
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Primero")
    s.decir("Segundo")
    vi.advanceTimersByTime(100)
    expect(dichos.map((d) => d.text)).toEqual(["Segundo"])
  })

  it("encolar no interrumpe lo que suena", () => {
    const { motor, dichos, spy } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Uno")
    vi.advanceTimersByTime(100)
    spy.cancel.mockClear()
    s.decir("Dos", { encolar: true })
    expect(spy.cancel).not.toHaveBeenCalled()
    expect(dichos.map((d) => d.text)).toEqual(["Uno", "Dos"])
  })

  it("encolar mantiene el orden aunque llegue antes de que arranque el primero", () => {
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Saludo")
    s.decir("Después", { encolar: true })
    vi.advanceTimersByTime(100)
    expect(dichos.map((d) => d.text)).toEqual(["Saludo", "Después"])
  })

  it("sin voces en español avisa y no habla hasta aceptar la voz del sistema", () => {
    const { motor, dichos } = motorFalso([voz("Alex", "en-US")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    expect(s.getSnapshot().sinVozEspanola).toBe(true)
    expect(s.getSnapshot().aviso).toBe(AVISO_SIN_VOZ_ESPANOLA)
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(0)
    s.aceptarVozSistema()
    s.decir("Hola otra vez")
    vi.advanceTimersByTime(100)
    expect(dichos).toHaveLength(1)
    // Con la voz del sistema no se fuerza ninguna voz concreta, solo el idioma.
    expect(dichos[0].voice).toBeNull()
    expect(dichos[0].lang).toBe("es-ES")
  })

  it("lee las voces cuando el navegador las anuncia con voiceschanged", () => {
    const voces: ReturnType<typeof voz>[] = []
    const { motor, oyentes } = motorFalso(voces)
    const s = crearServicioVoz(motor)
    s.iniciar()
    expect(s.getSnapshot().vocesListas).toBe(false)
    voces.push(voz("Pablo", "es-ES"))
    oyentes.get("voiceschanged")?.()
    expect(s.getSnapshot().vocesListas).toBe(true)
    expect(s.getSnapshot().voz?.nombre).toBe("Pablo")
  })

  it("un bloqueo del navegador se comunica como aviso", () => {
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    dichos[0].onerror?.({ error: "not-allowed" })
    expect(s.getSnapshot().aviso).toMatch(/bloqueado/)
    expect(s.getSnapshot().hablando).toBe(false)
  })

  it("cancelar por sustitución («interrupted») no se trata como error", () => {
    const { motor, dichos } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.activar()
    s.decir("Hola")
    vi.advanceTimersByTime(100)
    dichos[0].onerror?.({ error: "interrupted" })
    expect(s.getSnapshot().aviso).toBeNull()
  })

  it("destruir cancela el audio, suelta los eventos y es idempotente", () => {
    const { motor, spy } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.iniciar()
    expect(spy.addEventListener).toHaveBeenCalledTimes(1)
    s.destruir()
    s.destruir()
    expect(spy.removeEventListener).toHaveBeenCalledTimes(1)
    expect(spy.cancel).toHaveBeenCalled()
    // Puede volver a engancharse (React Strict Mode monta, desmonta y monta).
    s.iniciar()
    expect(spy.addEventListener).toHaveBeenCalledTimes(2)
  })

  it("sin soporte de síntesis no falla y queda inactivo", () => {
    const s = crearServicioVoz(null)
    s.iniciar()
    s.activar()
    s.decir("Hola")
    s.repetir()
    s.destruir()
    expect(s.getSnapshot().soportado).toBe(false)
    expect(s.getSnapshot().activa).toBe(false)
  })

  it("limita el volumen entre 0 y 1 y 0 equivale a silencio", () => {
    const { motor } = motorFalso([voz("Jorge", "es-ES")])
    const s = crearServicioVoz(motor)
    s.iniciar()
    s.fijarVolumen(3)
    expect(s.getSnapshot().volumen).toBe(1)
    s.fijarVolumen(0)
    expect(s.getSnapshot().silenciada).toBe(true)
    s.fijarVolumen(0.5)
    expect(s.getSnapshot().silenciada).toBe(false)
  })
})
