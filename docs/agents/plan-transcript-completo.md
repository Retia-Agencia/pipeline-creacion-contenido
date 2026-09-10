# Plan — Que un transcript cortado no pueda pasar por completo

> **Para agentes:** este plan se ejecuta tarea por tarea con
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`. Los pasos usan
> checkbox (`- [ ]`) para llevar la cuenta.

**Objetivo:** que ni el motor ni el cockpit puedan entregar un guion incompleto **creyendo que está
completo**. No es "que Supadata no falle": el corte pasa adentro de su ASR y no lo controlamos. Lo
que sí se controla es que el sistema **sepa** cuánto del video llegó, lo reintente una vez cuando
falta, y guarde el número para que alguien pueda volver a medir.

**Decisión que lo gobierna:** ADR-095 (a escribir en la Tarea 1). Contexto obligatorio antes de
tocar nada: [ADR-009](../adr/ADR-009-scripts-literales-y-aprendizaje-en-scoring.md) (guion literal, mismo texto en las dos puntas),
[ADR-087](../adr/ADR-087-la-memoria-recuerda-lo-que-se-entrego-no-lo-que-se-evaluo.md) (el caché de
ASR, que es lo que hoy congela los cortes), [ADR-086](../adr/ADR-086-la-identidad-de-un-video-no-es-la-de-su-post.md) (`duracion_seg`, que ya existe) y
[ADR-089](../adr/ADR-089-una-sola-metrica-aprobados-contra-lo-pedido.md) (la métrica contra la que
se juzga si esto sirvió).

---

## 1 · Lo medido (2026-09-09, contra prod y contra la API de Supadata)

Nada de acá es estimación. Los comandos que lo produjeron están en el cierre de sesión.

**El síntoma.** De los 61 guiones que Majo transcribió el 09/09, **7 terminan a mitad de frase**
(11%). Se verificó que el corte **ya viene de Supadata**: al re-pedir el original en inglés, termina
en el mismo punto exacto que el español guardado (`…your job your identity`, `…i hope`). No lo hace
el pipeline.

**No es Haiku ni son los créditos.** La key contesta `200` hoy, y los 61 guiones del día volvieron
**en español**, o sea que la traducción corrió en los 61. Quedarse sin créditos produce, por el
fail-open de `lib/transcribir.ts`, *texto completo en inglés* — nunca *texto a medias*.

**El `206` de los logs de Supadata es otra cosa.** En su tabla de errores `206` significa
**"Transcript Unavailable: no hay transcript para este video"**, no *partial content*. Corresponde a
la única fila `sin_transcript` del día. El código ya lo maneja bien.

**El motor tiene el mismo problema.** Cruzando `app.candidatos.duracion_seg` contra el largo del
guion salieron **9 sospechosos sobre 157 (6%)** — cota superior, no tasa: el cruce por caracteres no
distingue un video callado de uno cortado. Tres verificados contra Supadata pidiendo timestamps:

| video | duración | `auto` cubre | `generate` cubre | veredicto |
|---|---|---|---|---|
| `DaTf9Wqxt8p` | 54.0 s | 53.2 s / 95 ch | 39.0 s / 2 ch | **sano** — video callado |
| `Day8CXdBLwK` | 45.8 s | 29.0 s / 105 ch | 29.0 s / 105 ch | **cortado**, irrecuperable |
| `Db9Y_EGulGk` | 150.4 s | 41.5 s / 642 ch | 150.2 s / 2790 ch | **cortado**, `generate` lo salva entero |

🔑 **La fila 1 es la que define el diseño.** `DaTf9Wqxt8p` (95 ch en 54 s) y `Day8CXdBLwK` (105 ch en
45.8 s) son **gemelos por largo de texto** y uno está sano y el otro cortado. **Solo la cobertura en
segundos los separa.** Cualquier umbral por cantidad de caracteres quema videos buenos, que es
exactamente la pérdida que mide ADR-089.

**Detectar es gratis.** Pidiéndole a Supadata los segmentos (sin `text=true`) devuelve `offset` +
`duration` por línea. Verificado que `' '.join(seg.text)` es **idéntico carácter por carácter** al
`text=true` (403 = 403): cambiar de modo no rompe el invariante de ADR-009 ni cuesta un crédito más.

**Un reintento alcanza, y el segundo es plata tirada.** 5 llamadas seguidas de `generate` sobre los
tres videos: 15 de 15 idénticas. Cuando `generate` completa, completa al primero; cuando no
(`Day8CXdBLwK`), no completa nunca.

**El caché está congelando los cortes AHORA.** `app.transcripciones` con `origen = 'motor'` ya tiene
**584 `listo` + 30 `sin_transcript`**, y `app.cache_transcripts` los devuelve para siempre. Cada
corrida desde el 01/09 graba en piedra transcripts cortados que el motor **no va a volver a pedir**.

**La duración ya está adentro del motor.** `Normalizar IG` y `Normalizar TT` producen
`duracion_video`, y las dos son **ancestros** de `Transcribir (Supadata)` — verificado con el mismo
criterio de ancestría de `auditar-workflows.mjs` §2, que es la clase de bug de ADR-029. No hace
falta ni una llamada nueva ni un campo nuevo: hay que cablearlo.

**Costos, medidos en las APIs, no estimados.** Supadata factura `auto` = 1 crédito y `generate` = 2
(header `x-billable-requests`). Con un **supuesto de 15% de cortados** —a confirmar en la Fase 1, no medido— el promedio queda en **1.3 créditos/video**
contra 2.0 si se pasara todo a `generate`: auto-primero es **35% más barato** *y* mejor, porque
`generate` a veces cubre menos. Sobre una corrida de 280 videos son **+80 créditos** ($0.13–$0.45
según plan). `apify/instagram-scraper` cobra **$0.0023 por resultado** (cuenta STARTER): 60 videos =
**$0.14**.

---

## 2 · La idea que ordena todo: medir siempre, juzgar cuando se pueda

`cobertura_seg` se guarda **siempre**, porque viene gratis en la misma respuesta que ya se paga.
El veredicto *"esto está cortado"* **no se guarda**: se deriva de `cobertura_seg / duracion_seg` en
el momento de leer.

Dos razones, las dos con consecuencia práctica:

1. **El umbral va a cambiar.** Un booleano guardado pide un backfill cada vez que se mueve; dos
   números crudos no piden nada.
2. **Es lo que hace funcionar al cockpit sin pagar Apify de más.** Un video que Majo transcribe
   **antes** de que exista su colección no tiene duración todavía, pero sí guarda su cobertura.
   Cuando la colección llega con `videoDuration`, **el veredicto aparece solo, sin volver a pedir
   nada.**

---

## 3 · Decisiones, con su porqué

**§3.1 · No hay estado `parcial`.** `app.transcripciones.estado` queda como está. Agregarle un valor
rompe `app.cache_transcripts` (filtra `in ('listo','sin_transcript')`) y las lecturas del cockpit que filtran por estado
(`ESTADOS_FALLIDOS` en `leerFallidas`, `reencolar`, `abandonar`, `contarPendientes`). **Lo parcial son dos números, no un estado.**

**§3.2 · La decisión vive copiada, y la vigila un test.** Un Code node de n8n no puede importar
código del repo. Así que la función pura `veredicto(cobertura, duracion)` vive en un archivo, el
dashboard la importa, y el nodo la lleva **copiada textual** — con `test-nodos.mjs` corriendo **la
misma tabla de fixtures contra las dos copias**. Hoy esa clase de copia la vigila un comentario
(`lib/transcribir.ts`: *"copiado textual de los nodos"*); desde acá la vigila un test que falla
ruidoso.

*Descartado — la fachada (que el motor le pida el transcript al BFF):* sería un solo lugar de verdad,
pero `transcribir/page.tsx` corre con `maxDuration = 60` contra corridas de 280 videos, así que
pediría cola y polling; y ADR-035 fijó que n8n **lee config** por la fachada y **escribe resultados**
por PostgREST — el ASR no es ninguna de las dos. Es rediseñar el transporte para arreglar un bug de
datos.

*Descartado — decidir después, en SQL:* el reintento tiene que ocurrir **mientras la llamada está
viva**. Decidir después obliga a re-pagar todo.

**§3.3 · Se elige por cobertura, no por largo.** Cuando hay dos respuestas (`auto` y el reintento con
`generate`) gana **la que cubre más segundos**, no la que trae más caracteres. Medido: en
`DaTf9Wqxt8p` `generate` traía menos texto *y* cubría menos.

**§3.4 · El umbral sale del histograma, no de esta sesión.** Con n=3 tanto "80% de cobertura" como
"faltan más de 5 s" separan bien los casos, pero los reels terminan con música y logo sin voz: un
umbral inventado quema videos sanos. Las 584 filas del caché —que se pagan igual— dan el histograma
completo de `cobertura/duración`. **Por eso el backfill va primero y es la medición** (§5).

**§3.5 · Fail-open, igual que el resto del nodo.** Sin duración no hay veredicto y el transcript pasa
como hoy; si el reintento falla, queda el de `auto`. **El peor caso del arreglo es el comportamiento
actual.** Es el invariante #1 de PLAN §2.5.

---

## 4 · Migración `039` (ADR-095)

Aditiva, idempotente (`add column if not exists`), **sin backfill de datos derivados**. Los ceros
iniciales son la verificación, igual que en la `036` y la `038`.

| tabla | columna | tipo | para qué |
|---|---|---|---|
| `app.transcripciones` | `cobertura_seg` | `numeric` | hasta qué segundo llega el transcript |
| `app.transcripciones` | `duracion_seg` | `numeric` | cuánto dura el video, cuando se sabe |
| `app.transcripciones` | `modo` | `text` | `auto` \| `generate`: cuál respuesta ganó |
| `app.candidatos` | `cobertura_seg` | `numeric` | `duracion_seg` ya está (ADR-086); falta la otra mitad |
| `app.videos_meta` | `duracion_seg` | `numeric` | dejar de tirar `videoDuration` donde el cockpit **ya** llama a Apify |

`app.cache_transcripts` pasa a devolver también `cobertura_seg` y `duracion_seg`. **La RPC sigue
tonta**: no filtra por umbral, solo entrega los números. Si el umbral cambia, no se toca SQL.

🩸 **`create or replace` no alcanza para esto.** PostgreSQL no deja cambiar las columnas del
`returns table` de una función existente vía `create or replace` (probado contra Postgres 16.13:
`ERROR: cannot change return type of existing function`, con el hint de dropearla primero). La
migración lleva `drop function if exists app.cache_transcripts(uuid, text[])` **antes** del `create
or replace`.

⚠️ **Y el `drop` se lleva los privilegios de la función — pero eso no deja al motor sin acceso.**
Postgres le da `EXECUTE` a `PUBLIC` por defecto a toda función nueva, y Supabase no lo revoca a
nivel de cluster (medido contra prod el 09/09 con `pg_proc.proacl`: `cache_transcripts` sale con
`PUBLIC` en la lista, `instancias_visibles` no, porque solo a ella la `021` le hizo `revoke`).
`service_role` y `authenticated` ejecutarían igual sin los `grant`. Los `grant` se quedan porque
hacen el acceso **explícito e independiente de `PUBLIC`**: el día que alguien la endurezca como la
`021` endureció `instancias_visibles`, el motor no se cae. Ver ADR-087 §Enmienda.

⚠️ **Orden obligatorio: la migración va ANTES del deploy de la app**, igual que exigieron la `014`,
la `016` y la `037`. Sin la columna, PostgREST responde `42703`.

⚠️ **El script se corre entero, de un saque.** Si se corre solo una parte, los `alter table` pueden
quedar aplicados y el `drop`+`create`+`grant` de la RPC no, dejando columnas que el motor no puede
leer por su camino real.

---

## 5 · Las fases, en orden

El orden **es** el diseño: el backfill va primero porque es lo único que puede decir cuál es el
umbral, y cuesta lo mismo hacerlo primero que último.

- **Fase 0 — ADR-095 + migración `039`.** Aplicada a mano en el SQL Editor y verificada **por su
  efecto** (PostgREST devuelve las columnas con 200 y no `PGRST204`; los conteos en cero prueban que
  el *sin backfill* es un hecho medido).
- **Fase 1 — Backfill de los 584, que ES la medición.** Un script que le pide segmentos a Supadata
  para las filas en caché, calcula cobertura, y **escupe el histograma de `cobertura/duración`**.
  Las que no tienen duración se completan con Apify (~427 × $0.0023 ≈ $0.98). Salida: el número del
  umbral, más el conteo real de cortados en el caché.
- **Fase 2 — El umbral se elige mirando el histograma**, se escribe en el ADR con el dato que lo
  justifica, y recién ahí se completan los cortados del caché con `generate`.
- **Fase 3 — Motor.** `Transcribir (Supadata)` pide segmentos, cablea la duración desde
  `Normalizar IG` / `Normalizar TT`, reintenta una vez y guarda los tres campos. Se empuja con
  `n8n:push` (nunca re-import) y se verifica con `n8n:diff` en verde.
- **Fase 4 — Cockpit.** `videoDuration` deja de tirarse donde colecciones ya llama a Apify;
  `lib/transcribir.ts` guarda cobertura; la pantalla de Majo muestra el aviso cuando el veredicto
  existe.

---

## 6 · Restricciones globales

Aplican a **todas** las tareas:

- **`core/` cambia solo con ADR.** Esto lo toca (`core/schema/039`), y por eso la Tarea 1 es el ADR.
  Cualquier otro toque a `core/` fuera de lo previsto: se para y se discute.
- **Cambiar un workflow es `n8n:push`, no re-importarlo** (ADR-053). `n8n:diff` antes y después.
- **Nada de secretos en git.** Las keys salen del `.env` de la raíz.
- **El registro es sumidero, jamás dependencia de ejecución** (PLAN §2.5, invariante #1). Todo nodo
  HTTP nuevo entra con su `onError` decidido y escrito.
- **Los guiones existentes no se pisan.** El backfill **completa** lo cortado; no reescribe lo sano.

---

## 7 · Lo que este plan NO hace, a propósito

- **No cambia el dedup.** Un video ya visto sigue quemado; recuperar los 1.401 de ADR-087 es otro
  frente.
- **No toca la traducción.** El `max_tokens: 2000` de Haiku contra una entrada de 6.000 caracteres es
  un techo latente real —el guion más largo del histórico tiene 5.692 caracteres— pero **no es este
  bug** y se mide aparte.
- **No agrega una llamada a Apify en la pantalla de Transcribir.** Decisión de Mani (09/09): la
  duración se guarda donde ya se compra. La consecuencia aceptada es que un video transcrito antes de
  su colección no tiene veredicto **todavía**, y lo gana solo cuando la duración llega (§2).
- **No promete que Supadata no falle.** `Day8CXdBLwK` está cortado de forma estable y ningún
  reintento lo salva. Lo que este plan garantiza es que **eso se sepa**.

---

## 8 · Cómo se sabe si sirvió

La métrica sigue siendo la de ADR-089 (`aprobados / N pedido`). Los números propios de este cambio,
a escribir **antes** de mirarlos:

- **Tasa real de cortados en el caché** (Fase 1). Predicción: entre 6% y 20%. Si da <3%, el arreglo
  no valía la fase 3 y hay que decirlo.
  ⚠️ **Medido (09/09, n=583): dio 2.06% (12 filas bajo 0.8) — la predicción estaba mal.** Dicho sin
  suavizarlo: el número real cae *debajo* del piso de "no valía la pena" que este mismo párrafo
  fijó antes de mirar.
  🔑 **Y aun así se sigue, porque la regla de parada medía la cosa equivocada.** Se escribió
  asumiendo que el costo del arreglo escala con el **volumen** (si son pocos cortados sobre muchas
  filas, no vale la pena tocar el motor) — pero el costo real escala con la **cantidad de
  cortados**, que son 12, o sea **24 créditos por corrida** (2 créditos de `generate` × 12). Eso es
  barato sea la tasa 2% o 20%: el gasto no crece con el denominador. Decidido por Mani: se sigue,
  y con eso **cambia el valor declarado de las Tareas 4 y 5**: no es el reintento en sí (que
  recupera 4 de 12 videos, un número chico) sino **la medición continua** — gratis, y deja el
  número re-medible con más datos en vez de re-descubrible desde cero cada vez que alguien audita el
  caché a mano.
- **Cuántos recupera el reintento** (Fase 2). Predicción: ~2 de cada 3, por la muestra de tres.
  ⚠️ **Medido (09/09, n=12): 4 recuperan entero, 7 no mejoran, 1 no se pudo medir** (devolvió un
  `202` asíncrono de Supadata — ver [ADR-096](../adr/ADR-096-un-202-de-supadata-no-es-un-error-ni-un-transcript.md)).
  De los 11 medibles, recuperó **4 de 11 (36%)**, bien por debajo del ~67% previsto con n=3.
- 🐤 **Canario, nace en cero y sin contaminar:**
  `select count(*) from app.transcripciones where modo = 'generate'`. La primera fila la escribe el
  motor, no una verificación — **no se insertan filas de prueba en esta tabla.** Si hace falta
  probar, se hace en una fila que después se borra y se anota acá.

---

# Plan de implementación

> **Para agentes:** ejecutar con `superpowers:subagent-driven-development` o
> `superpowers:executing-plans`, tarea por tarea. Cada tarea termina en un commit y en algo
> verificable por sí solo.

**Stack:** SQL (Supabase, migraciones a mano en el SQL Editor) · Code nodes de n8n (JS plano, sin
imports) · TypeScript / Next 16 en `apps/dashboard` · scripts ESM `.mjs` sin dependencias.

📏 **Node es `v24.20.0`** (medido; CLAUDE.md dice "Node 26" y está desactualizado). Importa porque de
ahí sale que `node --test "domain/**/*.test.ts"` corre los `.ts` sin transpilar, y que **un `.mjs`
puede importar un `.ts`** — verificado el 09/09, y es lo que hace posible la Tarea 2.

## Constantes globales (valen para todas las tareas)

- **URL de segmentos:** `https://api.supadata.ai/v1/transcript?url=<enc>&mode=<auto|generate>`
  (**sin** `text=true`). Devuelve `content: [{ text, offset, duration }]`, en **milisegundos**.
