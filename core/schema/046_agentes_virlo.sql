-- 046_agentes_virlo.sql - Virlo busca contenido por agente tematico y el motor lo asigna.
-- Aplicar DESPUES de la `045`. SQL Editor de Supabase -> pegar -> Run.
--
-- Ejecuta [ADR-102](../../docs/adr/ADR-102-la-busqueda-pasa-a-virlo-por-tematica.md) y el ticket T0
-- de [07-refactor-tickets.md](../../docs/virlo/07-refactor-tickets.md).
--
-- EL PORQUE
-- 1. La unidad de busqueda deja de ser el referente y pasa a ser un agente por tematica, creado y
--    operado por el equipo de media.
-- 2. Un agente puede alimentar proyectos de cualquier voz, pero siempre dentro de la misma empresa.
-- 3. Cada agente local puede representar uno o varios agentes de Virlo segun su modo de idiomas.
-- 4. Cada corrida queda en un libro de gasto idempotente por el identificador del webhook.
-- 5. Candidatos y descartes conservan el origen y el agente para separar los resultados de ambos
--    motores sin cambiar el comportamiento de las filas existentes.
--
-- ORDEN: esta migracion va despues de la `045`. Nada en la app lee estas tablas o columnas todavia,
-- asi que no hay orden de deploy adicional.
--
-- Aditiva e idempotente. Sin backfill explicito.


-- Este valor debe agregarse antes que todo lo demas y no puede usarse en el resto del script: el
-- SQL Editor puede ejecutar el archivo en una sola transaccion y PostgreSQL exige commit previo.
alter type app.plataforma add value if not exists 'youtube';


-- ================================= §1 · Agentes tematicos =================================

