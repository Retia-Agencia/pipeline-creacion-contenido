-- 042_modo_auto_tras_generate.sql — El candado del cortado irrecuperable.
-- Aplicar DESPUÉS de la `041`. SQL Editor de Supabase → pegar → Run.
--
-- Ejecuta [ADR-095 §Enmienda 3](../../docs/adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md).
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- ⚠️ ESTA MIGRACIÓN NO CAMBIA NI UNA FILA NI UNA COLUMNA. Corrige un COMENTARIO, y aun así existe.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- `app.transcripciones.modo` es `text` libre, sin check: el tercer valor entra sin tocar el schema.
-- Lo que sí cambia es lo que la columna SIGNIFICA, y eso hoy está escrito en su propio `comment`:
--
--     'auto | generate: cual de las dos respuestas de Supadata gano por cobertura. ADR-095.'
--
-- Ese comentario es lo que lee el que abre el SQL Editor y no el repo. Dejarlo diciendo que hay dos
-- valores cuando hay tres es la forma más barata de que alguien escriba `where modo = 'auto'` para
-- decir "no se reintentó" y se lleve por delante justo las filas que SÍ se reintentaron y perdieron.
--
-- 📏 **El porqué del tercer valor, con el número.** Hasta ADR-095 §Enmienda 3, `modo` sólo se
-- escribía cuando `generate` GANABA. Tres cosas distintas quedaban escritas `'auto'`:
--
--   · el reintento nunca disparó   (el video estaba sano, o no había duración para juzgarlo)
--   · el reintento disparó y PERDIÓ (`generate` cubrió igual o menos)
--   · el reintento disparó y se cayó (red, 429, timeout)
--
-- El del medio es el caro. El nodo `Transcribir (Supadata)` re-pide todo hit de caché que sea
-- parcial y no diga `'generate'`, y `medir-cobertura.mjs --completar` filtra igual: los dos vuelven
-- a pagar el mismo video **en cada corrida, para siempre**, cuando `generate` ya se probó y no
-- alcanzó. El caso tiene nombre propio desde el 09/09 —`Day8CXdBLwK`, 29.0 s de 45.8 s, sigue
-- cortado DESPUÉS de `generate`— y el comentario de `medir-cobertura.mjs` ya prometía protegerlo,
-- pero el código nunca escribía la marca. La `040` cerró la puerta sólo para los que ganan.
--
-- 🔑 **El tercer desenlace (se cayó) NO marca nada, a propósito.** Una caída de red no es un
-- veredicto sobre el video: ese video merece otro intento. Marcarlo sería convertir un timeout en
-- una sentencia de "irrecuperable".
--
-- 🐤 **Su canario, y por qué nace sucio.** El valor lo escriben el motor, el cockpit y
-- `medir-cobertura.mjs --completar`. La Tarea 9 del plan va a correr ese último sobre los 23
-- cortados de hoy, así que las primeras filas van a ser de esa corrida y NO de uso espontáneo:
--
--     select modo, count(*) from app.transcripciones group by 1;
--
-- Lo que hay que mirar no es que aparezca, sino que el número de `auto_tras_generate` **deje de
-- crecer** sobre los mismos videos corrida a corrida. Si crece, el candado no está agarrando.
--
-- Idempotente: un `comment on column` se puede correr mil veces. Sin backfill: las filas viejas en
-- `'auto'` son correctas —nunca vieron un reintento— y merecen uno.

comment on column app.transcripciones.modo is
  'auto | generate | auto_tras_generate. De donde salio el texto guardado y si generate ya se probo: '
  'auto = una sola llamada; generate = el reintento gano y este texto es suyo; auto_tras_generate = '
  'el reintento se hizo y PERDIO, el texto es el de auto y el video NO se vuelve a pedir. '
  'NULL = fila anterior a ADR-095. ADR-095 y su Enmienda 3.';


-- ═══════════════════════ Verificación (por su efecto, no por haber corrido) ═══════════════════════
--
-- 🔑 Igual que la `041`, ésta NO se puede verificar desde afuera: PostgREST responde idéntico antes
-- y después. Se verifica en el catálogo, que es donde vive lo único que cambió:
--
--     select col_description('app.transcripciones'::regclass, attnum) as comentario
--     from pg_attribute
--     where attrelid = 'app.transcripciones'::regclass and attname = 'modo';
--
-- Tiene que nombrar los TRES valores. Si dice sólo `auto | generate`, la migración no corrió.