- **El texto se reconstruye con `' '.join(seg.text)`** y es idéntico carácter por carácter al que
  devuelve `text=true` (verificado, 403 = 403). No cambiar el separador.
- **`cobertura_seg = (último.offset + último.duration) / 1000`**, redondeado a 1 decimal.
- **Tope de guion: 6.000 caracteres.** Ya existe en las dos puntas; no se toca.
- **Fail-open** en todo lo nuevo: sin duración no hay veredicto; si el reintento falla, queda `auto`.
- **`n8n:diff` antes y después** de cualquier cambio en un `workflow.json`, y se empuja con
  `n8n:push`, nunca re-import (ADR-053).

---

### Tarea 1 · ADR-095 + migración `039`

**Archivos:**
- Crear: `docs/adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md`
- Crear: `core/schema/039_cobertura_transcripts.sql`
- Modificar: `CLAUDE.md` (renglón de `core/schema/`, con el estado de la `039`)

- [ ] **Paso 1: escribir el ADR.** Estructura igual que ADR-087. Tiene que contener, sí o sí, la
      tabla de tres videos del §1 de este doc (es la evidencia de que el umbral no puede ser por
      caracteres), el porqué de **no** agregar un estado `parcial` (§3.1), y el porqué de derivar el
      veredicto en vez de guardarlo (§2). Dejar el umbral **explícitamente sin número**, con la
      frase: *sale del histograma de la Tarea 3*.

