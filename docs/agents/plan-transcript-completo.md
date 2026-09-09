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

⚠️ **Orden obligatorio: la migración va ANTES del deploy de la app**, igual que exigieron la `014`,
la `016` y la `037`. Sin la columna, PostgREST responde `42703`.

⚠️ El `grant` de la RPC va **explícito** al recrearla: `alter default privileges` de la `011` cubre
tablas y secuencias, **no funciones** (ADR-087 §3). Su fallo sería mudo.

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
- **Cuántos recupera el reintento** (Fase 2). Predicción: ~2 de cada 3, por la muestra de tres.
- 🐤 **Canario, nace en cero y sin contaminar:**
  `select count(*) from app.transcripciones where modo = 'generate'`. La primera fila la escribe el
  motor, no una verificación — **no se insertan filas de prueba en esta tabla.** Si hace falta
  probar, se hace en una fila que después se borra y se anota acá.
