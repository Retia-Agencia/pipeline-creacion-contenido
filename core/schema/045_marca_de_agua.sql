-- 045 · Marca de agua + re-medición del reel joven (ADR-100 §D7)
-- Aditiva. Se aplica a mano en el SQL Editor, DESPUÉS de la 044 y ANTES del deploy de la app.

-- 1. Ritmo de publicación por cuenta: reels distintos publicados en los últimos 28 días ÷ 4.
create or replace view app.v_ritmo_referentes
with (security_invoker = true) as
  select instance_id,
         plataforma,
         handle,
         (count(distinct external_id) filter (where publicado_en > now() - interval '28 days'))::numeric / 4
           as ritmo_semanal
    from app.pool_crudo
   group by instance_id, plataforma, handle;

comment on view app.v_ritmo_referentes is
  'ADR-100 D2: reels por semana de cada cuenta (28 dias / 4), para dimensionar resultsLimit. '
  'Subestima en cuentas que topaban el resultsLimit viejo (25).';

-- 2. Última observación de cada reel, sin lo ya entregado. Los umbrales (piso, días) NO viven acá:
--    son ajustes que se mueven, y los aplica la fachada al leer (ADR-100 §D3).
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
     and not exists (
       select 1 from public.processed_items pi
        where pi.instance_id = p.instance_id
          and pi.external_id = p.external_id
     )
   order by p.instance_id, p.plataforma, p.external_id, p.medido_en desc;

comment on view app.v_remedir_candidatos is
  'ADR-100 D3: ultima observacion por reel, excluyendo lo entregado (processed_items). '
  'La fachada filtra edad < 7 d, vistas en [0,25 x piso, piso), medido hace >= 1 d y recencia.';

grant select on app.v_ritmo_referentes, app.v_remedir_candidatos to authenticated;

-- 3. Interruptor. Una clave nueva entra en tres lados o no existe: este check, CATALOGO de
--    domain/ajustes.ts y AJUSTE_MAP del motor.
alter table app.ajustes drop constraint ajustes_clave_check;
alter table app.ajustes add constraint ajustes_clave_check check (clave in (
  'Peso de vistas', 'Peso de likes', 'Peso de interacción', 'Peso de relevancia',
  'Bonus idioma extranjero', 'Seguidores para marcar viral',
  'Mínimo de vistas', 'Mínimo de likes', 'Relevancia mínima',
  'Videos a transcribir por corrida', 'Días de recencia', 'Resultados por cuenta de referente',
  'Buscar por referentes en Instagram', 'Buscar por referentes en TikTok',
  'Propuestas por corrida', 'Afinidad mínima de propuesta',
  'Descubrir en Instagram', 'Descubrir en TikTok',
  'Usar marca de agua'
));

insert into app.ajustes (instance_id, clave, valor, descripcion, visibilidad)
select a.instance_id, 'Usar marca de agua', 1,
       'ADR-100. 1 = a cada cuenta se le compra solo lo publicado desde su última compra, y se '
       || 're-miden por link los reels jóvenes cerca del piso. 0 = se compra como antes (ventana '
       || 'fija de Días de recencia). Es el botón de rollback.',
       'dev'
  from app.ajustes a
 where a.clave = 'Días de recencia'
   and not exists (select 1 from app.ajustes b
                    where b.instance_id = a.instance_id and b.clave = 'Usar marca de agua');

update app.ajustes
   set descripcion = 'Con marca de agua (ADR-100) es el TECHO de cuánto se mira hacia atrás: aplica '
                     || 'a cuentas nuevas o sin comprar hace mucho. Sin marca de agua es la ventana fija.'
 where clave = 'Días de recencia';

-- ═══════════ Verificación (correr y LEER — por efecto, no por haber corrido) ═══════════
-- a) select count(*), sum(ritmo_semanal) from app.v_ritmo_referentes;          -- > 0 filas
-- b) select count(*) from app.v_remedir_candidatos
--     where edad_al_medir_dias < 7 and vistas >= 100000 and vistas < 400000;   -- del orden de 74-88
-- c) un reel entregado NO aparece:
--    select count(*) from app.v_remedir_candidatos r
--      join public.processed_items pi using (instance_id, external_id);         -- 0
-- d) select clave, valor, visibilidad from app.ajustes where clave = 'Usar marca de agua'; -- 1 fila, 1, dev
-- e) insert de una clave inventada rebota con 23514.