- [ ] **Paso 2: escribir la migración.** Aditiva e idempotente:

```sql
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

drop function if exists app.cache_transcripts(uuid, text[]);

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

grant execute on function app.cache_transcripts(uuid, text[]) to service_role;
grant execute on function app.cache_transcripts(uuid, text[]) to authenticated;
```

      🩸 **El `drop` va primero porque `create or replace` no alcanza:** PostgreSQL no deja cambiar
      las columnas del `returns table` de una función existente (probado contra Postgres 16.13:
      `ERROR: cannot change return type of existing function`, con el hint de dropearla primero).

      ⚠️ **Y el `drop` se lleva los privilegios de la función — pero eso no deja al motor sin
      acceso.** Postgres le da `EXECUTE` a `PUBLIC` por defecto a toda función nueva, y Supabase no
      lo revoca a nivel de cluster (medido contra prod el 09/09 con `pg_proc.proacl`:
      `cache_transcripts` sale con `PUBLIC` en la lista, `instancias_visibles` no, porque solo a
      ella la `021` le hizo `revoke`). `service_role` y `authenticated` ejecutarían igual sin los
      `grant` de abajo. Se quedan porque hacen el acceso **explícito e independiente de `PUBLIC`**:
      el día que alguien la endurezca como la `021` endureció `instancias_visibles`, el motor no se
      cae. Ver ADR-087 §Enmienda.

      🔒 **La RPC no filtra por umbral.** Devuelve los números y el nodo decide. Si el umbral cambia,
      no se toca SQL.

      ⚠️ **El script se corre entero, de un saque.** Si se corre solo una parte, los `alter table`
      pueden quedar aplicados y el `drop`+`create`+`grant` de la RPC no, dejando columnas que el
      motor no puede leer por su camino real.