create table if not exists app.agentes (
  id             uuid primary key default gen_random_uuid(),
  instance_id    uuid not null references instances (id),
  tematica       text not null check (btrim(tematica) <> ''),
  intencion      text not null check (char_length(intencion) between 1 and 500),
  keywords       jsonb not null default '{}'::jsonb check (jsonb_typeof(keywords) = 'object'),
  excluidas      text[] not null default '{}',
  idiomas        text[] not null default '{en}' check (cardinality(idiomas) >= 1),
  modo           text not null default 'separar' check (modo in ('mezclar', 'separar')),
  cadencia       text,
  autopilot      boolean not null default true,
  min_views      integer not null default 500000 check (min_views >= 0),
  activo         boolean not null default false,
  creado_por     uuid references app.usuarios (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (instance_id, tematica),
  unique (id, instance_id)
);

comment on table app.agentes is
  'Agentes tematicos que el equipo de media opera para buscar contenido en Virlo. Un agente puede '
  'alimentar proyectos de cualquier voz dentro de su empresa. ADR-102.';

comment on column app.agentes.keywords is
  'Objeto idioma -> array de keywords. La forma interna la valida el dominio que sincroniza Virlo.';

comment on column app.agentes.cadencia is
  'Cadencia enviada a Virlo. No tiene check local porque su vocabulario pertenece a Virlo.';


-- Un agente local se materializa una vez si mezcla idiomas o una vez por idioma si los separa.
create table if not exists app.agentes_virlo (
  id             uuid primary key default gen_random_uuid(),
  instance_id    uuid not null references instances (id),
  agente_id      uuid not null,
  idioma         text,
  virlo_agent_id text not null unique,
  creado_en      timestamptz not null default now(),
  unique nulls not distinct (agente_id, idioma),
  foreign key (agente_id, instance_id) references app.agentes (id, instance_id)
    on delete cascade
);

comment on table app.agentes_virlo is
  'Identificadores remotos de cada agente tematico. idioma null representa modo mezclar; un idioma '
  'representa una materializacion del modo separar. ADR-102 D-5.';

comment on column app.agentes_virlo.idioma is
  'Null en modo mezclar; un idioma concreto en modo separar.';


-- La asociacion no depende de la voz: Claude asigna cada video a un proyecto compatible.
create table if not exists app.agentes_proyectos (
  instance_id uuid not null references instances (id),
  agente_id   uuid,
  proyecto_id uuid references app.proyectos (id) on delete cascade,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  primary key (agente_id, proyecto_id),
  foreign key (agente_id, instance_id) references app.agentes (id, instance_id)
    on delete cascade
);

comment on table app.agentes_proyectos is
  'Proyectos que puede alimentar un agente, sin restriccion de voz y siempre dentro de la misma '
  'empresa. El FK compuesto y el trigger refuerzan el tenant porque RLS no detiene a service_role. '
  'ADR-102.';


-- ================================= §2 · Candado entre tenants ==============================
-- RLS protege al rol autenticado, pero service_role la salta. El FK compuesto impide conectar un
-- agente con otra instancia; este trigger impide conectar un proyecto de otra empresa.

create or replace function app.agentes_proyectos_valida_tenant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  proyecto_client_id text;
  instancia_client_id text;
begin
  select p.client_id
    into proyecto_client_id
    from app.proyectos p
   where p.id = new.proyecto_id;

  if not found then
    raise exception 'El proyecto de agentes_proyectos no existe';
  end if;

  select i.client_id
    into instancia_client_id
    from public.instances i
   where i.id = new.instance_id;

  if proyecto_client_id is distinct from instancia_client_id then
    raise exception
      'El proyecto de agentes_proyectos debe pertenecer a la empresa de la instancia';
  end if;

  return new;
end
$function$;

comment on function app.agentes_proyectos_valida_tenant() is
  'Impide cruces entre tenants aun con service_role, que no queda limitado por RLS. ADR-102.';

drop trigger if exists agentes_proyectos_valida_tenant on app.agentes_proyectos;
create trigger agentes_proyectos_valida_tenant
before insert or update on app.agentes_proyectos
for each row execute function app.agentes_proyectos_valida_tenant();


-- ================================= §3 · Libro de gasto ====================================

create table if not exists app.virlo_corridas (
  id                uuid primary key default gen_random_uuid(),
  instance_id       uuid not null references instances (id),
  agente_id         uuid references app.agentes (id) on delete set null,
  virlo_agent_id    text not null,
  virlo_run_id      text not null unique,
  run_id            uuid references runs (id),
  estado            text not null,
  costo_usd         numeric,
  saldo_despues_usd numeric,
  metricas          jsonb,
  recibido_en       timestamptz not null default now(),
  procesado_en      timestamptz
);

comment on table app.virlo_corridas is
  'Libro de gasto de Virlo. virlo_run_id es la clave de idempotencia del webhook; una corrida puede '
  'llegar mas de una vez y conserva una sola fila. Nunca se borra. ADR-102 D-10.';

comment on column app.virlo_corridas.costo_usd is
  'Costo informado por Virlo en X-Cost.';


-- ================================= §4 · Proyectos y resultados =============================

alter table app.proyectos
  add column if not exists plataformas app.plataforma[] not null default '{instagram,tiktok}';

comment on column app.proyectos.plataformas is
  'Plataformas que acepta el proyecto. La nueva plataforma es opt-in; el default conserva el '
  'comportamiento anterior. ADR-102 D-8.';


alter table app.candidatos
  add column if not exists origen text not null default 'apify',
  add column if not exists agente_id uuid,
  add column if not exists fuente_transcript text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'app.candidatos'::regclass
       and conname = 'candidatos_origen_check'
  ) then
    alter table app.candidatos
      add constraint candidatos_origen_check check (origen in ('apify', 'virlo'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'app.candidatos'::regclass
       and conname = 'candidatos_agente_id_fkey'
  ) then
    alter table app.candidatos
      add constraint candidatos_agente_id_fkey foreign key (agente_id)
      references app.agentes (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'app.candidatos'::regclass
       and conname = 'candidatos_fuente_transcript_check'
  ) then
    alter table app.candidatos
      add constraint candidatos_fuente_transcript_check
      check (fuente_transcript in ('virlo_platform', 'virlo_transcribed', 'supadata'));
  end if;
end $$;

comment on column app.candidatos.origen is
  'Motor que encontro el candidato. Las filas anteriores conservan apify por default.';

comment on column app.candidatos.agente_id is
  'Agente tematico que encontro el video; null para filas que no lo registraron.';

comment on column app.candidatos.fuente_transcript is
  'Fuente del transcript. Null significa no registrado, incluido todo lo anterior a la 046.';


alter table app.descartes
  add column if not exists origen text not null default 'apify',
  add column if not exists agente_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'app.descartes'::regclass
       and conname = 'descartes_origen_check'
  ) then
    alter table app.descartes
      add constraint descartes_origen_check check (origen in ('apify', 'virlo'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'app.descartes'::regclass
       and conname = 'descartes_agente_id_fkey'
  ) then
    alter table app.descartes
      add constraint descartes_agente_id_fkey foreign key (agente_id)
      references app.agentes (id) on delete set null;
  end if;
end $$;

comment on column app.descartes.origen is
  'Permite separar los descartes ninguno y fuera de la intencion de Virlo de los descartes de '
  'Apify. ADR-102 D-4b.';

comment on column app.descartes.agente_id is
  'Agente tematico que origino el descarte; null para filas que no lo registraron.';


-- ================================= §5 · RLS y permisos =====================================
-- Las cuatro tablas nuevas tienen grano instancia. Grants explicitos, independientes de los
-- default privileges. El libro no concede DELETE porque el gasto nunca se borra.

alter table app.agentes enable row level security;
alter table app.agentes_virlo enable row level security;
alter table app.agentes_proyectos enable row level security;
alter table app.virlo_corridas enable row level security;

grant select, insert, update, delete on app.agentes to authenticated;
grant select, insert, update, delete on app.agentes_virlo to authenticated;
grant select, insert, update, delete on app.agentes_proyectos to authenticated;
grant select, insert, update on app.virlo_corridas to authenticated;

drop policy if exists "tenant" on app.agentes;
create policy "tenant" on app.agentes for all to authenticated
  using      (instance_id in (select app.instancias_visibles()))
  with check (instance_id in (select app.instancias_visibles()));

drop policy if exists "tenant" on app.agentes_virlo;
create policy "tenant" on app.agentes_virlo for all to authenticated
  using      (instance_id in (select app.instancias_visibles()))
  with check (instance_id in (select app.instancias_visibles()));

drop policy if exists "tenant" on app.agentes_proyectos;
create policy "tenant" on app.agentes_proyectos for all to authenticated
  using      (instance_id in (select app.instancias_visibles()))
  with check (instance_id in (select app.instancias_visibles()));

drop policy if exists "tenant" on app.virlo_corridas;
create policy "tenant" on app.virlo_corridas for all to authenticated
  using      (instance_id in (select app.instancias_visibles()))
  with check (instance_id in (select app.instancias_visibles()));


-- ================================= Verificacion (correr y LEER, por efecto) =================

-- 1. El enum contiene el valor nuevo.
-- select enum_range(null::app.plataforma);

-- 2. Las cuatro tablas existen y tienen RLS prendido. Deben devolver cuatro filas con true.
-- select n.nspname as esquema, c.relname as tabla, c.relrowsecurity
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'app'
--    and c.relname in ('agentes', 'agentes_virlo', 'agentes_proyectos', 'virlo_corridas')
--  order by c.relname;

-- 3. Cada tabla tiene su policy tenant.
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
--   from pg_policies
--  where schemaname = 'app'
--    and tablename in ('agentes', 'agentes_virlo', 'agentes_proyectos', 'virlo_corridas')
--  order by tablename, policyname;

-- 4. Las columnas nuevas existen con sus tipos, nulabilidad y defaults.
-- select table_name, column_name, data_type, udt_name, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'app'
--    and (
--      (table_name = 'proyectos' and column_name = 'plataformas')
--      or (table_name = 'candidatos' and column_name in ('origen', 'agente_id', 'fuente_transcript'))
--      or (table_name = 'descartes' and column_name in ('origen', 'agente_id'))
--    )
--  order by table_name, ordinal_position;

-- 5. Con un proyecto de otra empresa, debe fallar por el trigger antes de crear el cruce.
-- insert into app.agentes_proyectos (instance_id, agente_id, proyecto_id)
-- values ('<instance_id_del_agente>'::uuid, '<agente_id>'::uuid,
--         '<proyecto_id_de_otra_empresa>'::uuid);

-- 6. Con una instancia y proyecto compatibles, un agente de otra instancia debe fallar con 23503
--    por el FK compuesto.
-- insert into app.agentes_proyectos (instance_id, agente_id, proyecto_id)
-- values ('<instance_id>'::uuid, '<agente_id_de_otra_instancia>'::uuid,
--         '<proyecto_id_de_la_instancia>'::uuid);

-- 7. Si el libro tiene al menos una fila, este insert debe fallar con 23505 por virlo_run_id.
-- insert into app.virlo_corridas (id, instance_id, agente_id, virlo_agent_id, virlo_run_id, estado)
-- select gen_random_uuid(), instance_id, agente_id, virlo_agent_id, virlo_run_id, estado
--   from app.virlo_corridas
--  limit 1;
