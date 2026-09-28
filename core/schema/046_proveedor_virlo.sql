-- 046_proveedor_virlo.sql — Virlo entra al lado de Apify, en sombra, sin tocar lo que ya se compra.
-- Aplicar DESPUÉS de la `045`. SQL Editor de Supabase → pegar → Run.
--
-- Ejecuta la Fase 1 de [plan-migracion-virlo.md](../../docs/agents/plan-migracion-virlo.md) y
-- [ADR-101](../../docs/adr/ADR-101-virlo-entra-en-sombra.md) (propuesta: enmienda ADR-098).
--
-- ⚠️ ORDEN: esta migración → deploy de la app (el CATALOGO de domain/ajustes.ts ya conoce la clave
-- nueva) → push del motor. Al revés, la pantalla de Ajustes recibe una fila que no sabe pintar.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- EL PORQUÉ
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Un interruptor `Proveedor de scraping` (0 apify · 1 sombra · 2 virlo), mismo patrón que
--    `Usar marca de agua` (045): el rollback es poner un 0, sin deploy.
-- 2. `pool_crudo.proveedor`: en sombra, las observaciones de Virlo se guardan en la MISMA tabla
--    que las de Apify para compararlas reel por reel (Fase 3).
-- 3. 🩸 Y por eso las tres vistas de la marca de agua pasan a leer SOLO Apify. Sin este filtro, la
--    sombra NO es sombra: si Virlo ve un reel más nuevo, `v_watermark_referentes` corre la marca de
--    agua de esa cuenta, el motor le pide a Apify "solo lo posterior" y ese reel —que Virlo vio
--    pero no entrega— no lo compra nadie. El flujo real perdería videos sin un error. Las tres
--    vistas son la ÚNICA forma en que el cockpit y la fachada leen `pool_crudo` (lib/marca-de-agua.ts
--    + lib/supabase/scoped.ts), así que filtrar acá alcanza y la app no cambia. En el corte (Fase 6)
--    otra migración mueve el filtro al proveedor que entregue.
-- 4. `videos_meta.fuente` acepta 'virlo', y `app.tarifas` conoce los precios de Virlo.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Aditiva e idempotente. Sin backfill: las filas existentes son todas de Apify y el default lo dice.


-- ═══════════════════════ §1 · El interruptor ═══════════════════════
-- Una clave nueva entra en tres lados o no existe: este check, CATALOGO de domain/ajustes.ts y
-- AJUSTE_MAP del motor (`Armar plan de corrida`). Los tres están en el mismo commit.
alter table app.ajustes drop constraint ajustes_clave_check;
alter table app.ajustes add constraint ajustes_clave_check check (clave in (
  'Peso de vistas', 'Peso de likes', 'Peso de interacción', 'Peso de relevancia',
  'Bonus idioma extranjero', 'Seguidores para marcar viral',
  'Mínimo de vistas', 'Mínimo de likes', 'Relevancia mínima',
  'Videos a transcribir por corrida', 'Días de recencia', 'Resultados por cuenta de referente',
  'Buscar por referentes en Instagram', 'Buscar por referentes en TikTok',
  'Propuestas por corrida', 'Afinidad mínima de propuesta',
  'Descubrir en Instagram', 'Descubrir en TikTok',
  'Usar marca de agua',
  'Proveedor de scraping'
));

insert into app.ajustes (instance_id, clave, valor, descripcion, visibilidad)
select a.instance_id, 'Proveedor de scraping', 0,
       'Migración a Virlo. 0 = Apify (como siempre). 1 = Apify entrega y Virlo corre al lado solo '
       || 'para comparar: no entrega nada y cuesta 0,50 USD por referente. 2 = entrega Virlo. '
       || 'Volver a 0 es el rollback.',
       'dev'
  from app.ajustes a
 where a.clave = 'Días de recencia'
   and not exists (select 1 from app.ajustes b
                    where b.instance_id = a.instance_id and b.clave = 'Proveedor de scraping');


-- ═══════════════════════ §2 · De quién es cada observación ═══════════════════════
alter table app.pool_crudo
  add column if not exists proveedor text not null default 'apify';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'app.pool_crudo'::regclass and conname = 'pool_crudo_proveedor_check') then
    alter table app.pool_crudo
      add constraint pool_crudo_proveedor_check check (proveedor in ('apify', 'virlo'));
  end if;
end $$;

comment on column app.pool_crudo.proveedor is
  'Quien vendio esta observacion. En sombra (plan-migracion-virlo) Virlo escribe aca para compararse '
  'con Apify reel por reel. Las vistas de marca de agua leen SOLO apify hasta el corte (046).';

