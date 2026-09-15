-- 044_pool_crudo.sql — Que la herramienta recuerde lo que PAGÓ, no solo lo que entregó.
-- Aplicar DESPUÉS de la `043`. SQL Editor de Supabase → pegar → Run.
--
-- Ejecuta [ADR-099](../../docs/adr/ADR-099-el-pool-crudo-recuerda-lo-que-se-pago.md), pasos 2 y 3 de
-- [plan-refactor-motor §7](../../docs/agents/plan-refactor-motor.md#7--orden-de-ataque-propuesto).
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- EL PORQUÉ, MEDIDO
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- `public.processed_items` guarda lo ENTREGADO (ADR-087): 1.952 filas, 866 al Feed. `app.descartes`
-- solo la banda borderline del gate. `app.videos_meta` solo lo comprado a pedido desde el cockpit.
-- NINGUNA tabla guarda lo que la corrida del motor le compró a Apify y tiró en `min_views` — el
-- 71,8% de lo pagado (ADR-087) y el 74-98% de la factura de un día (costos §4.3.5).
--
-- Sin este pool no hay marca de agua por referente (plan §3.4), ni la mitad de arriba del ledger de
-- cuentas (§3.3), ni `ritmo_publicacion`, ni base de cuenta para `viralidad` (§3.2), ni la cohorte
-- longitudinal que probó que las vistas no se congelan (§1.3).
--
-- 🔑 GRANO: una fila por OBSERVACIÓN de un reel, NO por entrega. El mismo reel medido el 17/08 y el
-- 07/09 son DOS filas — esa historia es lo que sirve. Por eso es tabla nueva y no una columna en
-- `processed_items`, cuya clave es por video (ADR-099 §T2).
--
-- 🔴 PLAZO DURO: Apify (plan STARTER) borra sus datasets a los 31 días, UNO POR DÍA. Los más viejos
-- (17/08) vencen el **2026-09-17**; los del 10/09, el 2026-10-11. Cada día que el backfill
-- (`core/scripts/backfill-pool-crudo.mjs --apply`) no corre se pierde un día de historia pagada.
-- Leer datasets propios no cuesta (costos §8.5): esta tabla se llena gratis.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Idempotente: `create table if not exists` + `drop policy if exists` + `create or replace view`.
-- Aditiva, sin backfill de datos (lo llena el script, no la migración). Correrla dos veces es
-- inofensivo.
--
-- ⚠️ Grants EXPLÍCITOS abajo: la `011` puso `alter default privileges ... on TABLES` para el schema
-- `app`, así que `authenticated` los hereda — pero se escriben igual, explícitos e independientes de
-- ese default, por la misma razón que la `037`/`039` (que el día que se endurezca como la `021`, el
-- acceso no se caiga). `service_role` los tiene por el mismo `alter default privileges`.


-- ═══════════════════════ §0 · Guardas ═══════════════════════
-- Mismo molde que la `030`: afirmar lo que TIENE que existir, con el mensaje diciendo qué correr.

do $guardas$
begin
  if to_regtype('app.plataforma') is null then
    raise exception 'Falta el tipo app.plataforma. Corré antes core/schema/009_app_config_sombra.sql';
  end if;

  if to_regclass('runs') is null then
    raise exception 'Falta runs. Corré antes las migraciones base (001/016).';
  end if;

  if to_regprocedure('app.instancias_visibles()') is null then
    raise exception 'Falta app.instancias_visibles(). Corré antes core/schema/021_rls_capa_2.sql';
  end if;
end
$guardas$;


-- ═══════════════════════ §1 · El pool crudo: una fila por observación ═══════════════════════

create table if not exists app.pool_crudo (
  -- Grano instancia, como app.candidatos / app.descartes / app.videos_meta (ADR-046): el reel crudo
  -- lo compró una corrida, y una corrida es de una instancia. NO client_id — el reel no pertenece a
  -- una empresa en abstracto, y la asignación a proyectos pasa aguas abajo (ADR-013/032).
  instance_id     uuid not null references instances (id),

  -- La identidad del sistema (ADR-070/072/086): la misma llave que usan candidatos, videos_meta y
  -- processed_items.
  plataforma      app.plataforma not null,
  external_id     text not null,

  -- 🔑 El handle se guarda ADEMÁS del instance_id porque el ledger y la marca de agua se agrupan por
  -- CUENTA, y un handle sobrevive a que el referente se borre (misma lógica que ADR-045: la historia
  -- se guarda por handle en texto, no por FK). Normalizado por el escritor: sin `@`, minúsculas.
  handle          text not null,

  -- Cuándo se publicó el reel (de `timestamp` de Apify). Es lo que la marca de agua maximiza (§T1) y
  -- lo que el corrector de edad `avance()` necesitará (§3.1, fuera de alcance acá).
  publicado_en    timestamptz,

  -- La medición de ese reel en ESA observación. Todo nullable menos la identidad: un scrape puede
  -- venir a medias (un cero en `vistas` mentiría; un null dice "no lo trajo"). La tarjeta ya sabe null.
  vistas          bigint,
  likes           bigint,
  comentarios     bigint,
  seguidores      bigint,
  duracion_seg    numeric,

  -- Cuándo Apify devolvió esta medición (= cuándo corrió el dataset). Parte del grano: el mismo reel
  -- en dos fechas son dos observaciones (§1.3).
  medido_en       timestamptz not null,

  -- De qué corrida de Apify salió. `apify_dataset_id` es la unidad de compra real y la clave de
  -- idempotencia (ver el unique de abajo).
  apify_run_id    text,
  apify_dataset_id text not null,

  -- Nuestra corrida, cuando se conoce (el backfill de datasets viejos no siempre puede cruzarla).
  run_id          uuid references runs (id),

  -- De dónde salió esta fila: 'motor' (una corrida la escribió en vivo), 'backfill' (la copió el
  -- script desde un dataset viejo, antes de que Apify lo borre), 'manual' (a mano).
  origen          text not null check (origen in ('motor', 'backfill', 'manual')),

  traido_en       timestamptz not null default now(),

  -- 🔑 Grano Y clave de idempotencia, en UNA sola llave: una observación = un reel dentro de un
  -- dataset. El mismo reel medido en varias fechas vive en datasets distintos, así que se conserva
  -- (ADR-099 §T2, la historia longitudinal de §1.3), y re-correr el backfill no duplica.
  -- Se usa el dataset y no `medido_en` porque el motor arranca ~24 corridas de Apify en paralelo:
  -- dos pueden compartir `startedAt`, y una PK por `medido_en` haría chocar un upsert que resuelve
  -- contra el dataset — el backfill se caería a mitad de camino, con los datasets venciéndose.
  primary key (instance_id, plataforma, external_id, apify_dataset_id)
);

-- El índice que sostiene la marca de agua y el ledger por cuenta (`where handle = ... order by
-- publicado_en desc`).
create index if not exists pool_crudo_handle_idx
  on app.pool_crudo (instance_id, plataforma, handle, publicado_en desc);

-- El índice que sostiene el lookup por video (cruzar contra processed_items / candidatos).
create index if not exists pool_crudo_external_id_idx
  on app.pool_crudo (instance_id, plataforma, external_id);

comment on table app.pool_crudo is
  'Una fila por OBSERVACION de un reel comprado a Apify (no por entrega). El mismo reel en dos fechas '
  'son dos filas: esa historia longitudinal probo que las vistas no se congelan (plan-refactor-motor '
  'seccion 1.3). Habilita la marca de agua por referente, el ledger de cuentas, el ritmo de '
  'publicacion y la base de cuenta de viralidad. La llena backfill-pool-crudo.mjs, no la migracion. '
  'ADR-099.';

comment on column app.pool_crudo.handle is
  'Cuenta normalizada: sin @, minusculas. Se guarda ademas del instance_id porque el ledger y la '
  'marca de agua se agrupan por cuenta, y un handle sobrevive a que el referente se borre (ADR-045).';

comment on column app.pool_crudo.medido_en is
  'Cuando Apify devolvio esta medicion (cuando corrio el dataset). Parte del grano: el mismo reel en '
  'dos fechas son dos observaciones.';

comment on column app.pool_crudo.apify_dataset_id is
  'Dataset de Apify del que salio. Unidad de compra y parte de la PK: es la clave de idempotencia '
  'del backfill. Apify los borra a los 31 dias, uno por dia: lo no copiado a tiempo se pierde.';


-- ═══════════════════════ §2 · Quién puede ver y escribir ═══════════════════════
-- Grano instancia, como `app.videos_meta` (`030`): lo que se compró lo pagó una corrida de un cockpit.
-- Sin `delete`: borrar una fila es tirar algo que se pagó y ninguna acción del producto lo pide.
-- `drop ... if exists` antes del create (Postgres no tiene `create or replace policy`).

alter table app.pool_crudo enable row level security;

grant select, insert, update on app.pool_crudo to authenticated;

drop policy if exists "tenant" on app.pool_crudo;
create policy "tenant" on app.pool_crudo for all to authenticated
  using      (instance_id in (select app.instancias_visibles()))
  with check (instance_id in (select app.instancias_visibles()));


-- ═══════════════════════ §3 · La marca de agua, DERIVADA (no columna) ═══════════════════════
--
-- 🔑 La marca de agua es max(publicado_en) por handle. NO se guarda en columna: seria un segundo
-- dueño del mismo hecho (ADR-027) que se atrasa la primera vez que alguien inserta sin actualizarla.
-- Se deriva al leer, como una vista.
--
-- 🩸 TRAMPA DE LOS POSTS FIJADOS (costos §4.3.5): los pinned de Instagram se saltean el filtro de
-- fecha y vuelven con timestamps viejisimos (hasta 989 dias), en las posiciones 1-8 del dataset,
-- nunca mas de 3 por cuenta. Para la MARCA DE AGUA esto NO es problema: un pin es VIEJO, no nuevo,
-- asi que no infla un `max(publicado_en)`. La trampa muerde al reves — cualquier calculo de VENTANA
-- o `min()` que se construya despues (avance(edad), §3.1, fuera de alcance) DEBE excluir las filas
-- mas viejas que la ventana de su corrida. Se documenta aca para que nadie invierta el sentido.

create or replace view app.v_watermark_referentes as
  select
    instance_id,
    plataforma,
    handle,
    max(publicado_en) as watermark,          -- el reel mas nuevo ya comprado de esta cuenta
    count(*)          as observaciones,
    max(medido_en)    as ultima_medicion
  from app.pool_crudo
  where publicado_en is not null
  group by instance_id, plataforma, handle;

comment on view app.v_watermark_referentes is
  'Marca de agua por referente (ADR-099 §T1): max(publicado_en) por handle, el reel mas nuevo ya '
  'comprado. DERIVADA, no guardada. Robusta a posts fijados por usar max (un pin es viejo, no infla). '
  'El motor la usaria para pedir onlyPostsNewerThan = watermark (plan §3.4). Fuera de alcance: no se '
  'conecta al motor en esta migracion.';

grant select on app.v_watermark_referentes to authenticated;


-- ═══════════════════════ Verificación (correr y LEER — por efecto, no por haber corrido) ═══════════════════════
--
-- 🩸 Una migración no se da por aplicada porque haya corrido: se da por aplicada cuando se mide su
-- efecto. Las preguntas, en orden:
--
--   -- 1. ¿La tabla existe con la forma esperada? (esperado: 16 columnas)
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'app' and table_name = 'pool_crudo'
--    order by ordinal_position;
--
--   -- 2. ¿La policy quedó? (esperado: 1 fila, "tenant", cmd = ALL)
--   select policyname, cmd from pg_policies
--    where schemaname = 'app' and tablename = 'pool_crudo';
--
--   -- 3. ¿La tabla nace vacía? (esperado: 0 — la migración NO backfillea; lo hace el script)
--   select count(*) as filas from app.pool_crudo;
--
--   -- 4. ¿La vista de watermark existe y contesta? (esperado: 0 filas hoy, sin error)
--   select count(*) from app.v_watermark_referentes;
--
--   -- 5. ¿El check de origen rechaza un valor inventado? (esperado: falla con 23514)
--   --    insert into app.pool_crudo (instance_id, plataforma, external_id, handle, medido_en,
--   --      apify_dataset_id, origen)
--   --    select id, 'instagram', 'test-999', 'test', now(), 'ds-test', 'cualquiera'
--   --      from public.instances limit 1;   -- debe fallar; borrar la fila si algún valor válido entró
--
--   -- 6. ¿PostgREST la ve? (desde el .env de la raíz; esperado: `[]`, NO un 404)
--   --    curl -s -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
--   --         -H "Accept-Profile: app" "$SUPABASE_URL/rest/v1/pool_crudo?limit=1"
--   --    Un 404 acá significa que PostgREST no recargó su schema cache: esperar o `notify pgrst, 'reload schema'`.
--
-- 🐤 Canario: `select count(*) from app.pool_crudo` nace en CERO. La primera fila la escribe el
-- backfill (`--apply`), y ESE conteo subiendo es la señal de que la copia de datasets funcionó.
-- Los datasets más viejos vencen el 2026-09-17: correrlo el mismo día que se aplica esto.
