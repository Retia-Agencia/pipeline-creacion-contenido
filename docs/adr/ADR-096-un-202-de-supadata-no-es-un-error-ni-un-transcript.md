# ADR-096 — Un 202 de Supadata no es un error ni un transcript

- **Estado:** parcialmente implementada — 2026-09-10. La condición que este ADR se puso a sí mismo
  (*"se retoma cuando el alcance medido deje de ser 1 de 584"*) **se cumplió**, y lo que se arregló
  es el daño que este ADR no podía prever. **El polling del `jobId` sigue sin hacerse**, ahora con
  alcance medido de nuevo: 1 video de 604. Ver §Enmienda.
- Estado anterior: propuesta — 2026-09-09 (con Mani, encontrado midiendo el histograma de ADR-095),
  decisión explícita de documentar y esperar.

## Contexto

Midiendo el reintento con `generate` sobre los 12 transcripts cortados de ADR-095 apareció un caso
que los otros 11 no tienen: `DbHEVZkP5uJ` (550.6 s, el video más largo del lote) respondió **HTTP
202** con cuerpo `{"jobId": "..."}` en vez de un transcript. Supadata tiene un modo asíncrono para
trabajos largos: en vez de devolver el resultado en la misma llamada, agenda un job y hay que volver
a preguntar por `jobId` (polling) para obtener el transcript cuando esté listo.

### Por qué es mudo hoy

Ninguno de los dos consumidores de Supadata contempla este modo:

- **`apps/dashboard/lib/transcribir.ts`**, en su **guarda de status** (`if (!res.ok &&
  !cuerpo?.error) { throw ... }`): `202` es un código `2xx`, así que `res.ok` es `true` y esa línea
  no dispara. Y en la **elección de texto** que viene justo después (hoy `textoDeRespuesta(cuerpo)`,
  en `domain/cobertura.ts`), una respuesta `{jobId: "..."}` no trae `content` ni `text`, así que
  `texto` queda en `""`. La función devuelve `{ texto: "", idioma: "", cobertura: null }`:
  **exactamente la misma forma que "el video no tiene voz"**. Nada distingue los dos casos en el
  tipo de retorno.
  *(Se citan por NOMBRE de bloque y no por número de línea: la rama del review final ya movió esas
  líneas dos veces — una cita por número envejece en el commit siguiente.)*

- **El nodo `Transcribir (Supadata)`** de `Workflows/workflow-short-form-content/workflow.json`, en
  el `_uno` del pool: `this.helpers.httpRequest(...)` con `json: true` no lanza para un `202` (es
  éxito HTTP). La respuesta cae en la elección de texto (hoy `textoDeRespuesta(resp)`, dentro del bloque
  `⤵ COPIA TEXTUAL`), que da `''` porque el cuerpo trae `jobId` y no `content` ni `text`. Como `String(txt).trim()` es falso, **no** se marca `definitivo = true` por ese camino;
  tampoco por `_sinVoz` (`resp.error !== 'transcript-unavailable'`). El código sigue al `for` del
  reintento: **agota los `RETRIES = 4` intentos** (4 reintentos + el original = 5 llamadas) contra un
  job que no va a completar sincrónicamente ninguna de las 5 veces, y termina sin marcar `resueltos`
  ni escribir nada más que `cache[id] = { txt: '', lang: '' }`.

**Consecuencia medida:** el motor paga **5 créditos** por un video largo (`auto` cuenta como 1
crédito cada intento, según ADR-095 §1) y no se trae ningún texto. El video queda como si no tuviera
voz, sin que nadie —ni un log distinguible, ni un estado en `app.transcripciones`— se entere de que
la causa fue "está procesándose todavía" y no "está mudo".

### Alcance medido, sin inflarlo

Sobre las **584** filas de `app.transcripciones` con `origen = 'motor'` medidas para ADR-095, **1
sola** supera los 300 segundos (la misma `DbHEVZkP5uJ`, 550.6 s, la que disparó este hallazgo). La
tabla de cobertura por duración de ADR-095 muestra que el resto (0-300s, 582 filas) no tiene este
problema: la cobertura no se degrada con la duración salvo en ese único video largo. Es una falla
**latente**, no una sangría activa — los referentes que sigue el pipeline publican mayormente reels
cortos (30-120s concentran el grueso de las 583 filas).

## Decisión

**Se documenta y no se arregla ahora.** El polling de `jobId` cambia el contrato con Supadata: una
llamada que hoy es sincrónica (pedís, esperás, tenés la respuesta) pasa a ser asíncrona (pedís,
recibís un ticket, volvés a preguntar hasta que esté listo). Eso toca a los dos consumidores:

