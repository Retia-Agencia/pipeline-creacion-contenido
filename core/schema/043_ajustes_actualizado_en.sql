-- 043_ajustes_actualizado_en.sql — Que la columna deje de significar "última vez por el cockpit".
-- Aplicar DESPUÉS de la `042`. SQL Editor de Supabase → pegar → Run.
--
-- Ejecuta [ADR-097](../../docs/adr/ADR-097-actualizado-en-lo-sella-la-base-no-el-que-escribe.md).
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 🩸 EL BUG, medido el 2026-09-10 y no deducido.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- `app.ajustes.actualizado_en` es `timestamptz not null default now()`, y un `default` **sólo
-- dispara en INSERT**. No hay ningún trigger: `pg_trigger` devuelve CERO triggers no-internos sobre
-- la tabla (los únicos dos del esquema entero son `clients_sin_ciclos` y `outputs_hereda_instancia`,
-- los de la `035`). Lo único que mantenía viva esa columna era el cockpit, que la escribe a mano en
-- `apps/dashboard/lib/ajustes.ts` (`guardarAjuste`).
--
-- O sea que la columna **no significa "cuándo cambió el knob"**: significa *"cuándo lo tocó alguien
-- desde el cockpit"*. Nadie la lee así. Cualquier escritura por SQL mueve `valor` y deja el
-- timestamp donde estaba, en silencio y en verde.
--
-- 📏 El cierre 148 movió dos knobs por SQL. Al día siguiente, la tabla decía esto:
--
--     Días de recencia                    = 50   · actualizado_en = 2026-08-31 11:15
--     Resultados por cuenta de referente  = 25   · actualizado_en = 2026-09-01 10:54
--
-- Las dos con el valor NUEVO y el timestamp de diez días antes. Son las dos señales independientes
-- del mismo hecho: el catálogo (no hay trigger) y el efecto (valor nuevo, fecha vieja).
--
-- 🔑 Por qué no alcanza con "cambiá los knobs desde /curar/ajustes". Eso no es una decisión, es
-- confiar en que nadie use SQL, y en dos semanas ya pasó dos veces. Un dato que depende de que el
-- escritor se acuerde no es un dato: es una costumbre. La base es el único punto por el que pasan
-- TODOS los escritores.
--
-- ⚠️ Lo que este trigger NO arregla, y hay que decirlo: la fila de `app.eventos` sigue sin
-- escribirse. El evento necesita un `usuario_id` y un SQL no tiene uno — no hay forma de inventarlo
-- desde la base. Escribir por SQL sigue siendo invisible para la auditoría; lo que deja de ser
-- invisible es el CUÁNDO.
-- ─────────────────────────────────────────────────────────────────────────────────────────────


-- ═══════════ 1 · El re-sellado, ANTES del trigger (el orden es la simplificación) ════════════════
--
-- Va primero a propósito: con el trigger ya puesto habría que apagarlo para poder escribir una
-- fecha histórica, y un `disable trigger` / `enable trigger` es un paso más que puede quedar a
-- mitad. Arreglar el dato y después poner el candado no necesita ninguna de las dos cosas.
--
-- 🔑 La fecha que se pone es el DÍA, no la hora, y eso no es descuido: **la hora no existe**. El
-- cambio se hizo por SQL el 2026-09-10 (cierre 148) y nadie lo registró, que es exactamente el
-- agujero que tapa el trigger de abajo. `runs.params.ajustes` va a darla de acá en adelante — ese
-- nodo (`Etapa: colecta`, commit `2f7c427`) SÍ está en el live desde el 11/09 01:05 UTC — pero llegó
-- después de la última corrida: las 6 del 10/09 tienen `params->'ajustes'` en null.
--
-- Se elige el arranque del día y no `now()` porque `now()` sería el día EQUIVOCADO (el de la
-- migración), y 00:00 del 10/09 es una cota inferior demostrable: el cambio fue ese día. Inventar
-- una hora sería peor que perderla.
--
-- Idempotente y guardado por el timestamp viejo: si alguien ya movió el knob después, no lo toca.

