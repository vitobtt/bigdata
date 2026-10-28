/**
 * Servicio de voz basado en `window.speechSynthesis`. No depende de React: el
 * hook `useAsistenteVoz` solo se suscribe a su estado.
 *
 * - Solo habla en español (`es-ES`); no hay selector de idioma.
 * - Empieza desactivado: nada suena hasta que el usuario lo activa.
 * - La disponibilidad de voces depende del navegador y del sistema operativo,
 *   así que se leen con `getVoices()` y se vuelven a leer en `voiceschanged`.
 */
import {
  AVISO_BLOQUEADO,
  AVISO_OTRA_REGION,
  AVISO_SIN_VOZ_ESPANOLA,
} from "./mensajes"

export const IDIOMA = "es-ES"
export const VELOCIDAD_INICIAL = 0.9
/** Un mismo mensaje no se repite si ya sonó hace menos de este tiempo. */
export const VENTANA_REPETIDOS_MS = 4000

export type VozElegida = {
  nombre: string
  lang: string
  /** true si es una voz de España (`es-ES`). */
  deEspana: boolean
}

export type EstadoVoz = {
  /** El navegador ofrece `speechSynthesis`. */
  soportado: boolean
  activa: boolean
  silenciada: boolean
  volumen: number
  hablando: boolean
  voz: VozElegida | null
  /** Las voces ya se han leído al menos una vez. */
  vocesListas: boolean
  /** No hay ninguna voz `es-*` y el usuario aún no ha decidido qué hacer. */
  sinVozEspanola: boolean
  /** El usuario aceptó la voz predeterminada del sistema. */
  usarVozSistema: boolean
  ultimoMensaje: string | null
  /** Aviso para mostrar al usuario (voz alternativa, bloqueo del navegador…). */
  aviso: string | null
}

export type OpcionesDecir = {
  /** Se encola tras lo que esté sonando en lugar de interrumpirlo. */
  encolar?: boolean
}

/* ---------- Elección de voz (pura, se prueba sin navegador) ---------- */

const MARCAS_NATURALES = /natural|neural|online|premium|enhanced|mejorada/i
// Nombres de voces masculinas habituales en español de Windows, macOS y Android.
const NOMBRES_MASCULINOS =
  /\b(alvaro|álvaro|pablo|jorge|enrique|raul|raúl|juan|diego|carlos|miguel|antonio|tomas|tomás|alberto|andres|andrés|pedro)\b/i
const NOMBRES_FEMENINOS =
  /\b(helena|laura|elvira|monica|mónica|paulina|marisol|lucia|lucía|paloma|sabina|esperanza|catalina|elena|sofia|sofía|maria|maría|female|mujer)\b/i

type VozNavegador = Pick<
  SpeechSynthesisVoice,
  "name" | "lang" | "localService" | "default"
>

function puntuar(v: VozNavegador): number {
  const lang = v.lang.replace("_", "-").toLowerCase()
  let p = 0
  if (lang === "es-es") p += 50
  else if (lang.startsWith("es")) p += 20
  if (MARCAS_NATURALES.test(v.name)) p += 30
  if (/google/i.test(v.name)) p += 8
  if (NOMBRES_MASCULINOS.test(v.name) || /\b(male|hombre)\b/i.test(v.name))
    p += 20
  else if (NOMBRES_FEMENINOS.test(v.name)) p -= 5
  if (v.localService) p += 3
  return p
}

/**
 * Devuelve la mejor voz en español: primero España, después otras regiones;
 * dentro de cada grupo prefiere las naturales y las masculinas si se pueden
 * identificar por el nombre. null si no hay ninguna voz en español.
 */
export function elegirVoz<T extends VozNavegador>(voces: T[]): T | null {
  const espanolas = voces.filter((v) =>
    v.lang.replace("_", "-").toLowerCase().startsWith("es")
  )
  if (espanolas.length === 0) return null
  return [...espanolas].sort((a, b) => puntuar(b) - puntuar(a))[0]
}

/* ---------- Servicio ---------- */

