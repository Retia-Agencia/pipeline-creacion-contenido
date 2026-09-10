# ADR-096 — Un 202 de Supadata no es un error ni un transcript

- **Estado:** propuesta — 2026-09-09 (con Mani, encontrado midiendo el histograma de ADR-095). **No
  se implementa todavía**: es decisión explícita de documentar y esperar.

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
