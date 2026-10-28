"use client"

import * as React from "react"
import { DatabaseIcon, ShieldAlertIcon } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CapaRealidadMixta } from "@/components/hud/capa-realidad-mixta"
import { AsistenteNimbus } from "@/components/asistente/asistente-nimbus"
import { Marca } from "@/components/nimbus/marca"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatoEntero } from "@/lib/formato"
import { RelojUtc } from "./cabecera"
import { Configuracion } from "./configuracion"
import { Instrumentos } from "./instrumentos"
import { InsigniaEstado } from "./estado"
import { Graficas } from "./graficas"
import { Mapa } from "./mapa"
import { PestanaCarga } from "./pestana-carga"
import { PestanaJson } from "./pestana-json"
import { PestanaRechazados } from "./pestana-rechazados"
import { PestanaSupabase } from "./pestana-supabase"
import { PestanaTransformados } from "./pestana-transformados"
import { PestanaValidos } from "./pestana-validos"
import { Pipeline, type Pestana } from "./pipeline"
import { ResumenRevision } from "./resumen-revision"

export function BancoTrabajo() {
  const etl = usePipelineEtl()
  const [pestana, setPestana] = React.useState<Pestana>("json")
  const [focoElegido, setFoco] = React.useState<string | null>(null)
  const inspeccionRef = React.useRef<HTMLElement>(null)

  // Ciudad enfocada: la última tocada o, si no hay, la primera marcada.
  const foco = focoElegido ?? etl.config.ciudades[0] ?? CIUDADES[0].id

  const inspeccionar = (p: Pestana) => {
    setPestana(p)
    inspeccionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  const s = etl.supabase
  const rechazados = etl.fases?.limpieza.rechazados.length ?? 0
  const hayError =
    (etl.extraccion
      ? Object.values(etl.extraccion.descargas).some((d) => d.estado === "error")
      : false) ||
    !!etl.carga?.lotes.some(
      (l) => l.envio === "error" || l.verificacion === "error"
    ) ||
    (!s.cargando && s.configurado && !s.conectado)
  const activo = !!etl.extraccion?.enCurso || !!etl.carga?.enCurso

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 pt-4 pb-28 sm:px-6">
      <CapaRealidadMixta error={hayError} />
      <AsistenteNimbus etl={etl} alInspeccionar={inspeccionar} />

      <header className="sistema">
        <div className="sistema-marca">
          <Marca activo={activo} />
          <div>
            <h1 className="hud-titulo hud-brillo text-xl sm:text-2xl">Nimbus</h1>
            <p className="sistema-sub">
              Inteligencia atmosférica · Big Data · Práctica 1
            </p>
          </div>
        </div>
        <p className="sistema-lema">
          Descarga el tiempo de cinco ciudades, revisa los datos y guárdalos en
          una base de datos en la nube.
        </p>
        <div className="sistema-lecturas">
          <RelojUtc />
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-muted-foreground">
              <ShieldAlertIcon className="size-3.5" aria-hidden /> Sin login:
              uso en clase
            </span>
            {s.cargando ? (
              <InsigniaEstado
                estado="en_curso"
                etiqueta="Comprobando Supabase"
              />
            ) : !s.configurado ? (
              <InsigniaEstado
                estado="pendiente"
                etiqueta="Supabase sin configurar"
              />
            ) : s.conectado ? (
              <InsigniaEstado
                estado="completada"
                etiqueta={`Supabase conectado · ${s.totalRegistros == null ? "?" : formatoEntero(s.totalRegistros)} filas guardadas`}
              />
            ) : (
              <InsigniaEstado
                estado="error"
                etiqueta="Supabase: error de acceso"
              />
            )}
          </div>
        </div>
      </header>

      {/* Plano 2 (mapa) bajo plano 3 (panel de control acoplado) */}
      <div className="escenario">
        <aside className="escenario-dock">
          <Configuracion etl={etl} alFocar={setFoco} />
        </aside>
        <div className="escenario-mapa">
          <Mapa etl={etl} foco={foco} alFocar={setFoco} />
        </div>
      </div>

      <Instrumentos etl={etl} foco={foco} />
      <Pipeline
        etl={etl}
        onInspeccionar={inspeccionar}
        pestanaActiva={pestana}
      />
      <Graficas etl={etl} verTabla={() => inspeccionar("validos")} />

      <section
        ref={inspeccionRef}
        className="taller plano-2 scroll-mt-4"
        aria-labelledby="titulo-taller"
      >
        <header className="escena-cabecera">
          <span className="rotulo-vertical" aria-hidden>
            Taller · 05
          </span>
          <div>
            <h2 id="titulo-taller" className="hud-titulo text-base sm:text-lg">
              Inspección de datos
            </h2>
            <p className="text-sm text-muted-foreground">
              Revisa lo descargado, decide qué se sube y comprueba lo guardado.
            </p>
          </div>
        </header>
        <ResumenRevision etl={etl} />
        <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)}>
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="json">JSON original</TabsTrigger>
              <TabsTrigger value="transformados">Transformados</TabsTrigger>
              <TabsTrigger value="validos">
                Válidos y selección ({formatoEntero(etl.validos.length)})
              </TabsTrigger>
              <TabsTrigger value="rechazados">
                Rechazados ({formatoEntero(rechazados)})
              </TabsTrigger>
              <TabsTrigger value="carga">
                Vista previa y carga ({formatoEntero(etl.aCargar.length)})
              </TabsTrigger>
              <TabsTrigger value="supabase">
                <DatabaseIcon aria-hidden /> Datos en Supabase
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="json" className="pt-3">
            <PestanaJson etl={etl} />
          </TabsContent>
          <TabsContent value="transformados" className="pt-3">
            <PestanaTransformados etl={etl} />
          </TabsContent>
          {/* keepMounted conserva el formulario de filtros al cambiar de pestaña. */}
          <TabsContent value="validos" className="pt-3" keepMounted>
            <PestanaValidos etl={etl} />
          </TabsContent>
          <TabsContent value="rechazados" className="pt-3">
            <PestanaRechazados etl={etl} />
          </TabsContent>
          <TabsContent value="carga" className="pt-3">
            <PestanaCarga etl={etl} />
          </TabsContent>
          <TabsContent value="supabase" className="pt-3" keepMounted>
            <PestanaSupabase etl={etl} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
