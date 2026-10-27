-- Tabla destino del pipeline ETL Open-Meteo → Supabase.
-- Una fila por ciudad y hora (UTC).

create table if not exists public.mediciones_meteorologicas (
  id               bigint generated always as identity primary key,
  ciudad           text             not null,
  fecha_hora       timestamptz      not null,
  temperatura_c    double precision not null,
  humedad_pct      double precision not null,
  precipitacion_mm double precision not null,
  importado_en     timestamptz      not null default now(),

  -- Clave de negocio: el upsert usa esta restricción para no duplicar filas.
  constraint mediciones_meteorologicas_ciudad_fecha_hora_key
    unique (ciudad, fecha_hora),
  constraint mediciones_meteorologicas_ciudad_no_vacia
    check (length(btrim(ciudad)) > 0),
  constraint mediciones_meteorologicas_humedad_rango
    check (humedad_pct >= 0 and humedad_pct <= 100),
  constraint mediciones_meteorologicas_precipitacion_no_negativa
    check (precipitacion_mm >= 0),
  -- double precision admite NaN e ±Infinity, y en Postgres NaN es mayor que
  -- cualquier número (pasaría "precipitacion_mm >= 0"). Se exigen valores finitos.
  -- La temperatura no tiene umbrales: no se descartan valores extremos.
  constraint mediciones_meteorologicas_valores_finitos
    check (
      temperatura_c    not in ('NaN', 'Infinity', '-Infinity') and
      humedad_pct      not in ('NaN', 'Infinity', '-Infinity') and
      precipitacion_mm not in ('NaN', 'Infinity', '-Infinity')
    )
);

comment on table public.mediciones_meteorologicas is
  'Mediciones horarias de Open-Meteo (archivo histórico) cargadas por el pipeline ETL.';
comment on column public.mediciones_meteorologicas.fecha_hora is
  'Instante de la medición en UTC.';
comment on column public.mediciones_meteorologicas.importado_en is
  'Momento de la primera inserción. Un upsert posterior no lo modifica.';

-- Índice para las consultas habituales (por fecha, con o sin ciudad).
-- La restricción única ya crea un índice (ciudad, fecha_hora).
create index if not exists mediciones_meteorologicas_fecha_hora_idx
  on public.mediciones_meteorologicas (fecha_hora);

-- Seguridad: RLS activado y SIN políticas. Así los roles anon y authenticated
-- (clave publicable) no pueden leer ni escribir. La aplicación accede desde el
-- servidor con la clave secreta (rol service_role), que salta RLS.
alter table public.mediciones_meteorologicas enable row level security;

-- Se retiran los GRANT automáticos (Supabase los está eliminando como valor
-- por defecto, pero los proyectos existentes aún los aplican) y se concede al
-- rol de servidor solo lo que necesita: leer y hacer upsert (insert + update).
revoke all on table public.mediciones_meteorologicas from anon, authenticated, service_role;
grant select, insert, update on table public.mediciones_meteorologicas to service_role;
