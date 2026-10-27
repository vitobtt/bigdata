"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatoEntero } from "@/lib/formato"
import { cn } from "@/lib/utils"

export type Columna<T> = {
  id: string
  encabezado: React.ReactNode
  celda: (fila: T) => React.ReactNode
  numerica?: boolean
}

export const TAMANOS_PAGINA = [25, 50, 100] as const

type Props<T> = {
  filas: T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  /** Texto cuando no hay filas. */
  vacio: React.ReactNode
  /** Columna de selección opcional. */
  seleccion?: {
    seleccionada: (fila: T) => boolean
    alternar: (fila: T, valor: boolean) => void
    alternarPagina: (filas: T[], valor: boolean) => void
  }
  claseFila?: (fila: T) => string | undefined
  etiqueta: string
  /** Total real si `filas` ya es una página traída del servidor. */
  paginacionExterna?: {
    total: number
    pagina: number
    tamano: number
    cambiarPagina: (p: number) => void
    cambiarTamano: (t: number) => void
    tamanos: readonly number[]
  }
}

/**
 * Tabla con paginación. La paginación solo recorta lo que se muestra: las
 * filas ya llegan filtradas y ordenadas.
 */
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  vacio,
  seleccion,
  claseFila,
  etiqueta,
  paginacionExterna,
}: Props<T>) {
  const [paginaInterna, setPaginaInterna] = React.useState(0)
  const [tamanoInterno, setTamanoInterno] = React.useState<number>(25)

  const total = paginacionExterna?.total ?? filas.length
  const tamano = paginacionExterna?.tamano ?? tamanoInterno
  const paginas = Math.max(1, Math.ceil(total / tamano))
  // Si los filtros reducen el total, la página se ajusta sin guardar un estado incoherente.
  const pagina = Math.min(
    paginacionExterna?.pagina ?? paginaInterna,
    paginas - 1
  )
  const visibles = paginacionExterna
    ? filas
    : filas.slice(pagina * tamano, pagina * tamano + tamano)

  const irA = (p: number) =>
    paginacionExterna ? paginacionExterna.cambiarPagina(p) : setPaginaInterna(p)
  const cambiarTamano = (t: number) => {
    if (paginacionExterna) paginacionExterna.cambiarTamano(t)
    else {
      setTamanoInterno(t)
      setPaginaInterna(0)
    }
  }

  const todasMarcadas =
    seleccion && visibles.length > 0 && visibles.every(seleccion.seleccionada)
  const algunaMarcada = seleccion && visibles.some(seleccion.seleccionada)

  return (
    <div className="flex flex-col gap-2">
      <div className="neu-hundido overflow-x-auto rounded-lg border">
        <Table aria-label={etiqueta}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {seleccion && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar las filas de esta página"
                    checked={!!todasMarcadas}
                    indeterminate={!todasMarcadas && !!algunaMarcada}
                    disabled={visibles.length === 0}
                    onCheckedChange={(v) =>
                      seleccion.alternarPagina(visibles, v)
                    }
                  />
                </TableHead>
              )}
              {columnas.map((c) => (
                <TableHead
                  key={c.id}
                  className={cn(c.numerica && "text-right")}
                >
                  {c.encabezado}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnas.length + (seleccion ? 1 : 0)}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  {vacio}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((fila) => {
                const marcada = seleccion?.seleccionada(fila)
                return (
                  <TableRow
                    key={claveFila(fila)}
                    data-state={marcada ? "selected" : undefined}
                    className={claseFila?.(fila)}
                  >
                    {seleccion && (
                      <TableCell>
                        <Checkbox
                          aria-label={`Seleccionar ${claveFila(fila)}`}
                          checked={!!marcada}
                          onCheckedChange={(v) => seleccion.alternar(fila, v)}
                        />
                      </TableCell>
                    )}
                    {columnas.map((c) => (
                      <TableCell
                        key={c.id}
                        className={cn(
                          c.numerica && "text-right font-mono tabular-nums"
                        )}
                      >
                        {c.celda(fila)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {total === 0
            ? "Sin filas"
            : `Filas ${formatoEntero(pagina * tamano + 1)}–${formatoEntero(
                Math.min(total, (pagina + 1) * tamano)
              )} de ${formatoEntero(total)}`}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Filas por página
            <select
              className="h-7 rounded-md border bg-background px-1 text-xs text-foreground"
              value={tamano}
              onChange={(e) => cambiarTamano(Number(e.target.value))}
            >
              {(paginacionExterna?.tamanos ?? TAMANOS_PAGINA).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={pagina === 0}
            onClick={() => irA(pagina - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums">
            Página {pagina + 1} de {paginas}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Página siguiente"
            disabled={pagina >= paginas - 1}
            onClick={() => irA(pagina + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
