# ADR-097 — `actualizado_en` lo sella la base, no el que escribe

- **Estado:** aceptada — 2026-09-10 (pedido de Mani).
  **Toca `core/`**: migración [`043`](../../core/schema/043_ajustes_actualizado_en.sql).
  Alcance deliberadamente chico: **una tabla, `app.ajustes`**. Las otras 8 columnas
  `actualizado_en` del esquema quedan como están hasta que alguna muerda.

## Contexto

Mani, 2026-09-10: *"revisar por qué `ajustes.actualizado_en` no refleja el cambio de hoy"*.

El cierre 148 movió dos knobs (`Días de recencia` 200 → 50, `Resultados por cuenta de referente`
150 → 25) y lo hizo **por SQL**. Al día siguiente la tabla decía esto:

| clave | valor | actualizado_en |
|---|---|---|
| Días de recencia | **50** | 2026-08-31 11:15 |
| Resultados por cuenta de referente | **25** | 2026-09-01 10:54 |

Las dos con el valor nuevo y el timestamp de diez días antes.

### La causa, con dos señales independientes

1. **Catálogo.** `app.ajustes.actualizado_en` es `timestamptz not null default now()`, y un
   `default` **sólo dispara en INSERT**. `pg_trigger` devuelve **cero triggers no-internos** sobre
   la tabla: los únicos dos del esquema entero son `clients_sin_ciclos` y `outputs_hereda_instancia`,
   los que la [`035`](../../core/schema/035_search_path_triggers.sql) le fijó el `search_path`.
2. **Efecto.** Las dos filas de arriba: valor nuevo, fecha vieja.

Lo único que mantenía esa columna viva era el cockpit, que la escribe **a mano** en
`apps/dashboard/lib/ajustes.ts` (`guardarAjuste`).

### 🔑 El hallazgo ordenador

**La columna no significa lo que su nombre dice.** Hoy significa *"la última vez que alguien tocó
esta fila desde el cockpit"*, y nadie la lee así — la lee el que abre el SQL Editor y pregunta
*"¿cuándo cambió esto?"*, que es literalmente cómo apareció este bug.

Y el modo de falla es el caro: **silencioso y en verde**. Una escritura por SQL mueve `valor`, deja
la fecha y no rompe nada. La fila queda internamente inconsistente y el único que se entera es
alguien que compare la fecha contra una memoria.

📏 Dato que ajusta la urgencia hacia abajo, y por eso va acá: **hoy la columna no se renderiza en
ninguna pantalla**. `leerAjustes` la selecciona y la parsea con zod, y ahí muere. Su único consumidor
es un humano con SQL. Eso no la hace menos falsa; la hace menos urgente.

## Decisión

Un trigger `before update` en `app.ajustes` que sella `new.actualizado_en := now()`, **siempre**.

```sql
create or replace function app.ajustes_sella_actualizado_en()
returns trigger language plpgsql
set search_path to 'app', 'public', 'pg_temp'
as $$ begin new.actualizado_en := now(); return new; end $$;
```

Tres cosas que no son obvias y son la decisión:

- **`set search_path` desde el día uno.** Es la lección de la `035` / [ADR-085](./ADR-085-un-trigger-resuelve-sus-tablas-contra-un-camino-fijo.md):
  un trigger que resuelve nombres contra el camino de quien lo dispara es un aviso de `get_advisors`
  esperando a nacer. Poner el aviso y arreglarlo después son dos migraciones donde va una.
- **Se sella aunque el UPDATE traiga su propio `actualizado_en`.** El cockpit ya lo manda, y su valor
  y `now()` difieren en milisegundos, así que pisarlo no le cambia nada. Lo que saca del medio es la
  única forma de mentir con la fecha. Un backfill histórico legítimo puede apagar el trigger a mano;
  el camino normal no puede.
- **La base es el punto de paso, no el escritor.** Esa es toda la decisión: el cockpit, un SQL del
  SQL Editor, un script y PostgREST son cuatro escritores y sólo uno se acordaba. Poner la regla
  donde pasan los cuatro es lo único que no depende de que alguien se acuerde.

### El re-sellado de las dos filas, y por qué la hora no está

La `043` también corrige las dos filas que quedaron mintiendo, **a `2026-09-10 00:00:00+00`: el día,
no la hora**.

La hora **no existe**. El cambio se hizo por SQL y nadie lo registró, que es el agujero que tapa el
trigger. `runs.params.ajustes` va a dar la ventana exacta de acá en adelante — ese nodo
(`Etapa: colecta`, commit `2f7c427`) **sí está en el live**, empujado el 11/09 a las 01:05 UTC — pero
llegó **después** de la última corrida: las 6 del 10/09 tienen `params->'ajustes'` en null, así que
para este cambio no sirve. *Verificado leyendo el nodo por la API de n8n, no el `n8n:diff`.*

Se elige el arranque del día y no `now()` porque `now()` sería el **día equivocado** (el de la
migración), y 00:00 del 10/09 es una cota inferior demostrable. *Inventar una hora sería peor que
perderla.*

## Alternativas descartadas

| alternativa | por qué no |
|---|---|
| **Dejarla y "cambiar los knobs siempre desde `/curar/ajustes`"** | No es una decisión, es confiar en que nadie use SQL. En dos semanas ya pasó dos veces (el cierre 148 y el rescate de los topes del 01/09). Un dato que depende de que el escritor se acuerde no es un dato: es una costumbre. |
| **Sólo re-sellar las dos filas** | Arregla el síntoma de hoy. El próximo `update` por SQL vuelve a mentir, y la próxima vez nadie va a estar mirando. |
| **Poner el trigger en las 9 tablas que tienen `actualizado_en`** | Ninguna de las otras 8 mordió todavía, y un trigger por tabla es superficie que hay que mantener. Esta migración existe porque hay un caso medido, no porque la forma sea linda. Cuando otra muerda, se copia. |
| **Que el evento de `app.eventos` cubra el "cuándo"** | No puede: el evento necesita `usuario_id` y un SQL no tiene uno. Son dos preguntas distintas (*cuándo* y *quién*) y esta ADR contesta una sola. |

## Cómo se verifica

Por efecto, no por haber corrido. Las cuatro consultas están en la propia migración; **la que
importa es la segunda**, porque es la que puede fallar sola: un trigger creado y no disparando se ve
idéntico a uno que anda.

```sql
begin;
  select actualizado_en as antes   from app.ajustes where clave = 'Mínimo de likes';
  update app.ajustes set valor = valor where clave = 'Mínimo de likes';
  select actualizado_en as despues from app.ajustes where clave = 'Mínimo de likes';
rollback;
```

`despues` tiene que ser hoy **aunque el UPDATE no haya cambiado ni un valor**.

Y `get_advisors` tiene que seguir en **7**. Si sube a 8 con un `function_search_path_mutable`, el
`set search_path` no quedó.

## Lo que esta ADR NO arregla

**Escribir por SQL sigue siendo invisible para la auditoría.** `app.eventos` no va a tener la fila,
porque no hay `usuario_id` que inventar desde la base. Lo que deja de ser invisible es el *cuándo*,
no el *quién*.