- [ ] **Paso 3: Mani la aplica a mano** en el SQL Editor (gate humano, como todas).

- [ ] **Paso 4: verificar POR SU EFECTO, no por haberla corrido.** Cuatro señales, y las cuatro
      tienen que dar:

```sql
select
  (select count(*) from app.transcripciones)                              as filas,
  (select count(cobertura_seg) from app.transcripciones)                  as con_cobertura,
  (select count(cobertura_seg) from app.candidatos)                       as cand_con_cobertura,
  (select count(duracion_seg)  from app.videos_meta)                      as meta_con_duracion;
```

      Esperado: `con_cobertura = 0`, `cand_con_cobertura = 0`, `meta_con_duracion = 0`. **Los tres
      ceros son el dato**: prueban que el *sin backfill* es un hecho medido y no una intención.
      Quinta señal, la que puede fallar sola por caché de esquema vieja: PostgREST devuelve las
      columnas con **200 y no `PGRST204`**:

```bash
set -a && source .env && set +a
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
  -H "Accept-Profile: app" \
  "$SUPABASE_URL/rest/v1/transcripciones?select=cobertura_seg,duracion_seg,modo&limit=1"
```

      Sexta, por el camino real de la RPC (la que el motor usa):

```bash
# el instance_id sale de la base, no se pega a mano
IID=$(curl -s -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
  "$SUPABASE_URL/rest/v1/instances?select=id&limit=1" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
curl -s -X POST -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
  -H "Content-Profile: app" -H "content-type: application/json" \
  -d "{\"p_instance\":\"$IID\",\"p_ids\":[\"3932627455294496553\"]}" \
  "$SUPABASE_URL/rest/v1/rpc/cache_transcripts"
```

      Tiene que devolver 200 y las filas **con las dos columnas nuevas**.

- [ ] **Paso 5: commit.**

```bash
git add docs/adr/ADR-095-*.md core/schema/039_cobertura_transcripts.sql CLAUDE.md
git commit -m "El transcript ahora dice cuanto del video cubrio (ADR-095, migracion 039)"
```

---

### Tarea 2 · La función pura, y el test que vigila su copia

**Archivos:**
- Crear: `apps/dashboard/domain/cobertura.ts`
- Crear: `apps/dashboard/domain/cobertura.test.ts`

