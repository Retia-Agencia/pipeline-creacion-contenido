# ADR-095 — Un transcript cortado no puede pasar por "completo"

- **Estado:** propuesta — 2026-09-09 (con Mani, auditando por qué el 11% de los guiones del día
  terminan a mitad de frase). Toca `core/` (migración `039`).

## Contexto

### 📏 Lo que se midió contra prod y contra la API de Supadata (2026-09-09)

**El síntoma.** De los 61 guiones que Majo transcribió el 09/09, **7 terminan a mitad de frase
(11%)**. Se verificó que el corte **ya viene de Supadata**: al re-pedir el original en inglés,
termina en el mismo punto exacto que el español guardado (`…your job your identity`, `…i hope`). No
lo hace el pipeline.

**No es Haiku ni son los créditos.** La key contesta `200` hoy, y los 61 guiones del día volvieron
**en español**, o sea que la traducción corrió en los 61. Quedarse sin créditos produce, por el
fail-open de `lib/transcribir.ts`, *texto completo en inglés* — nunca *texto a medias*. El `206` de
los logs de Supadata tampoco es esto: en su tabla de errores significa *"Transcript Unavailable"*, y
corresponde a la única fila `sin_transcript` del día. El código ya lo maneja bien.

**El motor tiene el mismo problema.** Cruzando `app.candidatos.duracion_seg` contra el largo del
guion salieron **9 sospechosos sobre 157 (6%)** — cota superior, no tasa: el cruce por caracteres no
distingue un video callado de uno cortado. Tres verificados contra Supadata pidiendo timestamps:

| video | duración | `auto` cubre | `generate` cubre | veredicto |
|---|---|---|---|---|
| `DaTf9Wqxt8p` | 54.0 s | 53.2 s / 95 ch | 39.0 s / 2 ch | **sano** — video callado |
| `Day8CXdBLwK` | 45.8 s | 29.0 s / 105 ch | 29.0 s / 105 ch | **cortado**, irrecuperable |
| `Db9Y_EGulGk` | 150.4 s | 41.5 s / 642 ch | 150.2 s / 2790 ch | **cortado**, `generate` lo salva entero |

### 🔑 El hallazgo que descarta cualquier umbral por caracteres

`DaTf9Wqxt8p` (95 ch en 54 s) y `Day8CXdBLwK` (105 ch en 45.8 s) son **gemelos por largo de texto**
y uno está sano y el otro cortado. **Solo la cobertura en segundos los separa.** Cualquier umbral
por cantidad de caracteres quema videos buenos, que es exactamente la pérdida que ADR-089 mide.

**Detectar es gratis.** Pidiéndole a Supadata los segmentos (sin `text=true`) devuelve `offset` +
`duration` por línea, en milisegundos. Verificado que `' '.join(seg.text)` es **idéntico carácter
por carácter** al `text=true` (403 = 403): cambiar de modo no rompe el invariante de ADR-009 ni
cuesta un crédito más.

**Un reintento alcanza, y el segundo es plata tirada.** 5 llamadas seguidas de `generate` sobre los
tres videos: 15 de 15 idénticas. Cuando `generate` completa, completa al primero; cuando no
(`Day8CXdBLwK`), no completa nunca.

**El caché está congelando los cortes AHORA.** `app.transcripciones` con `origen = 'motor'` ya
tiene 584 `listo` + 30 `sin_transcript`, y `app.cache_transcripts` (ADR-087) los devuelve para
siempre. Cada corrida desde el 01/09 graba en piedra transcripts cortados que el motor **no va a
volver a pedir**.

**La duración ya está adentro del motor.** `Normalizar IG` y `Normalizar TT` producen
`duracion_video`, y las dos son **ancestros** de `Transcribir (Supadata)` — verificado con el mismo
criterio de ancestría de `auditar-workflows.mjs` §2, la clase de bug de ADR-029. No hace falta
llamada nueva ni campo nuevo: hay que cablearlo.

**Costos, medidos en las APIs.** Supadata factura `auto` = 1 crédito y `generate` = 2 (header
`x-billable-requests`). Con un supuesto de 15% de cortados (a confirmar, no medido) el promedio
queda en 1.3 créditos/video contra 2.0 si se pasara todo a `generate`: auto-primero es **35% más
barato** *y* mejor, porque `generate` a veces cubre menos.

## Decisión

**`cobertura_seg` se guarda siempre, el veredicto no se guarda nunca.** Viene gratis en la misma
respuesta que ya se paga; el juicio *"esto está cortado"* se deriva de `cobertura_seg /
duracion_seg` en el momento de leer.

Dos razones, las dos con consecuencia práctica:

1. **El umbral va a cambiar.** Un booleano guardado pide un backfill cada vez que se mueve; dos
   números crudos no piden nada.
2. **Hace funcionar al cockpit sin pagar Apify de más.** Un video que Majo transcribe **antes** de
   que exista su colección no tiene duración todavía, pero sí guarda su cobertura. Cuando la
   colección llega con `videoDuration`, el veredicto aparece solo, sin volver a pedir nada.

### §3.1 · No hay estado `parcial`

`app.transcripciones.estado` queda como está. Agregarle un valor rompe `app.cache_transcripts`
(filtra `in ('listo','sin_transcript')`) y las lecturas del cockpit que filtran por estado
(`ESTADOS_FALLIDOS` en `leerFallidas`, `reencolar`, `abandonar`, `contarPendientes`). **Lo parcial
son dos números, no un estado.**

### §3.2 · La decisión vive copiada, y la vigila un test

