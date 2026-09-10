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

### 📏 El histograma (Tarea 3, 09/09) — el umbral ya no está sin número

`medir-cobertura.mjs --medir --apply` corrió sobre las 584 filas de `app.transcripciones` con
`origen = 'motor'` y `estado = 'listo'`. Escribió `cobertura_seg`/`duracion_seg`/`modo`: las tres
pasaron de 0 a **583** (1 fila quedó sin duración). Supadata contestó las 584 (0 sin cobertura).

**Histograma de `cobertura/duración` (n=583): mediana 0.996, p10 0.958.**

```
  0.0–0.1   1        bajo 0.7:  10  (1.72%)
  0.1–0.2   0        bajo 0.8:  12  (2.06%)
  0.2–0.3   3        bajo 0.9:  22  (3.77%)
  0.3–0.4   0        bajo 0.95: 46  (7.89%)
  0.4–0.5   2
  0.5–0.6   1
  0.6–0.7   3
  0.7–0.8   2
  0.8–0.9  10
  0.9–1.0  561
```

**Cobertura por duración de video** (no se degrada con la duración, salvo el único largo):

```
  0-30s    n=80   mediana 0.991   bajo 0.8: 5 (6.3%)
  30-60s   n=278  mediana 0.995   bajo 0.8: 3 (1.1%)
  60-120s  n=204  mediana 0.997   bajo 0.8: 2 (1.0%)
  120-300s n=20   mediana 0.994   bajo 0.8: 1 (5.0%)
  300s+    n=1    mediana 0.457   bajo 0.8: 1 (100%)
```

**El umbral elegido es `0.9`.** El dato NO distingue 0.8 de 0.9: 561 de 583 filas están arriba de
0.9, sólo 10 caen en la banda intermedia (0.8–0.9), y 12 ya están abajo de 0.8. Se elige por
**recall** y no porque el histograma marque un quiebre ahí — un falso positivo (marcar "parcial" un
video sano) es **inofensivo por construcción**: `mejor()` sólo escribe si el candidato cubre más
segundos que el guardado, así que reintentar un video sano cuesta 2 créditos y no puede pisar nada
bueno. La diferencia entre 0.8 y 0.9 como umbral son ~20 créditos por corrida (las 10 filas de la
banda intermedia, a `generate` = 2 créditos).

**Qué recupera el reintento con `generate`, medido sobre los 12 cortados** (4 recuperan entero, 7 no
mejoran, 1 no se pudo medir):

```
DcNGcHKR_qk   25.9s   0.04 -> 0.99   RECUPERA (tenía UN carácter para 25.9s)
Db9Y_EGulGk  150.4s   0.28 -> 1.00   RECUPERA
Da3LY_Sx-zm   44.3s   0.43 -> 0.99   RECUPERA
DWESazbDU4g   76.5s   0.73 -> 1.00   RECUPERA
DYTvNduEW5X   24.0s   0.68 -> 0.15   generate PEOR que auto
DbHEVZkP5uJ  550.6s   0.46 ->  -     HTTP 202 {"jobId":"..."}, no medible sincrónicamente
(los otros 6: no mejoran)
```

🔑 **`DYTvNduEW5X` confirma medido lo que §3.3 ya tenía como decisión de diseño**: se elige por
cobertura, no por largo. Si el criterio hubiera sido "cuál trae más texto", este video se habría
pisado con una respuesta que cubre *menos* (0.15 contra 0.68).

💡 **Hipótesis a re-medir, explícitamente NO implementada.** Entre los 12 cortados, los 4 que
recuperan con `generate` tienen huecos absolutos (`duracion − cobertura`) de 20.7s a 108.9s, y los 7
que no mejoran, de 2.3s a 22.4s — un corte por "hueco mayor a ~20s" los separaría casi perfecto. Con
**n=12 eso es sobreajuste**: no se implementa un segundo criterio de reintento sobre 12 casos. La
columna `cobertura_seg` (y `duracion_seg`) es justamente lo que permite re-medir esta hipótesis
cuando haya más datos, sin volver a pagar nada.

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
caché —que se pagan igual— dan el histograma completo de `cobertura/duración`.

