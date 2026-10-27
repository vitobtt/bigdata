"use client"

import * as React from "react"
import {
  CircleAlertIcon,
  DatabaseIcon,
  InfoIcon,
  LockIcon,
  RotateCwIcon,
  UploadCloudIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { TAMANO_LOTE, resumirCarga, type Lote } from "@/lib/etl/carga"
import { aMedicion } from "@/lib/etl/filtrado"
import type { Medicion } from "@/lib/etl/tipos"
import { formatoDuracion, formatoEntero, formatoFechaUtc } from "@/lib/formato"
import { InsigniaEstado, type Estado } from "./estado"
import { COLUMNAS_MEDICION } from "./pestana-validos"
import { TablaPaginada } from "./tabla-paginada"

const ESTADO_ENVIO: Record<Lote["envio"], [Estado, string]> = {
  pendiente: ["pendiente", "Pendiente"],
  enviando: ["en_curso", "Enviando"],
  completado: ["completada", "Enviado"],
  error: ["error", "Error"],
}
const ESTADO_VERIFICACION: Record<Lote["verificacion"], [Estado, string]> = {
  pendiente: ["pendiente", "Sin verificar"],
  verificando: ["en_curso", "Verificando"],
  confirmado: ["completada", "Confirmado"],
  incompleto: ["error", "Faltan claves"],
  error: ["error", "Error"],
}

function EstadoSupabaseAviso({ etl }: { etl: PipelineEtl }) {
  const s = etl.supabase
  if (s.cargando) {
    return (
      <p className="text-xs text-muted-foreground">
        Comprobando conexión con Supabase…
      </p>
    )
  }
  if (!s.configurado) {
    return (
      <Alert>
        <LockIcon />
        <AlertTitle>
          Supabase no está configurado: la carga está deshabilitada
        </AlertTitle>
        <AlertDescription>
          <p>
            Define <code>SUPABASE_URL</code> y <code>SUPABASE_SECRET_KEY</code>{" "}
            (sin prefijo <code>NEXT_PUBLIC_</code>): en local, en{" "}
            <code>.env.local</code> (a partir de <code>.env.example</code>); en
            Vercel, en <i>Settings → Environment Variables</i>, y vuelve a
            desplegar. Ejecuta también la migración. No se simula ninguna carga.
          </p>
        </AlertDescription>
      </Alert>
    )
  }
  if (!s.conectado) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>No se puede acceder a la tabla en Supabase</AlertTitle>
        <AlertDescription>
          <p>{s.mensaje}</p>
          <Button
            size="xs"
            variant="outline"
            className="mt-1"
            onClick={() => void etl.comprobarSupabase()}
          >
            <RotateCwIcon /> Comprobar de nuevo
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (s.escrituraPermitida === false) {
    return (
      <Alert variant="destructive">
        <LockIcon />
        <AlertTitle>Escritura bloqueada en producción</AlertTitle>
        <AlertDescription>
          La aplicación no tiene autenticación. Protege los endpoints antes de
          activar <code>ETL_PERMITIR_ESCRITURA=true</code>.
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <DatabaseIcon className="size-3.5" aria-hidden /> Conectado a Supabase ·
      tabla mediciones_meteorologicas con{" "}
      {s.totalRegistros == null ? "?" : formatoEntero(s.totalRegistros)}{" "}
      registros.
    </p>
  )
}

function rango(registros: Medicion[]) {
  if (registros.length === 0) return "—"
  const a = registros[0]
  const b = registros[registros.length - 1]
  return `${a.ciudad} ${formatoFechaUtc(a.fecha_hora)} … ${b.ciudad} ${formatoFechaUtc(b.fecha_hora)}`
}

function TablaLotes({ lotes }: { lotes: Lote[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="Estado de los lotes">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Lote</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            <TableHead>Primero … último</TableHead>
            <TableHead>Envío (upsert)</TableHead>
            <TableHead className="text-right">Filas afectadas</TableHead>
            <TableHead className="text-right">Duración</TableHead>
            <TableHead>Verificación en destino</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes.map((l) => {
            const [ee, te] = ESTADO_ENVIO[l.envio]
            const [ev, tv] = ESTADO_VERIFICACION[l.verificacion]
            return (
              <TableRow key={l.numero}>
                <TableCell className="font-mono">{l.numero}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatoEntero(l.registros.length)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {rango(l.registros)}
                </TableCell>
                <TableCell>
                  <InsigniaEstado estado={ee} etiqueta={te} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {l.envio === "completado"
                    ? l.filasAfectadas == null
                      ? "no informado"
                      : formatoEntero(l.filasAfectadas)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatoDuracion(l.duracionEnvioMs)}
                </TableCell>
                <TableCell>
                  <InsigniaEstado estado={ev} etiqueta={tv} />
                </TableCell>
                <TableCell className="max-w-96 text-xs whitespace-normal text-destructive">
                  {l.errorEnvio ?? l.errorVerificacion}
                  {l.clavesFaltantes?.length
                    ? `${l.clavesFaltantes.length} clave(s) no encontradas: ${l.clavesFaltantes.slice(0, 3).join(", ")}${l.clavesFaltantes.length > 3 ? "…" : ""}`
                    : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function PestanaCarga({ etl }: { etl: PipelineEtl }) {
  const { carga, aCargar } = etl
  const [vista, setVista] = React.useState<"actual" | "congelado">("actual")
  const informe = carga ? resumirCarga(carga.lotes) : null
  const s = etl.supabase
  const listo =
    !s.cargando &&
    s.configurado &&
    s.conectado &&
    s.escrituraPermitida !== false
  const hayFallos = !!carga?.lotes.some(
    (l) =>
      l.envio === "error" ||
      l.verificacion === "error" ||
      l.verificacion === "incompleto"
  )
  const lotesPrevistos = Math.ceil(aCargar.length / TAMANO_LOTE)
  const vistaEfectiva = carga ? vista : "actual"
  const filasVista = React.useMemo(
    () =>
      (vistaEfectiva === "congelado" && carga ? carga.congelado : aCargar).map(
        (f, i): Medicion & { orden: number } => ({
          ...aMedicion(f),
          orden: i + 1,
        })
      ),
    [vistaEfectiva, carga, aCargar]
  )

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <InfoIcon />
        <AlertTitle>
          El orden de la vista previa es el orden de envío, no un orden guardado
        </AlertTitle>
        <AlertDescription>
          Una base de datos relacional no conserva el orden de inserción: una
          consulta sin <code>ORDER BY</code> puede devolver las filas en
          cualquier orden. Para leerlas ordenadas hay que pedirlo siempre, p.
          ej. <code>SELECT … ORDER BY fecha_hora, ciudad</code>.
        </AlertDescription>
      </Alert>

      <EstadoSupabaseAviso etl={etl} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={
            !listo ||
            aCargar.length === 0 ||
            !!carga?.enCurso ||
            !!etl.extraccion?.enCurso
          }
          onClick={etl.iniciarCarga}
        >
          <UploadCloudIcon />
          {carga?.enCurso
            ? "Subiendo…"
            : `Subir ${formatoEntero(aCargar.length)} registros a Supabase`}
        </Button>
        {hayFallos && !carga?.enCurso && (
          <Button
            variant="outline"
            size="lg"
            onClick={etl.reintentarCarga}
            disabled={!listo}
          >
            <RotateCwIcon /> Reintentar lotes fallidos
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {aCargar.length === 0
            ? "Selecciona registros en «Válidos y selección»."
            : `${lotesPrevistos} lote(s) de ≤ ${TAMANO_LOTE} · upsert por (ciudad, fecha_hora) · huella ${etl.huellaACargar}`}
        </span>
      </div>

      {carga && (
        <section aria-labelledby="titulo-carga" className="flex flex-col gap-2">
          <h3 id="titulo-carga" className="text-sm font-semibold">
            Carga iniciada el {carga.iniciadaEn.replace("T", " ").slice(0, 19)}{" "}
            UTC · copia congelada de {formatoEntero(carga.congelado.length)}{" "}
            registros · huella {carga.huella}
          </h3>
          {carga.huella !== etl.huellaACargar && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              La selección o los filtros han cambiado desde que se inició esta
              carga (huella actual {etl.huellaACargar}). La carga usa la copia
              congelada; los cambios no la afectan.
            </p>
          )}
          {informe && (
            <dl
              className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"
              aria-live="polite"
            >
              {[
                ["Enviados correctamente", informe.registrosEnviadosOk],
                ["En lotes fallidos", informe.registrosFallidos],
                ["Confirmados en destino", informe.registrosConfirmados],
                [
                  "Filas afectadas (insert. + actualiz.)",
                  informe.filasAfectadas == null
                    ? "no informado"
                    : informe.filasAfectadas,
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border p-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-base tabular-nums">
                    {typeof v === "number" ? formatoEntero(v) : v}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-xs text-muted-foreground">
            Supabase devuelve el número de filas afectadas por el upsert, pero
            no distingue cuántas se insertaron y cuántas se actualizaron, así
            que no se muestra ese desglose. Lotes: {informe?.lotesCompletados}/
            {informe?.lotes} enviados
            {informe?.lotesFallidos
              ? `, ${informe.lotesFallidos} con error`
              : ""}{" "}
            · duración total {formatoDuracion(carga.duracionMs)}.
          </p>
          <TablaLotes lotes={carga.lotes} />
        </section>
      )}

      <section
        aria-labelledby="titulo-vista-previa"
        className="flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="titulo-vista-previa" className="text-sm font-semibold">
            Vista previa: conjunto exacto que se enviará, en el orden elegido
            <span className="ml-2 inline-flex items-center rounded-md border px-1.5 text-xs font-normal">
              En tu navegador · aún no está en Supabase
            </span>
          </h3>
          {carga && (
            <div
              role="tablist"
              aria-label="Conjunto mostrado"
              className="flex gap-1"
            >
              <Button
                role="tab"
                size="xs"
                aria-selected={vistaEfectiva === "actual"}
                variant={vistaEfectiva === "actual" ? "default" : "outline"}
                onClick={() => setVista("actual")}
              >
                Selección actual ({formatoEntero(aCargar.length)})
              </Button>
              <Button
                role="tab"
                size="xs"
                aria-selected={vistaEfectiva === "congelado"}
                variant={vistaEfectiva === "congelado" ? "default" : "outline"}
                onClick={() => setVista("congelado")}
              >
                Copia congelada de la carga (
                {formatoEntero(carga.congelado.length)})
              </Button>
            </div>
          )}
        </div>
        <TablaPaginada
          etiqueta="Vista previa de la carga"
          filas={filasVista}
          columnas={[
            {
              id: "n",
              encabezado: "Orden de envío",
              celda: (f) => formatoEntero(f.orden),
              numerica: true,
            },
            ...COLUMNAS_MEDICION,
          ]}
          claveFila={(f) => `${f.ciudad}|${f.fecha_hora}`}
          vacio="No hay registros seleccionados que cumplan los filtros actuales."
        />
      </section>
    </div>
  )
}
