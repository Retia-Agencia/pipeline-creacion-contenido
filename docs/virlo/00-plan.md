# Plan · Migrar la búsqueda de contenido a Virlo

> **Estado: DECIDIDO** (grill del 2026-10-01; propuesta del 28/09). D-2 se cierra con la Fase 0.
> Al confirmarse, este plan es el dueño de la migración y
> [plan-migracion-virlo.md](../agents/plan-migracion-virlo.md) (Alejo, 28/09) pasa a antecedente.
> Hasta entonces **no se aplica nada, no se empuja nada y no se gasta nada.**
>
> **Cambios de la misma sesión (28/09, tarde):** el agente pasa a ser **por voz, no por proyecto**
> (D-1, decisión de Mani: los proyectos son variedad dentro de la voz); se aclaró cómo maneja Virlo los
> idiomas (D-5); y **el correo a Virlo se envió** ([01 §1.3](./01-reunion-y-api.md)).
>
> **Respuesta de Virlo (01/10, [01 §1.4](./01-reunion-y-api.md)):** el transcript **sí** viene en la
> API (gratis, con tiempos en Instagram), la duración también, la primera corrida mira un año atrás,
> el piloto sale gratis (50 USD de crédito) y después baja a 0,40 / 1,40 USD. Con eso **D-2 se da
> vuelta, D-7 se vuelve obligatoria y D-5 se acota**; y aparece un riesgo nuevo: **la mitad de lo que
> trae un agente es YouTube** (P-YT en §5). La doc de Virlo, sección por sección:
> [06-mapa-doc-virlo.md](./06-mapa-doc-virlo.md).

## Los documentos

| Parte | Doc | Qué tiene |
|---|---|---|
| 1 | [01-reunion-y-api.md](./01-reunion-y-api.md) | Todo lo que se habló con Virlo (afirmación por afirmación, contrastada con la doc) y la API entera: agentes, las dos modalidades de corrida, los datos de cada video, tracking, lookups, webhooks, límites. |
| 2 | [02-arquitectura.md](./02-arquitectura.md) | Dónde encaja Virlo: los dos carriles, la arquitectura objetivo, qué reemplaza pieza por pieza, y las respuestas a "¿se va Supadata?" y "¿se va n8n?". |
| 3 | [03-revision-plan-alejo.md](./03-revision-plan-alejo.md) | Lo que Alejo dejó en `main`: qué se adopta, qué falta, qué se refactoriza, qué se quita. |
| 4 | [04-operacion-y-costos.md](./04-operacion-y-costos.md) | Modelo de costo por corrida, escenarios mensuales, rendimiento predicho, cómo se vigila el saldo, rollback, secretos. |
| 5 | [05-payloads-y-decisiones.md](./05-payloads-y-decisiones.md) | Qué trae cada respuesta de la API, campo por campo, y qué decisiones habilita: filtros antes de pagar, encaje con la voz, Feed, aprendizaje, salud de la corrida. |
| 6 | [06-mapa-doc-virlo.md](./06-mapa-doc-virlo.md) | La doc de Virlo (`dev.virlo.ai/docs`) sección por sección: qué ofrece, para qué nos sirve, qué se propone integrar, y la fecha de cada lectura. La doc se mueve: se re-mide antes de citarla. |
| 7 | [07-refactor-tickets.md](./07-refactor-tickets.md) | 🔴 **El plan de trabajo**: los tickets en dos carriles paralelos (motor Virlo · cockpit de media) con sus dependencias, y la Etapa 2 (operación de media). **Es el que se ejecuta.** |

---

## 1. En una página

**El problema real no es Apify, es el roster.** Con el piso de 500.000 vistas, buscar dentro de 78
cuentas da 0,6 a 2,3 aprobados por semana, y la demanda es ~300 (6 voces × ~200 guiones al mes).
Cambiar de proveedor sin cambiar el eje no arregla eso ([costos.md §4.1.1](../costos.md)).

**Lo que Virlo cambia es el eje:** sus agentes buscan **por tema en cualquier cuenta**, filtran por
intención con IA, se agendan solos y avisan por webhook. Filtrar por vistas es gratis y se paga por
corrida, no por video.

**Lo que Virlo no hace:** no da metadata ni mp4 por URL suelta a precio razonable y no cubre
LinkedIn. *(Hasta el 01/10 esta línea decía que tampoco entregaba el transcript: sí lo entrega,
gratis, [01 §1.4](./01-reunion-y-api.md).)*

**Entonces:**