✅ **Medido (Tarea 3, 09/09): el umbral es `0.9`.** Ver §📏 arriba — el histograma no marca un
quiebre entre 0.8 y 0.9 (561/583 arriba de 0.9, 10 en el medio, 12 abajo de 0.8); se eligió 0.9 por
recall, porque un falso positivo es inofensivo por construcción (§📏).

### §3.5 · Fail-open, igual que el resto del nodo

Sin duración no hay veredicto y el transcript pasa como hoy; si el reintento falla, queda el de
`auto`. **El peor caso del arreglo es el comportamiento actual.** Es el invariante #1 de PLAN §2.5.

### §3.6 · El aviso hoy **sólo puede existir para Instagram**, y eso no estaba escrito

`domain/video.ts::duracionDeItemApify` lee únicamente `item.videoDuration`, y `lib/apify.ts`
hardcodea `plataforma: "instagram"`. La duración de TikTok vive en otro campo — el motor la saca de
`item.videoMeta.duration` en `Normalizar TT` — así que **`app.videos_meta` nunca va a tener
`duracion_seg` para un video de TikTok**.

Consecuencia directa sobre este ADR, y es la parte nueva: sin duración el veredicto es
`desconocido`, y `avisoDeCobertura` no dibuja nada para `desconocido` (a propósito, §3.5). O sea que
**la pantalla nunca va a avisar de un guion de TikTok cortado**, aunque lo esté. No es un fallo
ruidoso: es la mitad del sistema en silencio.

La limitación de plataforma es **preexistente** (el cockpit compra metadata sólo de Instagram desde
ADR-072); lo que es nuevo es esta consecuencia. Se escribe y **no se arregla acá**: soportar TikTok
es tocar `lib/apify.ts` y el normalizador, que es otro alcance. Lo que sí cambia hoy es la
verificación manual — `docs/verificaciones-humanas.md` exige ahora **un link de Instagram Y uno de
TikTok**, porque probar sólo con Instagram pasa en verde tapando exactamente esta mitad.

## Enmienda — el review final (2026-09-10)

Cinco arreglos sobre lo ya implementado. Los tres primeros son bugs de verdad, medidos en el código:

1. 🩸 **El arreglo de la Tarea 5 no persistía.** Un hit de caché parcial cae a `pendientes` y se
   re-transcribe, el motor consigue algo mejor… y `POST Transcripciones` lo tira, porque manda
   `Prefer: resolution=ignore-duplicates` y la fila ya existe. Cada corrida futura lo volvía a pedir
   y a tirar, **sin tope**. No se arregla con `merge-duplicates`: el `on_conflict` es
   `(instance_id, plataforma, external_id)` y las filas **manuales** de Majo comparten ese espacio de
   llaves (`origen` no es parte del arbiter), así que un merge del motor podría pisarle su
   transcripción. Se arregla **dejando de pedirlo**: la migración
   [`040`](../../core/schema/040_cache_modo.sql) suma `modo` al `returns table` de
   `app.cache_transcripts`, y el nodo saltea el re-pedido cuando el hit ya vino en `modo =
   'generate'` — el techo de Supadata: si con eso siguió corto es irrecuperable (`Day8CXdBLwK`).
   El criterio ya estaba escrito en `medir-cobertura.mjs`; lo que faltaba era que el motor lo viera.
2. 🩸 **`buscarDuracion` podía destruir una transcripción ya pagada.** Tiraba si PostgREST devolvía
   error, y se la llamaba **antes** de `marcarResultado({estado: "listo"})`, dentro del `try` cuyo
   `catch` marca la fila como `fallo`: un 5xx transitorio perdía el transcript de Supadata **y** la
   traducción de Haiku, y Majo re-pagaba las dos. Es lo contrario de §3.5. Ahora pasa por
   `duracionOpcional` (dominio puro, probada con una búsqueda que tira): sin duración, sin aviso, y
   el guion guardado igual.
