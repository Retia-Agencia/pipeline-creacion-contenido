-- 039_cobertura_transcripts.sql — Que un transcript pueda decir hasta dónde llegó.
-- Aplicar DESPUÉS de la `038`. SQL Editor de Supabase → pegar → Run.
--
-- Ejecuta [ADR-095](../../docs/adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md).
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- EL PORQUÉ, MEDIDO CONTRA PROD Y CONTRA LA API DE SUPADATA EL 2026-09-09
--
-- 7 de 61 guiones transcriptos por Majo el 09/09 (11%) terminan a mitad de frase — el corte viene
-- de Supadata, verificado re-pidiendo el original en inglés y llegando al mismo punto exacto.
-- Cruzando duración contra largo de guion en el motor salieron 9 sospechosos sobre 157 (6%, cota
-- superior). Tres videos verificados con timestamps de Supadata:
--
--   `DaTf9Wqxt8p`  54.0 s · auto cubre 53.2 s / 95 ch   → sano (video callado)
--   `Day8CXdBLwK`  45.8 s · auto cubre 29.0 s / 105 ch  → cortado, irrecuperable (generate igual)
--   `Db9Y_EGulGk` 150.4 s · auto cubre 41.5 s / 642 ch  → cortado, generate lo cubre entero
--
-- Los dos primeros son GEMELOS por largo de texto (95 ch vs 105 ch) y uno está sano y el otro
-- cortado: solo la cobertura en segundos los separa. Un umbral por caracteres quema videos buenos.
--
-- 🔑 EL VEREDICTO NO SE GUARDA, a propósito: se deriva de `cobertura_seg / duracion_seg` al leer.
-- Un booleano guardado pide backfill cada vez que el umbral se mueve; dos números crudos no piden
-- nada. Y hace funcionar al cockpit sin pagar Apify de más: un video transcripto ANTES de que
-- exista su colección guarda su cobertura igual, y el veredicto aparece solo cuando la duración
-- llega. El umbral mismo queda sin número acá: sale del histograma de la Tarea 3 del plan.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Idempotente: `add column if not exists`. Aditiva, sin backfill de datos derivados. Los ceros
-- iniciales son la verificación, igual que en la `036` y la `038`.

alter table app.transcripciones
  add column if not exists cobertura_seg numeric,
  add column if not exists duracion_seg  numeric,
  add column if not exists modo          text;

alter table app.candidatos  add column if not exists cobertura_seg numeric;
alter table app.videos_meta add column if not exists duracion_seg  numeric;

comment on column app.transcripciones.cobertura_seg is
  'Hasta que segundo del video llega el transcript (ultimo offset + duration, de los segmentos de '
  'Supadata). NULL = no se midio. El veredicto parcial NO se guarda: se deriva contra duracion_seg. ADR-095.';
comment on column app.transcripciones.modo is
  'auto | generate: cual de las dos respuestas de Supadata gano por cobertura. ADR-095.';


-- ═══════════════════════ La RPC que el motor usa como caché ═══════════════════════
--
-- `create or replace` sobre la firma existente (ADR-087, migración 037): agrega las dos columnas
-- nuevas al `returns table`. La RPC sigue tonta — no filtra por umbral, solo entrega los números;
-- si el umbral cambia, no se toca SQL.

create or replace function app.cache_transcripts(p_instance uuid, p_ids text[])
returns table (external_id text, plataforma text, estado text, script text, idioma text,
               cobertura_seg numeric, duracion_seg numeric)
language sql stable security invoker set search_path = app, public
as $fn$
  select t.external_id, t.plataforma::text, t.estado, t.script, t.idioma,
         t.cobertura_seg, t.duracion_seg
  from app.transcripciones t
  where t.instance_id = p_instance
    and t.external_id = any(p_ids)
    and t.estado in ('listo', 'sin_transcript')
$fn$;

-- 🩸 Los dos `grant` van EXPLÍCITOS aunque la función ya existiera. `create or replace` sobre una
-- función CONSERVA sus privilegios, pero si alguien la dropea y la recrea no lo hace — y ese modo
-- de falla es mudo: `42501` tragado por el `onError: continueRegularOutput` del nodo, corrida en
-- verde sin caché, re-pagándole a Supadata en silencio. Cuestan nada, van igual (ADR-087 §3).
grant execute on function app.cache_transcripts(uuid, text[]) to service_role;
grant execute on function app.cache_transcripts(uuid, text[]) to authenticated;


-- ═══════════════════════ Verificación (por efecto, no por haber corrido) ═══════════════════════
--
-- Correr esto DESPUÉS y pegar el resultado en el handoff:
--
--   select
--     (select count(*) from app.transcripciones)                              as filas,
--     (select count(cobertura_seg) from app.transcripciones)                  as con_cobertura,
--     (select count(cobertura_seg) from app.candidatos)                       as cand_con_cobertura,
--     (select count(duracion_seg)  from app.videos_meta)                      as meta_con_duracion;
--
-- Esperado JUSTO DESPUÉS de aplicar: con_cobertura = 0 · cand_con_cobertura = 0 ·
-- meta_con_duracion = 0. Los tres ceros son el dato: prueban que el "sin backfill" es un hecho
-- medido y no una intención.
--
-- Quinta señal, la que puede fallar sola por caché de esquema vieja:
--
--   set -a && source .env && set +a
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
--     -H "Accept-Profile: app" \
--     "$SUPABASE_URL/rest/v1/transcripciones?select=cobertura_seg,duracion_seg,modo&limit=1"
--   -- Esperado: 200 (si da PGRST204, notify pgrst, 'reload schema')
--
-- Sexta, por el camino real de la RPC (la que el motor usa):
--
--   IID=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
--     "$SUPABASE_URL/rest/v1/instances?select=id&limit=1" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
--   curl -s -X POST -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
--     -H "Content-Profile: app" -H "content-type: application/json" \
--     -d "{\"p_instance\":\"$IID\",\"p_ids\":[\"3932627455294496553\"]}" \
--     "$SUPABASE_URL/rest/v1/rpc/cache_transcripts"
--   -- Esperado: 200 y las filas con las dos columnas nuevas.
--
-- 🐤 Canario: `select count(cobertura_seg) from app.transcripciones` nace en CERO por definición
-- (esta migración no backfillea nada). La primera fila la escribe el motor la próxima vez que
-- transcriba, no una verificación manual.