**Interfaces (las tareas 3, 4 y 7 dependen de estos nombres exactos):**
- Produce: `type Segmento = { text: string; offset: number; duration: number }`
- Produce: `textoDeSegmentos(segs: readonly Segmento[]): string`
- Produce: `coberturaDeSegmentos(segs: readonly Segmento[]): number | null`
- Produce: `type Veredicto = "completo" | "parcial" | "desconocido"`
- Produce: `veredictoCobertura(cobertura: number | null, duracion: number | null, umbral: number): Veredicto`
- Produce: `CASOS_COBERTURA` — la tabla de fixtures **que importa también `test-nodos.mjs`**
- *(La Tarea 7 le agrega a este mismo archivo `avisoDeCobertura(v: Veredicto, cobertura: number | null,
  duracion: number | null): string | null`. No hace falta antes: nadie la consume hasta la pantalla.)*

- [ ] **Paso 1: escribir el test que falla.** Los tres primeros casos son los tres videos medidos el
      09/09; no son inventados y por eso van con su id.

```ts
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  CASOS_COBERTURA, coberturaDeSegmentos, textoDeSegmentos, veredictoCobertura,
} from "./cobertura.ts";

describe("coberturaDeSegmentos", () => {
  it("es el fin del último segmento, en segundos", () => {
    assert.equal(coberturaDeSegmentos([{ text: "a", offset: 0, duration: 3520 },
                                        { text: "b", offset: 14760, duration: 2760 }]), 17.5);
  });
  it("sin segmentos no inventa un cero", () => {
    assert.equal(coberturaDeSegmentos([]), null);
  });
});

describe("textoDeSegmentos", () => {
  it("une con UN espacio y nada más", () => {
    assert.equal(textoDeSegmentos([{ text: "hola", offset: 0, duration: 1 },
                                   { text: "mundo", offset: 1, duration: 1 }]), "hola mundo");
  });
});

describe("veredictoCobertura", () => {
  it("sin duración no juzga: 'desconocido', nunca 'parcial'", () => {
    assert.equal(veredictoCobertura(29, null, 0.8), "desconocido");
    assert.equal(veredictoCobertura(null, 45.8, 0.8), "desconocido");
  });
  it("un video callado no es un video cortado (DaTf9Wqxt8p, medido 09/09)", () => {
    assert.equal(veredictoCobertura(53.2, 54.0, 0.8), "completo");
  });
  it("cubrir 29s de 45.8s es parcial (Day8CXdBLwK, medido 09/09)", () => {
    assert.equal(veredictoCobertura(29.0, 45.8, 0.8), "parcial");
  });
  it("cubrir 41.5s de 150.4s es parcial (Db9Y_EGulGk, medido 09/09)", () => {
    assert.equal(veredictoCobertura(41.5, 150.4, 0.8), "parcial");
  });
  it("cobertura mayor que la duración no rompe: es completo", () => {
    assert.equal(veredictoCobertura(46.2, 45.8, 0.8), "completo");
  });
});

describe("CASOS_COBERTURA", () => {
  it("cada caso dice qué veredicto espera, para que test-nodos.mjs corra la misma tabla", () => {
    for (const c of CASOS_COBERTURA) {
      assert.equal(veredictoCobertura(c.cobertura, c.duracion, c.umbral), c.espera, c.nombre);
    }
  });
});
```

- [ ] **Paso 2: correrlo y verlo fallar.**
      Run: `cd apps/dashboard && npm test`
      Esperado: FAIL, `Cannot find module './cobertura.ts'`.

- [ ] **Paso 3: implementación mínima.**

```ts
// El corte de Supadata (ADR-095). Dominio puro: sin IO, sin React, sin `@/`.
//
// ⚠️ ESTE ARCHIVO VIVE DOS VECES. La copia de n8n está en el nodo `Transcribir (Supadata)` de
// Workflows/workflow-short-form-content/workflow.json, porque un Code node no puede importar del
// repo. Lo que las mantiene juntas NO es este comentario: es `test-nodos.mjs`, que importa
// `CASOS_COBERTURA` de acá y la corre contra la copia. Si divergen, ese test falla.

export type Segmento = { text: string; offset: number; duration: number };
export type Veredicto = "completo" | "parcial" | "desconocido";

/** Idéntico carácter por carácter a lo que Supadata devuelve con `text=true` (verificado 09/09). */
export function textoDeSegmentos(segs: readonly Segmento[]): string {
  return segs.map((s) => String(s?.text ?? "")).join(" ");
}

/** Hasta qué segundo llega el transcript. `null` = no se puede saber, que NO es cero. */
export function coberturaDeSegmentos(segs: readonly Segmento[]): number | null {
  if (!Array.isArray(segs) || segs.length === 0) return null;
  const u = segs[segs.length - 1];
  const fin = Number(u?.offset ?? 0) + Number(u?.duration ?? 0);
  return Number.isFinite(fin) ? Math.round(fin / 100) / 10 : null;
}

/**
 * 🔑 `desconocido` no es un empate cómodo: es el estado normal de un video de la pantalla de Majo
 * antes de que su colección compre la duración. El veredicto llega después, sin re-pagar nada.
 */
export function veredictoCobertura(
  cobertura: number | null, duracion: number | null, umbral: number,
): Veredicto {
  if (cobertura == null || duracion == null || !(duracion > 0)) return "desconocido";
  return cobertura >= duracion * umbral ? "completo" : "parcial";
}

/** La tabla que corren las DOS implementaciones. Los tres primeros son videos reales. */
export const CASOS_COBERTURA = [
  { nombre: "DaTf9Wqxt8p — video callado, sano", cobertura: 53.2, duracion: 54.0, umbral: 0.8, espera: "completo" },
  { nombre: "Day8CXdBLwK — cortado, irrecuperable", cobertura: 29.0, duracion: 45.8, umbral: 0.8, espera: "parcial" },
  { nombre: "Db9Y_EGulGk — cortado, generate lo salva", cobertura: 41.5, duracion: 150.4, umbral: 0.8, espera: "parcial" },
  { nombre: "sin duración", cobertura: 29.0, duracion: null, umbral: 0.8, espera: "desconocido" },
  { nombre: "sin cobertura", cobertura: null, duracion: 45.8, umbral: 0.8, espera: "desconocido" },
  { nombre: "duración cero no divide", cobertura: 10, duracion: 0, umbral: 0.8, espera: "desconocido" },
  { nombre: "cobertura pasada de largo", cobertura: 46.2, duracion: 45.8, umbral: 0.8, espera: "completo" },
] as const satisfies readonly {
  nombre: string; cobertura: number | null; duracion: number | null; umbral: number; espera: Veredicto;
}[];
```