3. 🩸 **Con `content: []` el motor y el cockpit producían textos distintos.** `Array.isArray([])` es
   `true`, así que el nodo entraba a la rama de segmentos, sacaba `""` y **nunca miraba `text`**;
   la app preguntaba `segmentos.length > 0` y sí usaba el fallback. El mismo video daba guion en el
   cockpit y "sin voz" en el motor — el invariante de ADR-009, roto en silencio. La elección de rama
   es ahora una función compartida (`textoDeRespuesta` / `coberturaDeRespuesta`), copiada al nodo
   dentro del bloque textual.
4. **El mecanismo de §3.2 pinzaba 1 de 3 funciones, y dejaba libre la del invariante.**
   `CASOS_COBERTURA` es una tabla de `(cobertura, duracion, umbral) → veredicto`, así que sólo podía
   ejercitar `veredictoCobertura`; `textoDeSegmentos` **ya había divergido** (guarda de
   `Array.isArray` en una copia y no en la otra, `??` contra `||`: con `{text: 0}` daban `"0"` y
   `""`). Se agregan `CASOS_SEGMENTOS` y `CASOS_RESPUESTA`, exportadas del mismo `.ts`, y el test
   corre las **cinco** funciones contra la copia del nodo. Ganó la forma con guarda y con `??`,
   porque **no pierde texto en silencio** y porque un `.map` sobre algo que no es arreglo tumba un
   Code node entero.
5. **El umbral vivía en tres lugares con dos números.** En el nodo estaba **fuera** de los
   marcadores `⤵/⤴ COPIA TEXTUAL` (o sea, fuera de lo que el test extrae), y `medir-cobertura.mjs`
   tenía default **0.8** — el número que §3.4 descartó. Además, los 8 casos de `CASOS_COBERTURA`
   corrían todos a 0.8, así que **el 0.9 de producción no lo ejercitaba nadie**. Hoy: el umbral está
   dentro del bloque copiado, `test-nodos.mjs` compara valor contra valor, hay 4 casos nuevos a 0.9
   (uno de ellos, 40/50, separa los dos umbrales a propósito) y el default de `medir-cobertura.mjs`
   es 0.9 con su porqué escrito.

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
  para devolver las dos columnas nuevas, con sus dos `grant` explícitos (no obligatorios: el `drop`
  se lleva los privilegios pero Postgres le da `EXECUTE` a `PUBLIC` por defecto, así que
  `service_role` y `authenticated` seguirían ejecutando igual sin ellos — ver ADR-087 §Enmienda).
  Aditiva, sin backfill.
  💡 **Candidato explícito, no hecho acá:** una migración futura podría agregar `revoke execute on
  function app.cache_transcripts(uuid, text[]) from public;`, para endurecerla como la `021`
  endureció `instancias_visibles`. Decisión de Mani, no de esta migración.
- **`core/` (review final):** migración [`040`](../../core/schema/040_cache_modo.sql) — `modo` en el
  `returns table` de `app.cache_transcripts` (ver §Enmienda 1).
  ⛔⛔ **EL `n8n:push` DEL MOTOR NO SE PUEDE HACER HASTA QUE LA `040` ESTÉ APLICADA.** El nodo
  `Transcribir (Supadata)` ya lee `r.modo` de las filas del caché; sin la migración esa clave llega
  `undefined`, el corte no corta, y el parcial irrecuperable se sigue re-pidiendo en cada corrida.
  No rompe nada (fail-open), pero **el arreglo no existe hasta que la migración corra**. Mismo orden
  que exigieron la `037`, la `016` y la `014`: el consumidor no llega antes que la columna.
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
2. ✅ El histograma de `cobertura_seg / duracion_seg` sobre las filas ya existentes en
   `app.transcripciones` produce un número de umbral defendible (Tarea 3, 09/09): **umbral = 0.9**,
   ver §📏.
3. `Transcribir (Supadata)` reintenta con `generate` cuando la cobertura de `auto` no alcanza el
   umbral, y **no** reintenta cuando sí alcanza — medido con `llamadas.supadata` contra los videos
   que dispararon el reintento.
4. 🐤 **Canario:** `select count(cobertura_seg) from app.transcripciones` nace en **cero** por
   definición (la migración no backfillea). La primera fila la escribe el motor la próxima vez que
   transcriba un video, no una verificación manual.