| Herramienta | Qué pasa |
|---|---|
| **Apify** | Sale de la búsqueda. Se queda chico (~7 USD/mes) para Colecciones. |
| **Supadata** | **Pasa a respaldo** (D-2, 01/10): el transcript viene de Virlo y Supadata cubre lo que llega vacío, más las pantallas de URL suelta (Transcribir, Colecciones). |
| **n8n** | **Deja de ser necesario para el carril nuevo.** El motor viejo sigue corriendo Apify como sombra y rollback hasta el corte. Apagarlo entero es otra decisión. |
| **Haiku** | Traduce siempre. El gate se mide contra el de Virlo. |
| **Virlo** | El carril principal de búsqueda: **un agente por temática**, que media crea en el cockpit y asocia a proyectos de cualquier voz (D-1). |

**Plata** *(estimado del 28/09, con un agente por voz; con agentes por temática el número depende de cuántas cree media, y la plata dejó de ser la limitante, D-10)*: con un agente por voz y una corrida semanal, **13 USD/mes (estándar) o 39 USD (con Data
Intelligence)** para las 6 voces a precio de lista, **10 o 36 USD** con el precio que ofreció Virlo
(0,40 / 1,40); con más corridas solo en las voces que se queden cortas, hasta ~50-180 USD, contra
~100 USD/mes hoy. **Por aprobado: ~0,06-0,17 USD contra 1,5-16 USD hoy.** Todo eso es predicción
hasta la Fase 0, que **sale gratis**: Virlo carga 50 USD de crédito para el piloto (01/10).

---

## 2. Qué ya está decidido (Mani, antes de este plan)

1. Migrar la búsqueda a Virlo para mejorar la herramienta, con la plata que hoy va a Apify.
2. El cockpit pasa a ser el tracker de la operación de media (dirección del 25/09).
3. El motor se puede refactorizar entero si eso mejora el output (26/09).
4. Sumar al pipeline lo aprendido de PreWave (**frente aparte**; acá solo se anota el encaje,
   [02 §7](./02-arquitectura.md)).

## 3. Decisiones

> **Cerradas por Mani en un `/grill-with-docs` el 2026-10-01**, salvo D-2, que se cierra con los
> números de la Fase 0. 🧭 **El cambio grande: el centro deja de ser la voz y pasa a ser el Agente
> (una temática).** Lo crea y lo opera el equipo de media desde el cockpit; los proyectos de
> cualquier voz se le asocian, y Claude asigna cada video a uno de ellos. Términos en
> [context.md](../agents/context.md) (*Agente*, *Asignación*).