- El nodo de n8n necesitaría un bucle de espera/reintento distinto del que ya tiene para 429/timeout
  (que reintenta la llamada completa, no continúa un job en curso), con su propio presupuesto de
  tiempo dentro del presupuesto del nodo (`BUDGET_MS`, ya ajustado).
- `apps/dashboard/lib/transcribir.ts` corre detrás de una ruta con `maxDuration = 60` (mismo límite
  que descartó la fachada síncrona en ADR-095 §3.2): un polling real ahí pide cola, no una llamada
  directa.

Ninguno de los dos cambios es una línea suelta, y el alcance medido (1 de 584) no justifica
diseñarlos a ciegas en esta sesión. **Decisión explícita de Mani: se anota, se espera a que aparezca
de nuevo, y ahí se dimensiona con más de un caso.**

## Consecuencias

**A favor**
- No se gasta tiempo de diseño en un transporte asíncrono para un caso que hoy es 1 en 584.
- El hallazgo queda escrito con su línea exacta en los dos consumidores: la próxima vez que un video
  largo entre al pipeline y salga "sin voz" sin serlo, no hay que re-diagnosticar desde cero.

**En contra, dicho sin eufemismo**
- 🩸 **El motor sigue pagando 5 créditos por nada** cada vez que un video largo dispara el modo
  asíncrono, y el fenómeno crece si el catálogo de referentes empieza a incluir contenido más largo
  (la tabla de ADR-095 ya muestra que 120-300s no es una franja vacía: 20 filas).
- 🩸 **Y el reintento por cobertura de ADR-095 AUMENTA la exposición a este 202, no la deja igual.**
  El reintento dispara `mode=generate` justo sobre los videos con poca cobertura, que son en buena
  medida **los largos** — o sea exactamente la población que Supadata manda al modo asíncrono (el
  caso que originó este ADR, `DbHEVZkP5uJ`, es el video más largo del lote cortado). Cada uno de
  esos reintentos puede volver `202` y contarse como "no mejoró", gastando un crédito más y dejando
  el mismo silencio. No cambia la decisión de no arreglarlo ahora —el alcance medido sigue siendo 1
  de 584— pero sí el número de veces por corrida en que puede aparecer, y por eso queda escrito.
- El síntoma sigue siendo indistinguible de "video sin voz" en cualquier lectura actual del sistema
  (logs, `app.transcripciones`, el Feed) hasta que alguien lo arregle.

## Alternativas descartadas

- **Arreglarlo ahora, dentro de la Tarea 3/4 de `plan-transcript-completo.md`.** Ese plan resuelve
  "cuánto del video cubrió el transcript" (ADR-095); esto es "la llamada ni siquiera volvió con un
  transcript todavía". Son dos bugs distintos con un síntoma que se toca por casualidad (ambos
  aparecieron mirando los mismos 12 videos cortados) — mezclarlos en el mismo cambio arriesga el
  scope de los dos.
