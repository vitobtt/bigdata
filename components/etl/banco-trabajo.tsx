"use client"

import * as React from "react"
import { DatabaseIcon, ShieldAlertIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { formatoEntero } from "@/lib/formato"
import { Configuracion } from "./configuracion"
import { Contadores } from "./contadores"
import { InsigniaEstado } from "./estado"
import { PestanaCarga } from "./pestana-carga"
import { PestanaJson } from "./pestana-json"
import { PestanaRechazados } from "./pestana-rechazados"
import { PestanaSupabase } from "./pestana-supabase"
import { PestanaTransformados } from "./pestana-transformados"
import { PestanaValidos } from "./pestana-validos"
import { Pipeline, type Pestana } from "./pipeline"

export function BancoTrabajo() {
  const etl = usePipelineEtl()
  const [pestana, setPestana] = React.useState<Pestana>("json")
  const inspeccionRef = React.useRef<HTMLDivElement>(null)

  const inspeccionar = (p: Pestana) => {
    setPestana(p)
    inspeccionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  const s = etl.supabase
  const rechazados = etl.fases?.limpieza.rechazados.length ?? 0

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Big Data · Práctica 1
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pipeline ETL: Open-Meteo → Supabase
          </h1>
          <p className="text-sm text-muted-foreground">
            Extrae datos horarios, transfórmalos, límpialos, decide qué subir y
            comprueba qué ha quedado guardado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
            <ShieldAlertIcon className="size-3.5" aria-hidden /> Sin
            autenticación: solo desarrollo local
          </span>
          {s.cargando ? (
            <InsigniaEstado estado="en_curso" etiqueta="Comprobando Supabase" />
          ) : !s.configurado ? (
            <InsigniaEstado
              estado="pendiente"
              etiqueta="Supabase sin configurar"
            />
          ) : s.conectado ? (
            <InsigniaEstado
              estado="completada"
              etiqueta={`Supabase conectado · ${s.totalRegistros == null ? "?" : formatoEntero(s.totalRegistros)} filas`}
            />
          ) : (
            <InsigniaEstado
              estado="error"
              etiqueta="Supabase: error de acceso"
            />
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Configuracion etl={etl} />
        </aside>
        <main className="flex min-w-0 flex-col gap-4">
          <Pipeline
            etl={etl}
            onInspeccionar={inspeccionar}
            pestanaActiva={pestana}
          />
          <Contadores etl={etl} />
          <Card ref={inspeccionRef} className="scroll-mt-4">
            <CardHeader>
              <CardTitle>3. Inspección de datos</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={pestana}
                onValueChange={(v) => setPestana(v as Pestana)}
              >
                <div className="overflow-x-auto pb-1">
                  <TabsList>
                    <TabsTrigger value="json">JSON original</TabsTrigger>
                    <TabsTrigger value="transformados">
                      Transformados
                    </TabsTrigger>
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
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