| # | Decisión | Cerrada | Por qué | Descartado |
|---|---|---|---|---|
| **D-1** | ¿Con qué grano busca Virlo? | **Un agente por temática** ✅. Lo crea media desde el cockpit, con su intención y 7 a 12 keywords en el formato de la doc de Virlo (visible en la pantalla, para que se entienda cómo va a buscar), y le asocia proyectos **de cualquier voz**, que se prenden y apagan ahí. Tracking de referentes (B) solo para un puñado de cuentas. | Un agente rinde con keywords que son sinónimos de **una** idea: Virlo midió en ~11.000 corridas que 7-12 keywords de un mismo tema son lo que menos se descarta por fuera de tema. Una voz con 7 proyectos (Francisco) son 7 ideas: con un agente por voz quedaban 1-2 keywords por proyecto o una intención difusa. *(Hasta el 01/10 decía "uno por voz", dirección del 28/09.)* | Uno por voz · uno por proyecto · replicar el roster (Alejo). |
| **D-1a** | ¿A cuántos proyectos va un video? | **A uno solo** ✅ (Majo, 01/10), aunque encaje en proyectos de dos voces. | Dos voces de la agencia no graban el mismo guion, y `grabado` es por video, no por voz. | Uno por voz · todos los que pasen. |
| **D-1b** | ¿Cómo se reparte? | **En proporción al N** de cada proyecto ✅; si no alcanza, el faltante se muestra. | Mantiene D1 del 11/09 (el N es piso) y la métrica de [ADR-089](../adr/ADR-089-una-sola-metrica-aprobados-contra-lo-pedido.md) intactas. El faltante es la señal de cuándo subir corridas. | Parejo sin N · N en el agente. |
| **D-2** | ¿Supadata se va? | **Pasa a respaldo** *(se cierra con la Fase 0)*. La ingesta lee el transcript de Virlo (`include_transcript=true`, gratis). `source: transcribed` trae tiempos ⇒ la regla de cobertura de ADR-095 corre igual (`cobertura` = último `segments.end`, `duración` = `duration`). `source: platform` no trae tiempos: se acepta como completo y la Fase 0 lo mide contra Supadata. `null` con `intelligence_status: pending` se relee a las ~6 h; `null` con el video sin voz (`is_silent`, `transcript_word_count = 0`) se descarta sin pagar; cualquier otro `null` va a Supadata. Los `intent_match: false` ya no llegan acá (D-4b), así que Supadata no paga por ellos. | Virlo ya transcribió para filtrar por intención: pagarlo dos veces es el desperdicio. TT/YT traen texto en ~85 %; IG en ~40 % con Data Intelligence ([01 §1.4](./01-reunion-y-api.md)). Lo que se gana es **un componente menos en el camino principal**. | Supadata para todo. |
| **D-3** | ¿Dónde vive el carril Virlo? | **Todo en el cockpit** ✅: crear y operar agentes, gasto y saldo, `/api/virlo/webhook` + ejecución durable, asignación y Feed. El motor de n8n sigue con Apify **sin un cambio**, como sombra y rollback. **Apagar n8n entero** (motor, descubrimiento, archivado, dispatcher, error handler) es posible después del corte y es otra decisión, con su ADR. | Virlo agenda, filtra y avisa: n8n ya no aporta orquestación. Si media opera los agentes desde el cockpit, el cockpit ya habla con Virlo; la ingesta en n8n lo partiría en dos ([02 §5.2](./02-arquitectura.md)). | Workflow de n8n nuevo · rama en el motor. |
| **D-4** | ¿Quién juzga? | **Claude asigna** ✅: una llamada por video que ve el video (caption + transcript traducido) y los proyectos del agente que aceptan su plataforma, con sus criterios, y responde a cuál va **o "ninguno"** con su razón. Los "ninguno" van a descartes, visibles y rescatables. Reemplaza al gate. | Es la pregunta comparativa de [plan-refactor-motor §3bis](../agents/plan-refactor-motor.md): N puntajes por par no son comparables entre proyectos. Y cuesta menos (hoy ~1,9 llamadas por video). "Ninguno" mantiene la precisión de ADR-089 y los contraejemplos (D2 del 11/09). | Router puro · asignar marcando "encaje bajo". |
| **D-4b** | ¿Y `intent_match: false`? | **Se descarta antes de Claude, visible** ✅ ("fuera de la intención (Virlo)"), sin transcribir. En la Fase 0 una muestra sí pasa por Claude para medir la concordancia. | El filtro por tema es trabajo del agente; si falla, se arregla la intención. Esos videos casi nunca traen la revisión completa, y en IG sin ella no hay transcript. | Todo pasa por Claude · descarte sin registro. |
| **D-5** | ¿En qué idiomas busca? | **Inglés por defecto** ✅. Al crear el agente, media puede sumar idiomas de dos maneras: **mezclar** (un agente, keywords en varios idiomas, `english_only: false`) o **separar** (el cockpit crea un agente de Virlo por idioma y junta lo que traen). La pantalla dice que **cada idioma separado es su propia corrida y gasta**. | Virlo confirmó que mezclar funciona y recomienda separar. El argumento del plan para mezclar era el costo, y la plata dejó de ser la limitante (D-10). La Fase 0 mide las dos. | Solo mezcla · solo un agente por idioma a mano. |
| **D-6** | ¿Cómo es la sombra? | **Visible y a ciegas** ✅: los candidatos de Virlo entran al Feed real mezclados con los de Apify; el origen se guarda en cada fila y se ve en las métricas, **no en la tarjeta**. Se destapa al terminar el piloto. | ADR-089 necesita que el equipo apruebe, y una etiqueta "Virlo" sesga la calificación. | Con etiqueta · sombra invisible. |
| **D-7** | ¿Data Intelligence? | **Obligatoria** ✅. | Sin ella no hay transcript de Instagram ni `intent_match`. El único argumento en contra era la plata. | |
| **D-8** | ¿En qué plataformas? | **El agente busca en las tres; cada proyecto elige cuáles acepta** ✅. La asignación solo lleva un video a un proyecto que acepte su plataforma. | Virlo cobra por corrida, no por plataforma: quitar YouTube del agente no abarata nada. Así P-YT la contesta cada proyecto y no una regla global. ⚠️ YouTube necesita su regla de `external_id` (hoy `normalizar-virlo.mjs` lo deja vacío a propósito). | Lo elige el agente · global sin YouTube. |
| **D-9** | ¿Autopilot? | **Opción por agente, prendido por defecto** ✅, y el cockpit muestra qué keywords agregó y por qué (su `activity`). En el piloto, un agente con y otro sin. | Autopilot aplica solo, no propone ([06 §2.2](./06-mapa-doc-virlo.md)): nadie debería ver keywords que no escribió sin saber de dónde salen. Nunca borra las del equipo ni cobra más. | Siempre apagado · siempre prendido sin opción. |
| **D-10** | ¿Quién gasta, y con qué tope? | **Media crea y opera sin tope** ✅ (Mani, 01/10: *"la plata no es limitante ahora, solo se recarga"*). Lo obligatorio es el **registro**: cada acción sobre un agente en `app.eventos` (quién, qué), el costo de cada corrida, y el saldo leído después de cada corrida. **Recarga automática prendida en Virlo**, y el cockpit avisa (y reactiva con un clic) si ve un agente pausado por saldo. | Virlo **no tiene API del historial de gastos** (solo el saldo, y el detalle en su dashboard), así que el libro lo llevamos nosotros. 🩸 Si el saldo llega a cero, Virlo pausa los agentes **y recargar no los reactiva**: sin auto-recarga y aviso, todo queda apagado en silencio. | Aprobación para activar · solo admin crea. |
| **D-11** | ¿Dónde vive el umbral de vistas? | **Ajuste por agente, default 500k** ✅, y el Feed muestra el **Virality Score** de Virlo al lado de las vistas. | El 500k es instrucción del jefe y esa conversación no la cierra un dev ([plan-refactor-motor](../agents/plan-refactor-motor.md)); esto la deja medible: qué se aprueba con cada vara. 500k es el top 3 % en IG y el 15 % en TikTok. | Global · por plataforma. |