export type ServicioVoz = {
  getSnapshot: () => EstadoVoz
  getServerSnapshot: () => EstadoVoz
  subscribe: (cb: () => void) => () => void
  /** Engancha los eventos del navegador. Es idempotente. */
  iniciar: () => void
  /** Cancela el audio y suelta los eventos. Es idempotente. */
  destruir: () => void
  activar: () => void
  desactivar: () => void
  silenciar: (valor: boolean) => void
  fijarVolumen: (v: number) => void
  decir: (texto: string, opciones?: OpcionesDecir) => void
  repetir: () => void
  cancelar: () => void
  aceptarVozSistema: () => void
}

const CLAVE_VOLUMEN = "nimbus.asistente.volumen"

function leerVolumen(): number {
  try {
    const v = Number(window.localStorage.getItem(CLAVE_VOLUMEN))
    if (window.localStorage.getItem(CLAVE_VOLUMEN) !== null && v >= 0 && v <= 1)
      return v
  } catch {
    // Almacenamiento bloqueado: se usa el volumen por defecto.
  }
  return 0.85
}

function guardarVolumen(v: number) {
  try {
    window.localStorage.setItem(CLAVE_VOLUMEN, String(v))
  } catch {
    // Solo es una comodidad.
  }
}

const INICIAL: EstadoVoz = {
  soportado: false,
  activa: false,
  silenciada: false,
  volumen: 0.85,
  hablando: false,
  voz: null,
  vocesListas: false,
  sinVozEspanola: false,
  usarVozSistema: false,
  ultimoMensaje: null,
  aviso: null,
}

