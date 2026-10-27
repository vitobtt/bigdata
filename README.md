# Pipeline ETL: Open-Meteo → Supabase

Práctica 1 de la especialización de Big Data. La aplicación ejecuta y muestra un primer pipeline
ETL: extrae datos meteorológicos horarios de la API histórica de Open-Meteo, los transforma, los
limpia y te deja filtrar y seleccionar qué registros cargar en Supabase. Después comprueba qué
ha quedado guardado.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), `@supabase/supabase-js`
y Vitest.

## Instalación

```bash
npm install
cp .env.example .env.local   # en Windows: copy .env.example .env.local
```

## Configuración de Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta la migración
   [`supabase/migrations/20261027000000_mediciones_meteorologicas.sql`](supabase/migrations/20261027000000_mediciones_meteorologicas.sql)
   de una de estas dos formas:
   - pegándola en el **SQL Editor** del panel;
   - con la CLI: `supabase link` y después `supabase db push`.
3. Rellena `.env.local`:

| Variable | Dónde obtenerla | Uso |
| --- | --- | --- |
| `SUPABASE_URL` | Project Settings → Data API | URL del proyecto |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → *Secret key* (`sb_secret_…`) | Lectura y escritura **solo desde el servidor** |
| `SUPABASE_SERVICE_ROLE_KEY` | (opcional) clave `service_role` heredada (JWT) | Alternativa si el proyecto aún usa claves heredadas |
| `NEXT_PUBLIC_SUPABASE_URL` | La misma URL del proyecto | Pareja de la clave publicable |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → *Publishable key* (`sb_publishable_…`) | Clave para el navegador. **No es secreta** y la carga no la usa |
| `NEXT_PUBLIC_MAPTILER_KEY` | cloud.maptiler.com → Account → API keys | Mapa interactivo (opcional). Es pública: restríngela por dominio en MapTiler |
| `ETL_PERMITIR_ESCRITURA` | — | Ver el apartado [Seguridad](#seguridad) |

Nunca pongas el prefijo `NEXT_PUBLIC_` a `SUPABASE_URL` ni a la clave secreta: Next.js incluiría
esas variables en el código que se envía al navegador. Solo la clave publicable lleva ese prefijo,
porque está pensada para el navegador.

Con la clave publicable se puede comprobar que la tabla está protegida: una petición de lectura o
escritura a `/rest/v1/mediciones_meteorologicas` con esa clave recibe «permission denied».

Sin credenciales, la aplicación funciona igualmente hasta la vista previa de la carga. El botón de
subida queda deshabilitado y la pantalla indica lo que falta. Nunca se simula una carga.

## Ejecución

```bash
npm run dev          # http://localhost:3000
npm test             # pruebas unitarias (fixtures controlados, sin red)
npm run test:red     # incluye la prueba de integración real con Open-Meteo
npm run typecheck
npm run lint
npm run build
```

## La interfaz

La pantalla tiene un estilo de panel de control (HUD) y está pensada para que se entienda sin
conocer el tema:

- **Cómo funciona, en 5 pasos**: el proceso explicado en lenguaje sencillo.
- **Mapa de estaciones**: las cinco ciudades con su estado (lista, descargando, datos recibidos,
  error) y su resumen (temperatura mínima y máxima, humedad y lluvia). Al pulsar una ciudad se
  añade o se quita de la próxima descarga.
  - Con `NEXT_PUBLIC_MAPTILER_KEY` se usa MapTiler (estilo *dataviz* oscuro).
  - Sin clave, o si la clave falla, se muestra un mapa esquemático de España (contorno de
    Natural Earth).
- **Pipeline**: cada fase explica qué hace en lenguaje sencillo y, debajo, en términos técnicos.
- **Lectura de los datos**: temperatura hora a hora por ciudad (pasa el ratón para ver los
  valores) y lluvia acumulada por ciudad. Las gráficas muestran solo los registros que cumplen
  los filtros. Cada ciudad tiene siempre el mismo color, el mismo en el mapa y en las gráficas;
  la paleta se ha validado para daltonismo.

## El pipeline

```
Extracción → Transformación → Limpieza → Filtrado y selección → Carga
```

1. **Extracción**
   ([`lib/etl/extraccion.ts`](lib/etl/extraccion.ts)).
   - Hace una petición por ciudad a `https://archive-api.open-meteo.com/v1/archive` con
     `timezone=UTC`, °C y mm, para `temperature_2m`, `relative_humidity_2m` y `precipitation`.
   - Las peticiones son secuenciales, para que se vea qué ciudad se está procesando.
   - El periodo máximo es de 31 días.
   - Cada JSON original se conserva durante la sesión y se puede descargar.
   - Si una ciudad falla, se puede reintentar solo esa ciudad. El reintento *sustituye* su JSON, así
     que no se duplican filas.
2. **Transformación**
   ([`lib/etl/transformacion.ts`](lib/etl/transformacion.ts)).
   - La API devuelve arrays paralelos: la posición *i* de `time`, `temperature_2m`… es la misma hora.
     Cada posición se convierte en una fila `{ciudad, fecha_hora, temperatura_c, humedad_pct,
     precipitacion_mm}`.
   - `fecha_hora` se interpreta como UTC de forma explícita (`…T00:00` → `…T00:00:00.000Z`).
   - Se comprueba que los arrays tengan la misma longitud. Si no la tienen, las posiciones que
     faltan quedan *ausentes*, nunca a 0.
3. **Limpieza**
   ([`lib/etl/limpieza.ts`](lib/etl/limpieza.ts)).
   - Se rechazan los registros sin ciudad o sin fecha válida, y los que tengan alguna medición que
     no sea un número finito: `null`, cadena vacía, texto, NaN o ausente. Ninguno de esos valores se
     convierte en 0.
   - La humedad debe estar entre 0 y 100 y la precipitación debe ser ≥ 0.
   - **No** se filtran temperaturas extremas.
   - **Duplicados** por `(ciudad, fecha_hora)`: se buscan solo entre los registros que ya han
     superado las reglas anteriores. Se **conserva la primera aparición** (orden de ciudades y
     posición en el array) y las siguientes se rechazan con el motivo «duplicado de …».
   - Cada rechazo guarda su motivo.
4. **Filtrado y selección**
   ([`lib/etl/filtrado.ts`](lib/etl/filtrado.ts)).
   - Orden de las operaciones: *válidos → filtros → ordenación → selección → carga*. La paginación
     solo afecta a lo que se muestra.
   - Solo se suben las filas seleccionadas **que siguen cumpliendo los filtros**. La pantalla indica
     cuántas filas seleccionadas quedan fuera.
   - Cambiar los filtros nunca selecciona filas automáticamente.
   - Los registros excluidos por filtros no son rechazos de calidad, y se cuentan por separado.
5. **Carga**
   ([`lib/etl/carga.ts`](lib/etl/carga.ts) y [`app/api/supabase/`](app/api/supabase/)).
   - Al pulsar «Subir N registros» se congela una copia del conjunto y de su orden. Una huella
     (hash) permite comparar la vista previa con lo enviado.
   - Los registros se envían en lotes de ≤ 500 a un *route handler* del servidor. Este valida de
     nuevo cada registro y el tamaño de la petición, y hace un `upsert` con
     `onConflict: "ciudad,fecha_hora"`.
   - Si un lote falla, los anteriores se conservan y se pueden reintentar solo los fallidos. El
     reintento es idempotente gracias al upsert.
   - Supabase devuelve las *filas afectadas*, pero no distingue insertadas de actualizadas, así que
     no se inventa ese desglose.
   - Al terminar se verifica, por lotes, que cada clave enviada existe en la tabla.
   - `importado_en` guarda la fecha de la primera inserción: un upsert posterior no la modifica.

> Una base de datos no conserva el orden de inserción. Para leer los datos ordenados hay que usar
> siempre `ORDER BY` (la pestaña «Datos en Supabase» lo hace).

## Seguridad

- La escritura y la lectura en Supabase se hacen **solo en el servidor**
  ([`lib/supabase/servidor.ts`](lib/supabase/servidor.ts) importa `server-only`). La clave secreta
  nunca llega al navegador ni se escribe en los logs.
- La tabla tiene **RLS activado y ninguna política**. Además se revocan todos los permisos a `anon`
  y `authenticated`, de modo que con la clave publicable no se puede leer ni escribir. El rol de
  servidor solo tiene `SELECT, INSERT, UPDATE`.
- **La aplicación no tiene autenticación.** Está pensada para desarrollo local. En producción
  (`next start` o un despliegue) los endpoints de escritura responden 403, salvo que se defina
  `ETL_PERMITIR_ESCRITURA=true`. Antes de publicarla hay que proteger `app/api/supabase/*` con
  autenticación. Los endpoints de lectura también usan la clave secreta: protégelos igualmente.

## Pruebas

- `tests/pipeline.test.ts`: URL y validación del periodo, 24 horas UTC para un día, transformación
  de los arrays, `null` que no se convierte en 0, duplicados, filtros y ordenación antes de
  paginar, selección entre páginas, y vista previa igual al envío.
- `tests/carga.test.ts`: lotes de 500, fallo parcial y reintento solo de los lotes fallidos,
  segunda carga sin duplicados y validación en el servidor. Las pruebas de carga usan un destino
  **simulado** en memoria; no sustituyen una prueba contra Supabase.
- `tests/fixtures/sinteticos.ts`: datos sintéticos (nulos, duplicados, longitudes incoherentes).
  Solo se usan en las pruebas, nunca en la aplicación.
- `tests/fixtures/barcelona-2026-09-01.json`: respuesta real capturada de la API.