---

## 4. Fases

> 🔴 **Las fases se ejecutan como tickets en [07](./07-refactor-tickets.md)** (Fase 0 = A2 + B0;
> Fase 1 = ADR-102 ✅ + T0; Fase 2 = A1, A3-A5, B1-B5; Fase 3 = V-11; Fase 5 = V-12). Acá queda el
> porqué y las predicciones; el estado de cada cosa se marca allá.

Cada fase tiene su **verificación**: sin ella la fase no está cerrada.

### Fase 0 · Preguntar y sondear (sin tocar el sistema) · ~8 USD

1. ✅ **Correo a Virlo enviado por Mani (28/09) y respondido por Andrés (01/10)**: las seis respuestas
   y qué cambia cada una, en [01 §1.4](./01-reunion-y-api.md).
2. ✅ **Crédito pedido** (Mani, 01/10) para la cuenta `administrativa@retiagrowth.com`. Falta: la
   **API key** del pipeline (al `.env` y al gestor) y **ver el crédito cargado** con
   `GET /account/balance` antes de crear el primer agente.
3. **Sonda de agentes** con `sonda-virlo.mjs agent` (extendido), **agentes de una corrida con Data
   Intelligence** (~1,50 USD cada uno, del crédito gratis). **Las temáticas las escribe Majo** (D-1),
   con la intención en el formato de la doc de Virlo (*[Goal] [content type] about [niche], not
   [exclusion]*) y las keywords pasadas por `suggest-keywords` (gratis); nosotros revisamos. Esto
   prueba lo que el modelo da por hecho: **que media sabe operar un agente.**
   - 2-3 temáticas en inglés: al menos una de psicología y una de trading.
   - Una de ellas repetida **mezclando idiomas** (EN + PT + FR) y **separada** (un agente por
     idioma), para D-5.
4. De cada corrida se toman los videos con `min_views=500000`. Los `intent_match=true` se leen **con
   `include_transcript=true`** (Supadata solo para los `null` y para comparar ~20 transcripts
   `platform` contra el suyo), y una muestra de los `false` también, para medir D-4b. Todos pasan
   por la **asignación de Claude** contra los proyectos que la temática alimentaría (prototipo fuera
   del sistema), y **se le dan al equipo para calificar**, sin decirle de dónde vienen.

**Predicciones (escritas antes de medir):**

