/**
 * Capa de «realidad mixta» sobre toda la pantalla: viñeta, líneas de escaneo,
 * marcas de enfoque en las esquinas y ruido. Es decorativa y no captura clics.
 * Con `error` el ruido sube y la viñeta se tiñe de rojo.
 */
export function CapaRealidadMixta({ error }: { error: boolean }) {
  return (
    <div
      className="mr-capa"
      data-error={error ? "" : undefined}
      aria-hidden
    >
      <span className="mr-barrido" />
      <span className="mr-ruido" />
      <span className="mr-esquina mr-esquina-ai" />
      <span className="mr-esquina mr-esquina-ad" />
      <span className="mr-esquina mr-esquina-bi" />
      <span className="mr-esquina mr-esquina-bd" />
    </div>
  )
}