- [ ] **Paso 4: correr y ver pasar.**
      Run: `cd apps/dashboard && npm test && npm run typecheck`
      Esperado: PASS los dos.

- [ ] **Paso 5: commit.**

```bash
git add apps/dashboard/domain/cobertura.ts apps/dashboard/domain/cobertura.test.ts
git commit -m "La cobertura de un transcript es dominio puro, y tiene su tabla de casos"
```

---

### Tarea 3 · El backfill, que ES la medición (Fase 1)

**Archivos:**
- Crear: `Workflows/workflow-short-form-content/medir-cobertura.mjs`

🏠 **Va acá y no en `core/scripts/` a propósito.** Es un script de operación del motor, hermano de
`rescatar-huerfanos.mjs` y `verificar-corrida.mjs`, y `core/` solo cambia con ADR. No hay razón para
gastar el permiso de la ADR-095 en mover un script de lugar.

**Interfaces:**
- Consume: `coberturaDeSegmentos`, `textoDeSegmentos` de `apps/dashboard/domain/cobertura.ts`
  (import relativo con extensión `.ts`; funciona en Node 24, verificado).

- [ ] **Paso 1: escribir el script.** Dos modos, **dry-run por defecto**, igual que `n8n:push`:
      - `--medir` (default): lee las filas `origen = 'motor'` con `estado = 'listo'`, le pide los
        segmentos a Supadata en `auto`, calcula cobertura, completa la duración faltante desde
        `app.candidatos.duracion_seg` y, para las que sigan sin ella, desde Apify
        (`apify~instagram-scraper`, campo `videoDuration`, lotes de 50 como `TOPE_POR_LOTE`).
        **Escribe `cobertura_seg` / `duracion_seg` / `modo = 'auto'`** y al final imprime el
        histograma de `cobertura/duración` en deciles.
      - `--completar --apply`: sobre las que quedaron bajo el umbral que se pase por `--umbral`,
        pide `generate` **una sola vez** y se queda con **la que cubre más segundos, no la que trae
        más texto**. Actualiza `script`, `cobertura_seg` y `modo = 'generate'`.
      - **Nunca pisa un guion sano**: si el nuevo cubre menos o igual, no escribe.
      - Concurrencia 8 y backoff, copiando el patrón del nodo (el plan de Supadata está en 10 req/s
        y el límite se cobra en el pico).

      Las tres piezas donde el criterio importa van escritas, para que no se re-decidan:

```js
#!/usr/bin/env node
// medir-cobertura.mjs — mide cuánto del video cubrió cada transcript del caché, y completa los
// cortados. Dry-run por defecto: escribe sólo con --apply. ADR-095.
import { coberturaDeSegmentos, textoDeSegmentos } from '../../apps/dashboard/domain/cobertura.ts';

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const valor = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const APPLY = flag('apply');
const UMBRAL = Number(valor('umbral', 0.8));

/** Una respuesta de Supadata, ya normalizada. `cobertura: null` = no se pudo medir. */
async function pedir(url, modo) {
  const r = await fetch(
    `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}&mode=${modo}`,
    { headers: { 'x-api-key': process.env.SUPADATA_API_KEY }, signal: AbortSignal.timeout(90_000) },
  );
  const b = await r.json().catch(() => ({}));
  const segs = Array.isArray(b.content) ? b.content : [];
  return { texto: textoDeSegmentos(segs).trim().slice(0, 6000), cobertura: coberturaDeSegmentos(segs),
           lang: String(b.lang || '').toLowerCase().slice(0, 2), status: r.status };
}

/**
 * 🔑 Gana el que CUBRE MÁS, no el que trae más texto. Medido el 09/09 en `DaTf9Wqxt8p`: `generate`
 * traía 2 caracteres contra 95 de `auto` y cubría 39 s contra 53.2 s. Elegir por largo habría
 * pisado un guion sano con basura.
 * Y ante empate gana el viejo: no se reescribe una fila para dejarla igual.
 */
function mejor(actual, candidato) {
  if (candidato.cobertura == null) return actual;
  if (actual.cobertura == null) return candidato;
  return candidato.cobertura > actual.cobertura ? candidato : actual;
}

/** El histograma es la salida del modo --medir: de acá sale el umbral, no de una opinión. */
function histograma(ratios) {
  const n = ratios.length;
  if (!n) return 'sin datos';
  const orden = [...ratios].sort((a, b) => a - b);
  const bins = Array.from({ length: 10 }, (_, i) =>
    ratios.filter((r) => r >= i / 10 && r < (i + 1) / 10).length);
  bins[9] += ratios.filter((r) => r >= 1).length;
  return [
    `n=${n}  mediana=${orden[Math.floor(n / 2)].toFixed(3)}  p10=${orden[Math.floor(n * 0.1)].toFixed(3)}`,
    ...bins.map((c, i) => `  ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}  ${'█'.repeat(Math.round(40 * c / n))} ${c}`),
  ].join('\n');
}
```

      ⚠️ **`--apply` no es decoración.** El modo `--medir` sin `--apply` imprime el histograma y no
      escribe una fila: es la única forma de mirar el número antes de comprometerse con un umbral.