| Pregunta | Predicción | Si sale distinto |
|---|---|---|
| Videos por corrida | 200-360 | Menos de 100: el nicho está mal escrito o es chico |
| Con 500k+ vistas | ~15 % (≥ 30 videos). ⚠️ En duda desde el 01/10: la mitad del material es YouTube, donde 500k está muy arriba del top 10 % | < 10 videos: el Carril A no llena N con una corrida semanal |
| `intent_match` true entre esos | ~70 % | < 40 %: la intención está mal o Virlo no entiende el nicho |
| Coincidencia `intent_match` vs nuestro gate | ≥ 75 % | Baja: el gate se queda (D-4) |
| **Aprobación del equipo** | **≥ 25 %** (hoy 39 % sobre el roster) | **< 10 %: es ADR-019 otra vez y el Carril A se descarta** |
| Portugués vs inglés | PT trae menos volumen, aprobación igual o mejor | |
| Agente con keywords mezcladas (EN+PT+FR) | Trae los tres idiomas, aunque con menos PT/FR que el agente solo-PT | Si trae casi solo inglés: un agente por idioma |
| Aprobados por corrida por voz | ~9-11 | Si da ≥ 40: una corrida semanal por voz alcanza |
| Transcript entre los 500k+ (`include_transcript`) | TT/YT ~85 %, IG ~40 % (dato de Virlo, 01/10) | Si IG < 25 %: Supadata sigue cargando Instagram y D-2 vale menos |
| Transcript `platform` contra Supadata (~20 videos) | Mismo largo ±15 % en ≥ 90 % | Si no: los `platform` pasan por Supadata y la regla de ADR-095 |
| Plataformas en el total | IG ~15 %, YT ~50 %, TT ~35 % (dato de Virlo, 01/10) | Si IG < 10 % entre los 500k+: un agente de prueba con `platforms: ["instagram"]` para ver si la cuota sube (D-8) |
| Aprobación por plataforma | YouTube igual o algo menor que IG/TT | Si YouTube aprueba < 10 %: D-8 alternativa |
| Re-medidos por corrida (`total_videos_updated`) | > 30 % en la segunda corrida de un recurrente | Si es ~0: la re-medición implícita no existe |
| Videos con `intelligence_status: ready` al llegar el webhook | ≥ 70 % | Si es bajo: la ingesta tiene que releer más tarde antes de filtrar |

✅ **Medido el 01/10 (A2)**: [04 §3.1](./04-operacion-y-costos.md). Técnicamente sigue; falta la fila en negrita, que la contesta el equipo con la hoja ciega.

**Verificación:** una tabla en [04 §3](./04-operacion-y-costos.md) con los números medidos en vez de
los supuestos, y un veredicto de **sigue / no sigue** contra la fila en negrita.

### Fase 1 · Decisiones escritas

1. Cerrar D-2 con los números de la Fase 0, y revisar D-5 con lo que midió (mezclar vs separar).
2. ✅ **[ADR-102](../adr/ADR-102-la-busqueda-pasa-a-virlo-por-tematica.md)** (01/10, reemplaza a ADR-101): *el eje vuelve a ser el tema, con intención*. Enmienda
   [ADR-019](../adr/ADR-019-remocion-total-eje-keyword.md) y [ADR-098](../adr/ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md).
3. Reescribir la **`046`** para lo que se decidió: el **Agente** (temática, intención, keywords,
   excluidas, idiomas y modo mezclar/separar, cadencia, autopilot, umbral, activo), los `agent_id` de
   Virlo que tiene debajo (uno por idioma si se separa), su asociación con **proyectos de cualquier
   voz**, las **plataformas que acepta cada proyecto** (D-8), el **libro de gasto** (D-10),
   `candidatos.origen` (`apify` | `virlo`), tarifas de Virlo, y **de dónde salió cada transcript**
   (`virlo_platform` | `virlo_transcribed` | `supadata`, D-2): sin eso no se puede medir si el de
   Virlo rinde igual. Lo de `pool_crudo.proveedor` y las
   vistas filtradas solo si el Carril B entra en sombra.
4. Revertir en el repo la línea de `AJUSTE_MAP` que lee `proveedor_scraping` si el interruptor global
   se descarta ([03 §4](./03-revision-plan-alejo.md)).

**Verificación:** ADR aceptada, migración aplicada y medida por su efecto (PostgREST + catálogo),
`npm run validate` en verde.

### Fase 2 · El carril Virlo, en piloto

1. **Ingesta** donde diga D-3: recibir el webhook (header secreto + idempotencia por corrida), leer
   videos con `min_views`, normalizar con `external_id` desde la URL, deduplicar contra
   `processed_items` y el Feed, tomar el transcript de Virlo (Supadata de respaldo, D-2), traducir, descartar los `intent_match: false` (D-4b),
   **asignar con Claude** entre los proyectos del agente (cada video a un solo proyecto, en proporción al N, o "ninguno", D-4), escribir
   `candidatos` + `runs` con el **mismo contrato** que hoy.