- **Tratar el `202` como error y hacer `throw`.** Resolvería el síntoma de "mudo silencioso" sin
  resolver el problema real: el video sigue sin transcript, y encima ahora rompe la corrida en vez
  de degradarse. Fail-open (invariante #1 de PLAN §2.5) sigue siendo mejor que fail-closed para un
  nodo de compra.

## Toca

- **Nada todavía.** Cuando se implemente: `apps/dashboard/lib/transcribir.ts` (su guarda de status
  y el tipo `Transcripcion`) y el nodo `Transcribir (Supadata)` de
  `Workflows/workflow-short-form-content/workflow.json` (el bucle de `_uno`).

## Hecho cuando

No aplica — este ADR es un registro de un hallazgo con decisión de **no implementar**, no un plan de
trabajo. Se retoma cuando el alcance medido deje de ser 1 de 584.

Enlazado desde [ADR-095](./ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md) (el
hallazgo salió midiendo su Tarea 3) y desde el [índice de ADRs](./README.md).


---

## Enmienda (2026-09-10) — la espera se acabó sola, y lo que había que arreglar era otra cosa

Corriendo la Tarea 9 de [plan-transcript-completo](../agents/plan-transcript-completo.md) (completar
los 23 transcripts cortados que ya estaban en la base) el `202` apareció **4 veces en un lote de
23**, no 1 en 584. Con eso se cumple la condición de arriba. Pero lo que la medición destapó no fue
lo que este ADR esperaba encontrar.

### 1 · Lo que este ADR no podía prever: el candado se ponía sobre un video que nadie midió

Este ADR se escribió el **09/09**. `auto_tras_generate` nació el **10/09**
([ADR-095 §Enmienda 3](./ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md)). Al juntarse,
el hallazgo dejó de ser "una falla latente que gasta créditos" y pasó a **corromper datos**:

`202` cae adentro de `res.ok`, así que la respuesta llegaba a `modoResultante` como `gano = false`
—**indistinguible de "generate se probó y perdió"**— y el video quedaba marcado
`auto_tras_generate` **para siempre**. El candado que existe para no re-pagar lo que ya se midió
terminaba puesto sobre lo único que **nunca** se midió, y ningún `count(*)` lo habría delatado: un
candado falso se ve idéntico a uno legítimo.

🔑 **El criterio correcto ya estaba escrito, a cinco líneas de distancia**, en el `catch` de
`transcribirConReintento`: *"una caída de red no es un veredicto sobre el video"*. El `202` se le
colaba por adelante **porque no tira excepción**.

**Arreglado** en las tres copias, con la distinción que da todo el valor: un video **mudo**
(`transcript-unavailable`) sí es un veredicto y sí merece candado; un **encolado** no se midió
nunca.
- `domain/cobertura.ts`: `esTranscriptEncolado(cuerpo, status)` + la tabla `CASOS_ENCOLADO`, y
  `modoResultante` gana un tercer parámetro **sin default**, para que el compilador obligue a los
  call sites. El del nodo lo obliga `test-nodos.mjs`, que pinza los cuatro desenlaces valor contra
  valor.
- `lib/transcribir.ts`: el tipo `Transcripcion` gana `encolado` — exactamente lo que la §Toca de
  este ADR pedía, y por el motivo que decía: sin ese campo, un `202` tiene la misma forma que "el
  video no tiene voz".
- El nodo `Transcribir (Supadata)` y `medir-cobertura.mjs` (que además dejó de re-pagar para siempre
  los que `generate` contesta vacíos **de verdad**).

### 2 · Y la causa no es la que este ADR supuso: es la CONCURRENCIA, no la duración

Este ADR lo leyó como un problema de videos largos (*"el video más largo del lote"*). Medido el
10/09, no es eso:

| medición (10/09) | resultado |
|---|---|
| 23 cortados, `generate` con **8 llamadas en vuelo** | 4 encolados (`202`) |
| esos mismos, **de a uno** (`--concurrencia 1`) | **3 de 4 contestan `200` con transcript** |
| `generate` que SÍ contesta | **9 s y 13 s** (videos de 76 s y 150 s) |
| el `202` en llegar | **91 s** |

**El mismo video que a 8 en vuelo devuelve `202`, pedido solo devuelve el transcript.** Supadata
encola por carga, y la duración sólo correlaciona. El único que se encoló **estando solo** es el de
**550,6 s** (`3947142661160278921`, el que originó este ADR).

Consecuencia práctica que ya se cobró: **`Db9Y_EGulGk`** (`3962433134007046564`), el caso estrella
de ADR-095 §1 —*"cortado, `generate` lo salva entero"*— se daba por perdido, y bajó de concurrencia
**se recuperó entero: 41,5 s → 150,2 s de 150,4**.

### 3 · El timeout: dos números distintos, y el criterio es el presupuesto de quien llama

Con `generate` contestando en 9-13 s, **el timeout nunca fue la causa raíz**. Lo que sí hace un
timeout de 90 s es **esperar 91 s a un `202` que no dice nada**, y eso sí importa donde hay
presupuesto:

- **`lib/transcribir.ts` → 25 s para `generate`** (90 s para `auto`, sin cambio). Esa ruta corre con
  `maxDuration = 60`: una llamada que pasa el minuto no devuelve un guion, **mata la función, deja
  la fila sin marcar y la pasada siguiente la vuelve a pagar**. Esperar más ahí no es paciencia, es
  gasto.
- **El nodo del motor queda en 90 s, a propósito.** No tiene techo duro como la ruta, y no hay
  medición que diga que 90 s esté mal. Bajarlo sin datos abortaría `generate` legítimos bajo carga
  y se leería como "el reintento no mejora nunca".
- `medir-cobertura.mjs` queda en 240 s: es una herramienta sin presupuesto, y ahora tiene
  `--concurrencia` para no provocar el `202` en primer lugar.

⚠️ Los tres datos de latencia son a **concurrencia 1**. Si aparece un `generate` legítimo que tarda
más de 25 s bajo carga, ese número lo estaría abortando.

### 4 · Lo que sigue SIN hacerse, y ahora con su alcance medido

**El polling del `jobId`.** Ninguna concurrencia salva al video de 550,6 s: se encola aun estando
solo. Al 10/09 queda **1 fila de 604** (`3947142661160278921`) que no se puede completar sin él,
y sigue **correctamente sin candado**, o sea que la va a agarrar quien lo implemente. El
razonamiento de por qué no es una línea suelta (bucle propio en el nodo, cola detrás de
`maxDuration = 60` en el cockpit) **no cambió** y sigue vigente en §Decisión.

Lo que sí cambió es que ya no es mudo: las tres copias lo dicen en el log, y el que lo sufre no
queda marcado.