-- La PK sigue siendo (instance_id, plataforma, external_id, apify_dataset_id). Virlo no tiene dataset:
-- su fila lleva `virlo:<job_id>` en esa columna, el mismo truco que el `motor:<run_id>` del motor.
comment on column app.pool_crudo.apify_dataset_id is
  'Dataset de Apify del que salio. Unidad de compra y parte de la PK: es la clave de idempotencia '
  'del backfill. Apify los borra a los 31 dias, uno por dia. Filas de Virlo: virlo:<job_id> (046).';


-- ═══════════════════════ §3 · La marca de agua lee solo lo que compró Apify ═══════════════════════
-- Mismas columnas y mismo orden que en la 044/045 (create or replace no deja cambiarlas): lo único
-- nuevo es el filtro por proveedor.
create or replace view app.v_watermark_referentes as
  select
    instance_id,
    plataforma,
    handle,
    max(publicado_en) as watermark,
    count(*)          as observaciones,
    max(medido_en)    as ultima_medicion
  from app.pool_crudo
  where publicado_en is not null
    and proveedor = 'apify'
  group by instance_id, plataforma, handle;

create or replace view app.v_ritmo_referentes
with (security_invoker = true) as
  select instance_id,
         plataforma,
         handle,
         (count(distinct external_id) filter (where publicado_en > now() - interval '28 days'))::numeric / 4
           as ritmo_semanal
    from app.pool_crudo
   where proveedor = 'apify'
   group by instance_id, plataforma, handle;

create or replace view app.v_remedir_candidatos
with (security_invoker = true) as
  select distinct on (p.instance_id, p.plataforma, p.external_id)
         p.instance_id,
         p.plataforma,
         p.external_id,
         p.handle,
         p.publicado_en,
         p.medido_en,
         p.vistas,
         extract(epoch from p.medido_en - p.publicado_en) / 86400 as edad_al_medir_dias
    from app.pool_crudo p
   where p.publicado_en is not null
     and p.vistas is not null
     and p.proveedor = 'apify'
     and not exists (
       select 1 from public.processed_items pi
        where pi.instance_id = p.instance_id
          and pi.external_id = p.external_id
     )
   order by p.instance_id, p.plataforma, p.external_id, p.medido_en desc;


-- ═══════════════════════ §4 · videos_meta y tarifas ═══════════════════════
-- El check de `fuente` nació sin nombre en la 030. Se busca por su definición en vez de adivinar el
-- nombre: un `drop constraint if exists` con el nombre equivocado no falla, y el check viejo seguiría
-- rechazando 'virlo' al lado del nuevo.
do $$
declare
  c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'app.videos_meta'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%fuente%'
  loop
    execute format('alter table app.videos_meta drop constraint %I', c);
  end loop;
end $$;

alter table app.videos_meta
  add constraint videos_meta_fuente_check check (fuente in ('apify', 'archivado', 'manual', 'virlo'));

-- Precios de lista del 28/09 (dev.virlo.ai/docs/credits). `v_costos_semana` no los lee todavía:
-- los va a leer cuando el motor escriba sus métricas de Virlo (Fase 2).
insert into app.tarifas (servicio, usd_por_unidad, unidad) values
  ('virlo_lookup',   0.50, 'creador buscado (creator lookup de Virlo)'),
  ('virlo_agent',    0.50, 'corrida de un content research agent de Virlo'),
  ('virlo_agent_di', 1.50, 'corrida de agent de Virlo con Data Intelligence')
on conflict (servicio) do nothing;


-- ═══════════ Verificación (correr y LEER — por efecto, no por haber corrido) ═══════════
-- a) select clave, valor, visibilidad from app.ajustes where clave = 'Proveedor de scraping';
--    -- 1 fila por instancia, valor 0, dev
-- b) select proveedor, count(*) from app.pool_crudo group by 1;          -- todo 'apify'
-- c) Las vistas no cambiaron de resultado (antes y después tienen que dar lo mismo, porque hoy todo
--    es apify): select count(*), sum(observaciones) from app.v_watermark_referentes;
--    select count(*) from app.v_remedir_candidatos;
-- d) Una fila de Virlo NO mueve la marca de agua (en una transacción que se revierte):
--    begin;
--      insert into app.pool_crudo (instance_id, plataforma, external_id, handle, publicado_en, vistas,
--                                  medido_en, apify_dataset_id, origen, proveedor)
--      select instance_id, plataforma, '1', handle, now(), 1, now(), 'virlo:prueba', 'manual', 'virlo'
--        from app.v_watermark_referentes limit 1;
--      select max(watermark) > now() - interval '1 minute' as se_movio from app.v_watermark_referentes;  -- false
--    rollback;
-- e) insert con proveedor 'otro' rebota con 23514; y videos_meta con fuente 'virlo' ya no.
-- f) select servicio, usd_por_unidad from app.tarifas where servicio like 'virlo%';  -- 3 filas
-- g) PostgREST: GET /rest/v1/pool_crudo?select=proveedor&limit=1 (Accept-Profile: app) → 200, no 42703.
