-- Curva del reel JOVEN (M1-bis, plan-refactor-motor §1.4). Medido el 2026-09-15 sobre app.pool_crudo.
-- Solo lee, cuesta 0. Correr en el SQL Editor. Resultados de ese día en los comentarios.
--
-- Método: por reel, primera y ÚLTIMA observación (gap >= 1 día). La edad es la de la PRIMERA compra.
-- Sesgo conocido: solo hay pares de cuentas que se re-compraron, y el gap varía por tramo
-- (mediana 5 a 22 días), así que "crec_pct_por_dia" es una normalización lineal y cruda.

-- Q1 · crecimiento por edad al comprarlo
with o as (
  select external_id, publicado_en, medido_en, vistas,
         row_number() over (partition by external_id order by medido_en) rn_a,
         row_number() over (partition by external_id order by medido_en desc) rn_d
  from app.pool_crudo where plataforma='instagram' and vistas > 0 and publicado_en is not null),
p as (
  select extract(epoch from a.medido_en - a.publicado_en)/86400 edad0,
         extract(epoch from d.medido_en - a.medido_en)/86400 gap,
         a.vistas v0, d.vistas v1
  from o a join o d on d.external_id=a.external_id and d.rn_d=1
  where a.rn_a=1)
select case when edad0<1 then '0-1d' when edad0<2 then '1-2d' when edad0<3 then '2-3d'
            when edad0<5 then '3-5d' when edad0<7 then '5-7d' when edad0<14 then '7-14d'
            when edad0<30 then '14-30d' else '30d+' end tramo,
       count(*) n,
       round(percentile_cont(0.5) within group (order by gap)::numeric,1) gap_med_dias,
       round(percentile_cont(0.5) within group (order by (v1::numeric/v0 - 1)*100)::numeric,1) crec_med_pct,
       round(percentile_cont(0.9) within group (order by (v1::numeric/v0 - 1)*100)::numeric,1) crec_p90_pct,
       round(percentile_cont(0.5) within group (order by ((v1::numeric/v0 - 1)*100)/gap)::numeric,2) crec_pct_por_dia
from p where gap >= 1
group by 1 order by min(edad0);
-- 2026-09-15:
-- 0-1d    n=92    gap 15.6  med +110.3%  p90 +1510.4%  11.96%/d
-- 1-2d    n=109   gap 14.0  med  +27.1%  p90  +212.0%   2.92%/d
-- 2-3d    n=85    gap 14.0  med  +19.8%  p90  +191.6%   2.22%/d
-- 3-5d    n=162   gap 11.9  med  +14.8%  p90   +52.2%   1.43%/d
-- 5-7d    n=150   gap  4.9  med   +7.5%  p90   +32.1%   1.13%/d
-- 7-14d   n=308   gap 15.6  med   +4.4%  p90   +65.3%   0.74%/d
-- 14-30d  n=466   gap  7.6  med   +1.0%  p90  +142.6%   0.19%/d
-- 30d+    n=1608  gap  4.9  med   +0.1%  p90    +2.1%   0.02%/d

-- Q2 · cuántos que estaban bajo 400k cruzaron después, por edad y banda
with o as (
  select external_id, publicado_en, medido_en, vistas,
         row_number() over (partition by external_id order by medido_en) rn_a,
         row_number() over (partition by external_id order by medido_en desc) rn_d
  from app.pool_crudo where plataforma='instagram' and vistas > 0 and publicado_en is not null),
p as (
  select extract(epoch from a.medido_en - a.publicado_en)/86400 edad0,
         extract(epoch from d.medido_en - a.medido_en)/86400 gap, a.vistas v0, d.vistas v1
  from o a join o d on d.external_id=a.external_id and d.rn_d=1 where a.rn_a=1)
select case when edad0<3 then 'a) 0-3d' when edad0<7 then 'b) 3-7d' else 'c) 7d+' end edad,
       case when v0<50000 then '1) <50k' when v0<100000 then '2) 50-100k' when v0<200000 then '3) 100-200k'
            when v0<300000 then '4) 200-300k' when v0<400000 then '5) 300-400k' else '6) >=400k' end banda,
       count(*) n, count(*) filter (where v0<400000 and v1>=400000) cruzaron_400k,
       round(percentile_cont(0.5) within group (order by gap)::numeric,1) gap_med
from p where gap>=1 group by 1,2 order by 1,2;
-- 2026-09-15 (n / cruzaron):
-- 0-3d:  <50k 206/4 · 50-100k 35/1 · 100-200k 19/3 · 200-300k 10/5 · 300-400k 3/2
-- 3-7d:  <50k 204/0 · 50-100k 42/0 · 100-200k 21/2 · 200-300k 18/1 · 300-400k 4/1
-- 7d+:   <50k 1019/7 · 50-100k 271/0 · 100-200k 259/9 · 200-300k 164/8 · 300-400k 114/6

-- Segunda señal (Apify en vivo, run JrdYsvf52nlFdhrNt, 6 x 0.0023 = 0.0138 USD, 6 reels por URL con
-- resultsType=posts, resultsLimit=1): el "revivido" de askvinh 3940928519745102729 tenía 609.730 y
-- hoy 626.269; jen_gottlieb 3970801575865573889 1.301.672 -> 1.354.142. Controles maduros casi quietos:
-- trademachineoff 880.654 -> 881.157, _abtrades 294.568 -> 294.428.
