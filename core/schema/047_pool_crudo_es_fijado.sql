-- 047_pool_crudo_es_fijado.sql - Conserva si Apify marco cada observacion como reel fijado.
-- Aplicar DESPUES de la `046`. SQL Editor de Supabase -> pegar -> Run.
--
-- Ejecuta el ticket C8 de
-- [07-refactor-tickets.md](../../docs/virlo/07-refactor-tickets.md) y enmienda
-- [ADR-103](../../docs/adr/ADR-103-apify-vigila-el-roster-virlo-busca-y-la-edad-no-descarta.md).
--
-- EL PORQUE
-- 1. Los reels fijados representan el 21 % del gasto observado, pero `pool_crudo` no conserva la
--    marca que permite medir si ocupan cupo de `resultsLimit`.
-- 2. La evidencia cruda distingue `false` (Apify dijo que no esta fijado) de `null` (no se sabe).
--
-- ORDEN: se aplica ANTES del `n8n:push` de `Preparar pool crudo` y antes de correr
-- `backfill-pool-crudo.mjs`. PostgREST rechaza un lote con una columna que no existe y el nodo es
-- sumidero: perderia las filas en silencio mientras la corrida queda en verde.
--
-- Aditiva e idempotente. Sin backfill.

alter table app.pool_crudo
  add column if not exists es_fijado boolean;

comment on column app.pool_crudo.es_fijado is
  'true = Apify lo marcó isPinned; false = vino y no está fijado; null = no se sabe (filas anteriores a la 047, o el actor no trajo el campo).';