export function crearServicioVoz(
  /** Se inyecta en las pruebas; en el navegador es `window.speechSynthesis`. */
  sintesis?: SpeechSynthesis | null,
  ahora: () => number = () => Date.now()
): ServicioVoz {
  const motor: SpeechSynthesis | null =
    sintesis !== undefined
      ? sintesis
      : typeof window !== "undefined" && "speechSynthesis" in window
        ? (window.speechSynthesis ?? null)
        : null

  let estado: EstadoVoz = { ...INICIAL, soportado: !!motor }
  const suscriptores = new Set<() => void>()
  let vozNavegador: SpeechSynthesisVoice | null = null
  let enganchado = false
  // El navegador puede recolectar el utterance mientras suena (error conocido de
  // Chrome): se mantiene una referencia hasta que termina.
  let actual: SpeechSynthesisUtterance | null = null
  let enCola = 0
  let ultimo: { texto: string; en: number } | null = null
  let temporizador: ReturnType<typeof setTimeout> | null = null
  const pendientes: SpeechSynthesisUtterance[] = []

  const emitir = (cambios: Partial<EstadoVoz>) => {
    estado = { ...estado, ...cambios }
    suscriptores.forEach((cb) => cb())
  }

  const leerVoces = () => {
    if (!motor) return
    const voces = motor.getVoices()
    if (voces.length === 0) return
    vozNavegador = elegirVoz(voces)
    const voz: VozElegida | null = vozNavegador
      ? {
          nombre: vozNavegador.name,
          lang: vozNavegador.lang,
          deEspana: vozNavegador.lang.replace("_", "-").toLowerCase() === "es-es",
        }
      : null
    emitir({
      voz,
      vocesListas: true,
      sinVozEspanola: !voz,
      aviso:
        voz && !voz.deEspana
          ? AVISO_OTRA_REGION
          : !voz && estado.activa && !estado.usarVozSistema
            ? AVISO_SIN_VOZ_ESPANOLA
            : estado.aviso === AVISO_SIN_VOZ_ESPANOLA ||
                estado.aviso === AVISO_OTRA_REGION
              ? null
              : estado.aviso,
    })
  }

  const puedeHablar = () =>
    !!motor &&
    estado.activa &&
    !estado.silenciada &&
    (estado.voz !== null || estado.usarVozSistema)

  const hablar = (texto: string, encolar: boolean) => {
    if (!motor) return
    if (!encolar) {
      if (temporizador) clearTimeout(temporizador)
      temporizador = null
      pendientes.length = 0
      enCola = 0
      motor.cancel()
    }
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = IDIOMA
    u.rate = VELOCIDAD_INICIAL
    u.pitch = 1
    u.volume = estado.volumen
    if (vozNavegador && !estado.usarVozSistema) u.voice = vozNavegador
    enCola++
    u.onstart = () => emitir({ hablando: true })
    const terminar = () => {
      enCola = Math.max(0, enCola - 1)
      if (actual === u) actual = null
      if (enCola === 0) emitir({ hablando: false })
    }
    u.onend = terminar
    u.onerror = (e) => {
      terminar()
      // «canceled» e «interrupted» son consecuencia normal de cancelar o sustituir.
      if (e.error === "not-allowed") emitir({ aviso: AVISO_BLOQUEADO })
    }
    actual = u
    // Chrome descarta un speak() lanzado en el mismo instante que cancel(): se
    // espera un instante y, para conservar el orden, lo que se encole mientras
    // tanto va detrás.
    if (temporizador) {
      pendientes.push(u)
    } else if (encolar) {
      motor.speak(u)
    } else {
      pendientes.push(u)
      temporizador = setTimeout(() => {
        temporizador = null
        const lote = pendientes.splice(0)
        for (const x of lote) motor.speak(x)
      }, 40)
    }
  }

  const servicio: ServicioVoz = {
    getSnapshot: () => estado,
    getServerSnapshot: () => INICIAL,
    subscribe(cb) {
      suscriptores.add(cb)
      return () => suscriptores.delete(cb)
    },
    iniciar() {
      if (!motor || enganchado) return
      enganchado = true
      emitir({ volumen: leerVolumen() })
      leerVoces()
      motor.addEventListener("voiceschanged", leerVoces)
    },
    destruir() {
      if (!motor || !enganchado) return
      enganchado = false
      motor.removeEventListener("voiceschanged", leerVoces)
      if (temporizador) clearTimeout(temporizador)
      temporizador = null
      pendientes.length = 0
      enCola = 0
      actual = null
      motor.cancel()
      emitir({ hablando: false })
    },
    activar() {
      if (!motor) return
      emitir({
        activa: true,
        silenciada: false,
        aviso: estado.vocesListas && !estado.voz ? AVISO_SIN_VOZ_ESPANOLA : estado.aviso,
      })
    },
    desactivar() {
      servicio.cancelar()
      emitir({ activa: false, aviso: null })
    },
    silenciar(valor) {
      if (valor) servicio.cancelar()
      emitir({ silenciada: valor })
    },
    fijarVolumen(v) {
      const volumen = Math.min(1, Math.max(0, v))
      guardarVolumen(volumen)
      // El volumen de una locución en curso no cambia: se aplica a la siguiente.
      emitir({ volumen, silenciada: volumen === 0 })
    },
    decir(texto, opciones = {}) {
      if (!estado.vocesListas) leerVoces()
      // El último mensaje se guarda aunque el audio esté apagado: «Repetir» lo reutiliza.
      emitir({ ultimoMensaje: texto })
      if (!puedeHablar()) return
      const t = ahora()
      if (
        !opciones.encolar &&
        ultimo &&
        ultimo.texto === texto &&
        t - ultimo.en < VENTANA_REPETIDOS_MS
      )
        return
      ultimo = { texto, en: t }
      hablar(texto, !!opciones.encolar)
    },
    repetir() {
      if (!estado.vocesListas) leerVoces()
      if (!estado.ultimoMensaje || !puedeHablar()) return
      ultimo = { texto: estado.ultimoMensaje, en: ahora() }
      hablar(estado.ultimoMensaje, false)
    },
    cancelar() {
      if (!motor) return
      if (temporizador) clearTimeout(temporizador)
      temporizador = null
      pendientes.length = 0
      enCola = 0
      actual = null
      motor.cancel()
      emitir({ hablando: false })
    },
    aceptarVozSistema() {
      emitir({ usarVozSistema: true, sinVozEspanola: false, aviso: null })
    },
  }
  return servicio
}