update app.ajustes
   set actualizado_en = timestamptz '2026-09-10 00:00:00+00'
 where clave = 'Días de recencia'
   and actualizado_en = timestamptz '2026-08-31 11:15:52.683+00';

update app.ajustes
   set actualizado_en = timestamptz '2026-09-10 00:00:00+00'
 where clave = 'Resultados por cuenta de referente'
   and actualizado_en = timestamptz '2026-09-01 10:54:00.016+00';


-- ═══════════ 2 · El candado: lo sella la base, no el que escribe ═════════════════════════════════
--
-- `set search_path` desde el día uno, que es la lección de la `035` (ADR-085): un trigger que
-- resuelve nombres contra el camino de quien lo dispara es un aviso de `get_advisors` esperando a
-- nacer. Acá además no hace falta calificar ninguna tabla — el cuerpo sólo toca `new`.

create or replace function app.ajustes_sella_actualizado_en()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_temp'
as $function$
begin
  -- Se sella SIEMPRE, incluso si el UPDATE trae su propio `actualizado_en`. Es a propósito: el
  -- cockpit ya lo manda (`guardarAjuste`) y su valor y `now()` difieren en milisegundos, así que
  -- pisarlo no cambia nada para él, y en cambio saca del medio la única forma de mentir con la
  -- fecha. Un backfill histórico legítimo puede apagar el trigger a mano; el camino normal no.
  new.actualizado_en := now();
  return new;
end
$function$;

drop trigger if exists ajustes_sella_actualizado_en on app.ajustes;

create trigger ajustes_sella_actualizado_en
  before update on app.ajustes
  for each row
  execute function app.ajustes_sella_actualizado_en();

comment on column app.ajustes.actualizado_en is
  'Cuando cambio la fila por ULTIMA vez, lo sella la base (trigger ajustes_sella_actualizado_en, '
  'ADR-097). Antes de la 043 solo lo escribia el cockpit, asi que un UPDATE por SQL lo dejaba '
  'viejo: el valor cambiaba y la fecha no. NO dice QUIEN cambio: eso vive en app.eventos y una '
  'escritura por SQL no deja evento.';


-- ═══════════════════════ Verificación (por su efecto, no por haber corrido) ═══════════════════════
--
-- 1 · El trigger existe y está prendido. Tiene que devolver UNA fila con `tgenabled = 'O'`:
--
--     select tgname, tgenabled from pg_trigger
--     where tgrelid = 'app.ajustes'::regclass and not tgisinternal;
--
-- 2 · 🔑 LA SEÑAL QUE IMPORTA, porque es la que falla sola: que el trigger SELLE de verdad. Un
--     trigger creado y no disparando se ve idéntico a uno que anda. Se prueba con un no-op, dentro
--     de una transacción que se revierte, así que no deja rastro:
--
--     begin;
--       select clave, actualizado_en as antes from app.ajustes where clave = 'Mínimo de likes';
--       update app.ajustes set valor = valor where clave = 'Mínimo de likes';
--       select clave, actualizado_en as despues from app.ajustes where clave = 'Mínimo de likes';
--     rollback;
--
--     `despues` tiene que ser HOY aunque el UPDATE no haya cambiado ni un valor. Si sale igual que
--     `antes`, el trigger no está agarrando y la columna sigue mintiendo.
--
-- 3 · Las dos filas re-selladas:
--
--     select clave, valor, actualizado_en from app.ajustes
--     where clave in ('Días de recencia', 'Resultados por cuenta de referente');
--
--     Las dos en `2026-09-10 00:00:00+00`, con `valor` 50 y 25.
--
-- 4 · Que no se haya sumado un aviso nuevo: `get_advisors` tiene que seguir en **7**. Si sube a 8
--     con un `function_search_path_mutable`, el `set search_path` de arriba no quedó.