- [ ] **Paso 2: correrlo en dry-run y leer el histograma.**
      Run: `set -a && source .env && set +a && node Workflows/workflow-short-form-content/medir-cobertura.mjs --medir`
      Esperado: imprime `n`, la mediana de `cobertura/duración`, el histograma por deciles, y
      cuántas filas quedaron sin duración. **No falla si Apify no contesta**: esas quedan sin
      veredicto y el script lo dice.

- [ ] **Paso 3: escribir el resultado en el ADR-095 ANTES de elegir el umbral.** Pegar el histograma
      tal cual salió. Es la única forma de que el número siguiente no sea una opinión.

- [ ] **Paso 4 (humano, Mani): elegir el umbral mirando el histograma.** Escribirlo en ADR-095 con
      la frase que lo justifica. **Si la tasa de cortados da menos de 3%, este plan se para acá** y
      se dice en el handoff: la Tarea 4 no valdría lo que cuesta (§8 del spec).

- [ ] **Paso 5: correr el completado.**
      Run: `node Workflows/workflow-short-form-content/medir-cobertura.mjs --completar --umbral <el elegido> --apply`
      Esperado: imprime cuántas completó y cuántas no se pudieron (las tipo `Day8CXdBLwK`).

- [ ] **Paso 6: verificar contra prod.**

```sql
select modo, count(*), round(avg(cobertura_seg / nullif(duracion_seg,0))::numeric, 3) as cobertura_media
from app.transcripciones where origen = 'motor' group by modo order by 1;
```

- [ ] **Paso 7: commit.**

```bash
git add Workflows/workflow-short-form-content/medir-cobertura.mjs docs/adr/ADR-095-*.md
git commit -m "El backfill mide antes de arreglar: el umbral sale del histograma"
```

---

### Tarea 4 · El motor detecta y reintenta una vez

**Archivos:**
- Modificar: `Workflows/workflow-short-form-content/workflow.json`, nodo `Transcribir (Supadata)`
  (la llamada está en el `_uno` del pool; hoy pide `&text=true&mode=auto`)
- Modificar: `Workflows/workflow-short-form-content/test-nodos.mjs` (harness `runTranscribir`, ~L553)

- [ ] **Paso 1: correr `n8n:diff` ANTES.**
      Run: `cd core/scripts && npm run n8n:diff`
      Esperado: verde en los 5. Si no lo está, se para: no se empuja sobre drift ajeno.

- [ ] **Paso 2: escribir los tests que fallan**, en `test-nodos.mjs`, sección nueva
      `── Cobertura: detección y reintento (ADR-095) ──`. Cinco checks:
      1. La copia del nodo pasa **`CASOS_COBERTURA` importada del `.ts`** (este es el test del §3.2).
      2. Con `duracion_video` presente y cobertura corta, se hace **exactamente un** pedido extra con
         `mode=generate` (contar llamadas en el mock).
      3. Con cobertura suficiente, **cero** pedidos extra.
      4. **Sin `duracion_video`, cero pedidos extra** y el transcript pasa igual (fail-open).
      5. Si `generate` cubre **menos**, gana `auto` (el caso `DaTf9Wqxt8p`: no elegir por largo).

- [ ] **Paso 3: correrlos y verlos fallar.**
      Run: `node Workflows/workflow-short-form-content/test-nodos.mjs`
      Esperado: los 5 nuevos en ❌, los **276** viejos en ✅.
      *(276 medido el 09/09 corriendo el archivo. Los `42 checks` que menciona CLAUDE.md son de
      `npm run n8n:test`, que es otro test y otro archivo.)*

- [ ] **Paso 4: modificar el nodo.** Cuatro cambios, y nada más:
      1. La URL pierde `text=true` y el modo sale de una variable.
      2. `txt` se arma con la copia de `textoDeSegmentos`; se calcula `cob` con la de
         `coberturaDeSegmentos`. **Se conserva la rama vieja**: si `resp.content` viene como string
         (no como array), se usa tal cual. Supadata puede volver a cambiar de forma y eso no puede
         tumbar la corrida.
      3. Mapa `external_id → duracion_video` armado desde `$('Normalizar IG').all()` y
         `$('Normalizar TT').all()` (los dos son ancestros — verificado con el criterio de
         `auditar-workflows.mjs` §2).
      4. Si `veredictoCobertura(...) === 'parcial'`, **un** pedido con `mode=generate`; gana el de
         mayor cobertura. El reintento **respeta el presupuesto**: si `BUDGET_MS` ya venció, no se
         pide (el presupuesto manda sobre todo lo demás, igual que sobre el backoff).
      Los items de salida suman `_tx_cobertura`, `_tx_duracion` y `_tx_modo`.

      ⛔ **No tocar** el bucle `RETRIES`/backoff existente: ese reintenta **fallas**, este reintenta
      **respuestas cortas**. Son dos cosas distintas y mezclarlas rompe el conteo de 429.

- [ ] **Paso 5: correr los tests y verlos pasar.**
      Run: `node Workflows/workflow-short-form-content/test-nodos.mjs`
      Esperado: **281 ✅, 0 ❌** (276 + los 5 nuevos).

- [ ] **Paso 6: auditar la estructura.**
      Run: `node Workflows/auditar-workflows.mjs`
      Esperado: sin `$('X')` fuera de ancestros, sin nodos inalcanzables, `onError` de los HTTP
      intacto.

- [ ] **Paso 7: empujar al live y verificar.**

```bash
cd core/scripts
npm run n8n:push -- motor --nodos "Transcribir (Supadata)"          # dry-run primero
npm run n8n:push -- motor --nodos "Transcribir (Supadata)" --apply
npm run n8n:diff
```

      Esperado: `n8n:diff` verde en los 5, snapshot en `.n8n-snapshots/`. Rollback si hace falta:
      `npm run n8n:restore -- motor <snapshot> --apply`.

- [ ] **Paso 8: commit.**

```bash
git add Workflows/workflow-short-form-content/workflow.json Workflows/workflow-short-form-content/test-nodos.mjs
git commit -m "El motor mide cuanto del video cubrio el transcript, y reintenta una vez"
```