Un Code node de n8n no puede importar código del repo. La función pura `veredicto(cobertura,
duracion)` vive en un archivo, el dashboard la importa, y el nodo la lleva **copiada textual** —
con `test-nodos.mjs` corriendo la misma tabla de fixtures contra las dos copias. Hoy esa clase de
copia la vigila un comentario (`lib/transcribir.ts`: *"copiado textual de los nodos"*); desde acá
la vigila un test que falla ruidoso.

*Descartado — la fachada le pide el transcript al motor:* `transcribir/page.tsx` corre con
`maxDuration = 60` contra corridas de 280 videos, así que pediría cola y polling; y ADR-035 fijó
que n8n **lee config** por la fachada y **escribe resultados** por PostgREST — el ASR no es
ninguna de las dos. Es rediseñar el transporte para arreglar un bug de datos.

*Descartado — decidir después, en SQL:* el reintento tiene que ocurrir **mientras la llamada está
viva**. Decidir después obliga a re-pagar todo.

### §3.3 · Se elige por cobertura, no por largo

Cuando hay dos respuestas (`auto` y el reintento con `generate`) gana **la que cubre más
segundos**, no la que trae más caracteres. Medido: en `DaTf9Wqxt8p` `generate` traía menos texto
*y* cubría menos.

### §3.4 · El umbral sale del histograma, no de esta sesión

Con n=3 tanto "80% de cobertura" como "faltan más de 5 s" separan bien los casos, pero los reels
terminan con música y logo sin voz: un umbral inventado quema videos sanos. Las 584 filas del
caché —que se pagan igual— dan el histograma completo de `cobertura/duración`. **El umbral queda
explícitamente sin número: sale del histograma de la Tarea 3.**

### §3.5 · Fail-open, igual que el resto del nodo

Sin duración no hay veredicto y el transcript pasa como hoy; si el reintento falla, queda el de
`auto`. **El peor caso del arreglo es el comportamiento actual.** Es el invariante #1 de PLAN §2.5.

## Consecuencias

**A favor**
- El umbral se puede mover (o afinar por plataforma) sin tocar una fila de datos.
- Un video transcripto por Majo antes de tener colección no pierde su cobertura: el veredicto
  aparece solo cuando la duración llega.
- La RPC del caché (`app.cache_transcripts`) sigue tonta: entrega números, no juicios.

**En contra, dicho sin eufemismo**
- 🩸 **El caché ya tiene 584 + 30 filas sin cobertura, y no se backfillean.** Los transcripts
  cortados grabados entre el 01/09 y hoy siguen sin veredicto hasta que alguien los vuelva a pedir
  o corra un backfill aparte — esta migración no lo hace.
- Dos copias de `veredicto()` (nodo + dashboard) son una fuente de bugs de sincronía si el test que
  las compara se rompe o se saltea.
- `Transcribir (Supadata)` pasa a poder hacer **dos** llamadas por video en vez de una, cuando la
  primera cubre poco: el 35% de ahorro de §1 depende de que el reintento sea la excepción y no la
  regla.

## Alternativas descartadas

- **Guardar el veredicto como booleano.** Ver §3.1 y §2: pide backfill en cada cambio de umbral y
  no puede resolverse a destiempo cuando la duración llega después que el transcript.
- **Umbral por caracteres.** Descartado por la tabla de arriba: dos videos con el mismo largo de
  texto, uno sano y uno cortado.
- **Pasar todo a `generate` directamente.** Más caro (2.0 vs 1.3 créditos/video) y no siempre
  mejor: `generate` cubrió *menos* que `auto` en `DaTf9Wqxt8p`.

## Toca

- **`core/`:** migración [`039`](../../core/schema/039_cobertura_transcripts.sql) —
  `app.transcripciones.cobertura_seg` / `duracion_seg` / `modo`, `app.candidatos.cobertura_seg`,
  `app.videos_meta.duracion_seg`, y `app.cache_transcripts` recreada (`drop` + `create or replace`
  — `create or replace` solo no alcanza para cambiar las columnas de un `returns table` existente)
  para devolver las dos columnas nuevas, con sus dos `grant` ahora obligatorios porque el `drop` se
  lleva los privilegios (ADR-087 §3). Aditiva, sin backfill.
- **Motor:** `Transcribir (Supadata)` (pedir segmentos sin `text=true`, calcular
  `cobertura_seg`, reintentar con `generate` cuando conviene, cablear `duracion_video` desde
  `Normalizar IG`/`Normalizar TT`), `Armar candidato` (leer `cobertura_seg` de la caché).
- **App:** la función `veredicto(cobertura, duracion)` en `lib/`, importada por el dashboard y
  copiada textual al nodo.
- **Tests:** `test-nodos.mjs` con la tabla de fixtures de la tabla de tres videos, corrida contra
  las dos copias de `veredicto()`.

## Hecho cuando

1. La migración `039` aplicada y verificada por su efecto (los tres ceros + el `200` de PostgREST +
   la RPC devolviendo las columnas nuevas) — pasos 3 y 4 del brief, gate humano.
2. El histograma de `cobertura_seg / duracion_seg` sobre las filas ya existentes en
   `app.transcripciones` produce un número de umbral defendible (Tarea 3).
3. `Transcribir (Supadata)` reintenta con `generate` cuando la cobertura de `auto` no alcanza el
   umbral, y **no** reintenta cuando sí alcanza — medido con `llamadas.supadata` contra los videos
   que dispararon el reintento.
4. 🐤 **Canario:** `select count(cobertura_seg) from app.transcripciones` nace en **cero** por
   definición (la migración no backfillea). La primera fila la escribe el motor la próxima vez que
   transcriba un video, no una verificación manual.
