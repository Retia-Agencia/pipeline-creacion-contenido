-- Etiqueta de rendimiento (C3, ADR-103 D5): vistas por día de vida en app.pool_crudo.
-- Medido el 2026-10-18 contra prod, solo lectura. Resultados: plan-refactor-motor.md §1.5.
-- Correr: { echo "set default_transaction_read_only = on;"; cat este.sql; } | psql "$SUPABASE_DB_URL" -X
-- Cada consulta de abajo va pegada después de este CTE (un CTE por consulta: una transacción
-- read-only no deja crear vistas temporales).
--
-- Método:
--   edad   = medido_en - publicado_en, en días.
--   vpd    = vistas / greatest(edad, 1)   (piso de 1 día: un reel de 3 horas no se infla 8×).
--   fijado = probable, porque es_fijado no existe todavía (C8): el reel tuvo alguna observación del
--            MOTOR (origen = 'motor', compras desde el 16/09 con filtro de fecha) con más de 50 días.
--            El filtro de Apify frena todo menos los fijados (handoff, 17/10), así que un >50 días
--            comprado por el motor es fijado. Se marca el reel entero, también en el backfill.
--   base   = una fila por (reel, franja): la última observación del reel dentro de esa franja.
--            Así un reel re-comprado 20 veces no pesa 20, y uno visto a los 3 y a los 30 días
--            cuenta una vez en cada franja.

with obs as (
  select plataforma, external_id, handle, vistas, medido_en,
         extract(epoch from medido_en - publicado_en)/86400.0 as edad
  from app.pool_crudo where vistas is not null and publicado_en is not null
),
fij as (select distinct plataforma, external_id from obs o
        where edad > 50 and exists (select 1 from app.pool_crudo p where p.origen = 'motor'
          and p.external_id = o.external_id and p.medido_en = o.medido_en)),
fr as (
  select o.*, case when edad < 7 then '1 <7' when edad < 14 then '2 7-14'
                   when edad < 50 then '3 14-50' else '4 >50' end as franja,
         (f.external_id is not null) as fijado,
         vistas / greatest(edad, 1) as vpd
  from obs o left join fij f using (plataforma, external_id)
),
base as (
  select distinct on (plataforma, external_id, franja) * from fr
  order by plataforma, external_id, franja, medido_en desc
)

-- Q1 · percentiles de vpd por plataforma, franja y fijado
select plataforma, franja, fijado, count(*) n,
 round(percentile_cont(0.25) within group (order by vpd)) p25,
 round(percentile_cont(0.50) within group (order by vpd)) p50,
 round(percentile_cont(0.75) within group (order by vpd)) p75,
 round(percentile_cont(0.90) within group (order by vpd)) p90,
 round(percentile_cont(0.97) within group (order by vpd)) p97,
 round(percentile_cont(0.50) within group (order by vistas)) vistas_p50
from base group by 1,2,3 order by 1,3,2;

-- Q2 · el insight "contra su edad" (cortes por franja). La ETIQUETA es la vara única B (decidido, Mani 18/10):
--   B: case when vpd>=20000 then 'a muy bueno' when vpd>=5000 then 'b bueno' when vpd>=1000 then 'c medio' else 'd bajo' end
select franja,
 case when vpd >= case franja when '1 <7' then 70000 when '2 7-14' then 40000 when '3 14-50' then 20000 else 5000 end then 'a muy bueno'
      when vpd >= case franja when '1 <7' then 22000 when '2 7-14' then 15000 when '3 14-50' then 6000 else 1300 end then 'b bueno'
      when vpd >= case franja when '1 <7' then 7000 when '2 7-14' then 3500 when '3 14-50' then 1500 else 250 end then 'c medio'
      else 'd bajo' end etiqueta,
 count(*)
from base where not fijado group by 1,2 order by 1,2;

-- Q3 · jóvenes (<7 d) con 100k-400k: su etiqueta A y si cruzaron 500k en una medición posterior (>1 día después)
, j as (select b.*, (select max(p.vistas) from app.pool_crudo p
                     where p.external_id = b.external_id and p.medido_en > b.medido_en + interval '1 day') despues
        from base b where not fijado and franja = '1 <7' and vistas between 100000 and 400000)
select case when vpd >= 70000 then 'a muy bueno' when vpd >= 22000 then 'b bueno'
            when vpd >= 7000 then 'c medio' else 'd bajo' end etiqueta,
       count(*) n, count(despues) remedidos, count(*) filter (where despues >= 500000) cruzaron
from j group by 1 order by 1;
