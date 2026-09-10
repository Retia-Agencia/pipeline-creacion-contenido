-- 040_cache_modo.sql — Que el caché diga CÓMO se consiguió cada transcript.
-- Aplicar DESPUÉS de la `039`. SQL Editor de Supabase → pegar → Run.
--
-- Ejecuta [ADR-095](../../docs/adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md)
-- §3.1 (el review final de `plan-transcript-completo.md`).
--
-- ⛔⛔ **EL `n8n:push` DEL MOTOR NO SE PUEDE HACER HASTA QUE ESTA MIGRACIÓN ESTÉ APLICADA.** El nodo
-- `Transcribir (Supadata)` ya lee `r.modo` de las filas del caché. Sin esta migración la RPC no
-- devuelve esa columna, `r.modo` llega `undefined`, y el nodo vuelve al comportamiento de antes: un
-- parcial irrecuperable se re-pide en cada corrida. No rompe nada (fail-open), pero el arreglo NO
-- existe hasta que esto corra. Mismo orden que exigieron la `037`, la `016` y la `014`.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- EL PORQUÉ: SIN ESTO, EL ARREGLO DE LA TAREA 5 NO PERSISTE NUNCA
--
-- La Tarea 5 hizo que un hit de caché con cobertura PARCIAL caiga a `pendientes` y se vuelva a
-- transcribir (auto + `generate`). El motor consigue un transcript mejor... y `POST Transcripciones`
-- lo tira: manda `Prefer: resolution=ignore-duplicates`, y la fila ya existe. O sea que cada corrida
-- futura vuelve a pedir el mismo video, vuelve a pagar, y vuelve a descartar la mejora. Sin tope.
--
-- 🔑 El arreglo NO es `merge-duplicates`. El `on_conflict` de esa tabla es
-- `(instance_id, plataforma, external_id)` y las filas MANUALES de Majo comparten ese espacio de
-- llaves (`app.transcripciones` tiene dos dueños desde la `037`: `manual` y `motor`). Un upsert del
-- motor con merge podría pisarle su transcripción a la persona que lo transcribió a mano. La
-- pregunta correcta no es "cómo escribo encima" sino "cómo dejo de pedirlo": si el video ya se
-- completó una vez con `generate` —el techo de Supadata— y siguió corto, es IRRECUPERABLE y no hay
-- nada que ganar volviendo a pedirlo. `Day8CXdBLwK` (29.0 s de 45.8 s) es el caso medido y
-- documentado: `generate` no lo mejora.
--
-- Ese criterio ya estaba escrito en `Workflows/workflow-short-form-content/medir-cobertura.mjs`
-- (el filtro `r.modo !== 'generate'` de las candidatas de `--completar`). Lo único que faltaba era
-- que el motor pudiera VERLO: `modo` existe en la tabla desde la `039`, pero la RPC del caché no lo
-- devuelve. Esta migración lo agrega y nada más.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ CORRÉS ESTE ARCHIVO ENTERO, DE UN SAQUE. El `drop` + `create` + los dos `grant` son una sola
-- cosa: si se corre a medias, queda la función vieja borrada y ninguna nueva.

-- 🩸 `create or replace` NO ALCANZA para cambiar las columnas de un `returns table`: PostgreSQL
-- responde `ERROR: cannot change return type of existing function / HINT: Use DROP FUNCTION
-- app.cache_transcripts(uuid,text[]) first.` Es exactamente lo que ya pasó en la `039`, que es de
-- donde sale la forma de este archivo. La firma (`uuid, text[]`) es la misma desde la `037`, así
-- que el `drop` apunta exacto a la función vieja y no puede llevarse otra por error.
drop function if exists app.cache_transcripts(uuid, text[]);

create or replace function app.cache_transcripts(p_instance uuid, p_ids text[])
returns table (external_id text, plataforma text, estado text, script text, idioma text,
               cobertura_seg numeric, duracion_seg numeric, modo text)
language sql stable security invoker set search_path = app, public
as $fn$
  select t.external_id, t.plataforma::text, t.estado, t.script, t.idioma,
         t.cobertura_seg, t.duracion_seg, t.modo
  from app.transcripciones t
  where t.instance_id = p_instance
    and t.external_id = any(p_ids)
    and t.estado in ('listo', 'sin_transcript')
$fn$;

-- ⚠️ El `drop` SE LLEVA LOS PRIVILEGIOS de la función, así que estos dos van sí o sí junto al
-- `create`. No evitan un `42501` por sí solos —Postgres le da `EXECUTE` a `PUBLIC` por defecto y
-- Supabase no lo revoca a nivel de cluster (medido contra prod el 09/09, ver la `039` y ADR-087
-- §Enmienda)— pero hacen el acceso EXPLÍCITO e independiente de `PUBLIC`: el día que alguien la
-- endurezca como la `021` endureció `instancias_visibles`, el motor sigue funcionando.
grant execute on function app.cache_transcripts(uuid, text[]) to service_role;
grant execute on function app.cache_transcripts(uuid, text[]) to authenticated;


-- ═══════════════════════ Verificación (por efecto, no por haber corrido) ═══════════════════════
--
-- Por el camino REAL del motor (la RPC por PostgREST), que es la pata capaz de fallar sola por
-- caché de esquema vieja:
--
--   set -a && source .env && set +a
--   IID=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
--     "$SUPABASE_URL/rest/v1/instances?select=id&limit=1" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
--   curl -s -X POST -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
--     -H "Content-Profile: app" -H "content-type: application/json" \
--     -d "{\"p_instance\":\"$IID\",\"p_ids\":[\"3932627455294496553\"]}" \
--     "$SUPABASE_URL/rest/v1/rpc/cache_transcripts"
--   -- Esperado: 200 y cada fila con la clave `modo` (si da PGRST202/PGRST204, notify pgrst, 'reload schema')
--
-- Y que el privilegio sobrevivió al `drop` (esta sí falla muda si no está):
--
--   select has_function_privilege('service_role',   'app.cache_transcripts(uuid, text[])', 'execute'),
--          has_function_privilege('authenticated',  'app.cache_transcripts(uuid, text[])', 'execute');
--   -- Esperado: true, true
--
-- 🐤 Canario: esta migración no crea datos nuevos, así que no tiene uno propio. El que dice si el
-- arreglo sirvió es un LOG del motor: `[Transcribir] cache: ... (N hits con cobertura parcial se
-- re-piden)`. Ese N tiene que DEJAR DE CRECER corrida a corrida sobre los mismos videos — hoy crece
-- para siempre.