2. **La pantalla de Agentes** para media: crear, editar, asociar proyectos, activar y pausar, con el formato de intención de Virlo visible y `suggest-keywords` (D-1), autopilot y sus cambios (D-9), idiomas con su costo (D-5).
3. **Libro de gasto y saldo** (D-10): eventos, costo por corrida, saldo después de cada corrida, aviso de agente pausado por saldo.
4. **En el Feed:** el origen se guarda pero no se muestra durante el piloto (D-6); el Virality Score sí (D-11).

**Verificación:** tests del dominio de la ingesta con fixtures reales de la Fase 0 (`npm test`),
`typecheck`, `build`; una corrida real de punta a punta que deje candidatos en el Feed con
`origen = virlo` y su fila en `runs` con el costo.

### Fase 3 · Medir 2-3 semanas, Apify y Virlo lado a lado

Criterio de pase, **escrito antes de mirar**:

1. En las voces piloto, `aprobados / N pedido` de Virlo **≥ 2×** el de Apify en las mismas semanas.
2. Costo por aprobado de Virlo **≤ 0,50 USD** a precio de lista.
3. Cero semanas con el Feed vacío por saldo o pausa.

Se mide también: `intent_match` contra el gate (D-4), inglés contra portugués (D-5), cuántos
videos vuelve a encontrar el agente con métricas actualizadas (re-medición implícita).

**Verificación:** la consulta de ADR-089 separada por `origen`, y el veredicto escrito en este plan.

### Fase 4 · Escalar

1. Un agente por cada voz activa; más corridas o un segundo agente solo donde falte.
2. **El aprendizaje:** lo aprobado y descartado ajusta la intención y las excluidas del agente
   (`suggest-keywords` modo `refresh`), con aprobación humana del cambio.
3. Negociar el precio con Nick con los números reales.

**Verificación:** todas las voces activas corriendo; `aprobados / N` por proyecto en la pantalla de
Corridas.

### Fase 5 · Corte

1. Desactivar el motor de Apify en n8n (no borrar). Apify queda solo para Colecciones, con su saldo
   aparte.
2. Decidir el Carril B y el workflow de descubrimiento (outliers de Virlo).
3. **ADR aparte:** ¿se apaga n8n entero? (archivado y descubrimiento son lo que queda).
4. Actualizar `costos.md`, `dev-doc.md`, `AGENTS.md`, el handoff.

**Verificación:** dos semanas con el motor de Apify apagado sin bajar `aprobados / N`.

### En paralelo (otro plan): el cockpit como tracker

Tendencias, hooks, cuentas outlier y el reporte de cada agente son gratis con cada corrida. Es el
material del frente de PreWave. Se planifica aparte, cuando la Fase 2 ya esté trayendo datos.

---

## 5. Preguntas abiertas y a quién le tocan

| Pregunta | Quién |
|---|---|
| ¿"200 guiones al mes" son 200 **aprobados** o 200 grabados? Cambia el tamaño de todo. | Equipo de media |
| ¿Se transcribe **antes** de que el equipo apruebe (como hoy) o **después** (como PreWave)? **Propuesta (01/10): antes.** El argumento de "después" era ahorrar Supadata, y con Virlo el transcript ya viene gratis; queda solo Haiku (traducir), que es centavos. | Mani (cerrable) |
| **P-YT** · ¿Un Short de YouTube sirve como referente para grabar un reel? Virlo dice que ~50 % de lo que trae un agente es YouTube. | Equipo de media |
| ¿500k absolutas o Virality Score? Virlo muestra que 500k es el top 3 % en IG y el top 15 % en TikTok. Es la conversación abierta de [plan-refactor-motor §0](../agents/plan-refactor-motor.md), ahora con datos. | El jefe (no un dev) |
| Aceptar el 0,40 / 1,40 USD después del piloto (Virlo lo ofreció el 01/10; Mani respondió que vuelve después del piloto) | Mani, con los números de la Fase 3 |
| ¿Un agente solo Instagram trae más IG por corrida? (D-8) | Andrés (preguntado el 01/10, sin respuesta) |
| Límite de duración de funciones del plan de Vercel (si D-3 = c) | Dev, con la CLI de Vercel |
| ¿Alejo está de acuerdo con el cambio de encuadre? | Mani con Alejo, antes de la Fase 1 |