---

### Tarea 5 · Los números llegan al caché y al Feed

**Archivos:**
- Modificar: `workflow.json`, nodo `Preparar transcripciones` (manda `cobertura_seg`, `duracion_seg`, `modo`)
- Modificar: `workflow.json`, nodo `Pedir caché de transcripts` (lee las dos columnas nuevas de la RPC)
- Modificar: `workflow.json`, nodo `Armar candidato` (manda `cobertura_seg`; `duracion_seg` ya lo manda)

- [ ] **Paso 1: test que falla** en `test-nodos.mjs`, sobre `runPrepTx` (~L1288): una fila resuelta
      con cobertura sale con los tres campos; una sin cobertura sale con `cobertura_seg: null` y
      **no** con `0`.
- [ ] **Paso 2: correrlo y verlo fallar.** Run: `node Workflows/workflow-short-form-content/test-nodos.mjs`
- [ ] **Paso 3: modificar los tres nodos.** En `Pedir caché`, un hit de caché **con cobertura
      parcial ya no cuenta como resuelto**: vuelve a pedirse. Esa línea es la que descongela el
      caché de ADR-087; sin ella, la Tarea 3 arregla el pasado y el futuro se vuelve a romper.
- [ ] **Paso 4: correr los tests y verlos pasar.**
- [ ] **Paso 5: empujar y verificar.**

```bash
cd core/scripts
npm run n8n:push -- motor --nodos "Preparar transcripciones,Pedir caché de transcripts,Armar candidato" --apply
npm run n8n:diff
```

- [ ] **Paso 6: commit.**

```bash
git commit -am "La cobertura viaja al cache y al Feed, y un hit parcial deja de contar como resuelto"
```

---

### Tarea 6 · El cockpit deja de tirar `videoDuration`

**Archivos:**
- Modificar: `apps/dashboard/lib/apify.ts` (tipo `MetaDeVideo` + `normalizar`)
- Modificar: `apps/dashboard/lib/videos.ts` (`COLUMNAS` y el upsert)
- Modificar: `apps/dashboard/domain/video.ts` + `video.test.ts` si el tipo del dominio lo espeja

- [ ] **Paso 1: test que falla** en `apps/dashboard/domain/video.test.ts`: un item de Apify con
      `videoDuration: 45.8` produce `duracion_seg: 45.8`; sin el campo produce `null`, **no `0`**
      (la trampa que `apify.ts` ya documenta con `videoViewCount`: el cero silencioso).
- [ ] **Paso 2: correrlo y verlo fallar.** Run: `cd apps/dashboard && npm test`
- [ ] **Paso 3: agregar `duracion_seg` al tipo, a `normalizar` (usando el helper `numero()` que ya
      existe), a `COLUMNAS` y al upsert.**
- [ ] **Paso 4: correr y ver pasar.** Run: `cd apps/dashboard && npm test && npm run typecheck`
- [ ] **Paso 5: verificar contra prod** con una colección de un video, y confirmar que la fila de
      `app.videos_meta` queda con `duracion_seg` no nulo.
- [ ] **Paso 6: commit.**

```bash
git commit -am "La duracion del video ya se compraba: ahora se guarda"
```

---

### Tarea 7 · La pantalla de Majo avisa

**Archivos:**
- Modificar: `apps/dashboard/domain/cobertura.ts` + `cobertura.test.ts` (suman `avisoDeCobertura`)
- Modificar: `apps/dashboard/lib/transcribir.ts` (`Transcripcion` suma `cobertura`; `transcribir()` pide segmentos)
- Modificar: `apps/dashboard/lib/transcripciones.ts` (`COLUMNAS` suma las tres; `marcarResultado` las escribe)
- Modificar: `apps/dashboard/app/[cliente]/[pipeline]/(zonas)/transcribir/fila.tsx` (el aviso)

- [ ] **Paso 1: test que falla** en `apps/dashboard/domain/cobertura.test.ts`: el texto del aviso.
      `avisoDeCobertura("parcial", 29, 45.8)` da `"Guion incompleto: cubre 29 s de 46 s"`;
      `"completo"` y `"desconocido"` dan `null` (**`desconocido` no dibuja nada**: no hay que
      asustar a Majo por un video cuya duración todavía no se compró).
- [ ] **Paso 2: correrlo y verlo fallar.** Run: `cd apps/dashboard && npm test`
- [ ] **Paso 3: implementar.** `transcribir()` pide segmentos, arma el texto con
      `textoDeSegmentos` y devuelve `cobertura`. **La duración se busca en `app.videos_meta`** y, si
      no está, el veredicto queda `desconocido` (decisión de Mani: no se llama a Apify acá).
      El aviso se dibuja en la fila, al lado del guion.
      ⚠️ **`traducir()` no se toca.** El invariante de ADR-009 se mantiene porque el texto que sale
      de los segmentos es idéntico al de `text=true` (verificado).
- [ ] **Paso 4: correr y ver pasar.**
      Run: `cd apps/dashboard && npm test && npm run typecheck && npm run build`
      (`build` porque se toca una ruta.)
- [ ] **Paso 5: verificar en la pantalla** con un link cortado conocido
      (`https://www.instagram.com/p/DXplmHiCKcg/`, que en `auto` cubre 17.5 s de ~44 s) y con uno
      sano, y confirmar que el aviso aparece en el primero y no en el segundo.
- [ ] **Paso 6: commit.**

```bash
git commit -am "Majo ve cuando un guion viene cortado, en vez de descubrirlo leyendo"
```

---

## Cierre del plan

- [ ] Actualizar [handoff.md](./handoff.md) con el cierre de sesión: qué se midió, el histograma, el
      umbral elegido y su porqué, y el canario del §8 con su consulta escrita y **sin** su resultado.
- [ ] Actualizar el renglón de `core/schema/` en `CLAUDE.md` con el estado de la `039`, verificado
      por efecto.
- [ ] Actualizar el mapa de docs de `CLAUDE.md` con este plan.
