-- 048_etiquetas_rendimiento.sql - Hace configurable la vara de rendimiento del Feed.
-- Aplicar DESPUES de la `047`. SQL Editor de Supabase -> pegar -> Run.
--
-- Ejecuta el ticket C3 de
-- [07-refactor-tickets.md](../../docs/virlo/07-refactor-tickets.md) y ADR-104 D1/D2/D5.
--
-- EL PORQUE
-- 1. Una cantidad de vistas sin la edad del reel mezcla piezas nuevas y viejas; la vara acordada
--    es vistas por dia de vida y necesita conservar la fecha completa que trae el proveedor.
-- 2. Los nombres y cortes son una decision operativa de media, no constantes del dashboard.
--
-- ORDEN: se aplica ANTES del `n8n:push` que empieza a escribir `publicado_en` y antes del deploy
-- del dashboard que lee `app.etiquetas_rendimiento`.
--
-- Aditiva e idempotente. Sin backfill.

alter table app.candidatos
  add column if not exists publicado_en timestamptz;

comment on column app.candidatos.publicado_en is
  'Fecha de publicación del video según el proveedor; con creado_en da los días de vida; null en filas anteriores a la 048.';

create table if not exists app.etiquetas_rendimiento (
  id             uuid primary key default gen_random_uuid(),
  instance_id    uuid not null references public.instances (id),
  nombre         text not null check (length(btrim(nombre)) between 1 and 40),
  metrica        text not null default 'vpd' check (metrica in ('vpd')),
  minimo         numeric not null check (minimo >= 0),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (instance_id, nombre),
  unique (instance_id, metrica, minimo)
);

comment on column app.etiquetas_rendimiento.metrica is
  'Hoy solo vpd (vistas / max(días de vida, 1)). Agregar una métrica requiere ampliar este check y el enum del dominio.';

comment on table app.etiquetas_rendimiento is
  'Etiquetas de rendimiento por cockpit. Cada fila define solo su límite inferior; el superior es el minimo de la etiqueta siguiente, sin huecos ni solapamientos.';

alter table app.etiquetas_rendimiento enable row level security;

grant select, insert, update, delete on app.etiquetas_rendimiento to authenticated;

drop policy if exists "tenant" on app.etiquetas_rendimiento;
create policy "tenant" on app.etiquetas_rendimiento for all to authenticated
  using      (instance_id in (select app.instancias_visibles()))
  with check (instance_id in (select app.instancias_visibles()));

insert into app.etiquetas_rendimiento (instance_id, nombre, minimo)
select i.id, semilla.nombre, semilla.minimo
  from public.instances i
 cross join (values
   ('muy bueno', 20000::numeric),
   ('bueno',       5000::numeric),
   ('medio',       1000::numeric),
   ('bajo',           0::numeric)
 ) as semilla(nombre, minimo)
 where i.workflow_id = 'short-form-content'
on conflict do nothing;
