# Plan · Migrar la búsqueda de contenido a Virlo

> **Estado: PROPUESTA** (2026-09-28), pendiente de que Mani confirme las decisiones de §3.
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
| **Virlo** | El carril principal de búsqueda: **un agente por voz**, con keywords que salen de sus proyectos. |

**Plata:** con un agente por voz y una corrida semanal, **13 USD/mes (estándar) o 39 USD (con Data
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

## 3. Lo que Mani tiene que confirmar

| # | Decisión | Propuesta | Por qué | Alternativa |
|---|---|---|---|---|
| **D-1** | ¿Qué carril es el principal, y con qué grano? | **Agentes (A), uno por voz** ✅ *dirección de Mani, 28/09*. Los proyectos pasan a ser **cajones** donde se reparte lo que trae el agente de la voz, y sus N dicen cómo repartir, no cuánto buscar. Se suman corridas (hasta diaria) o un segundo agente **solo si la voz se queda corta**. Tracking de referentes (B) solo para un puñado de cuentas. | Un agente por proyecto compraría varias veces los mismos videos (los proyectos de una voz se pisan) y sobregastaría. El B tiene el mismo techo que hoy y cuesta 3-15× Apify ([02 §2](./02-arquitectura.md)). ⚠️ El riesgo es que **falte**, no que sobre: ~280 videos por corrida son ~9-11 aprobados con el piso de 500k, contra ~46/semana que pide una voz ([04 §3](./04-operacion-y-costos.md)). | Un agente por proyecto · replicar el roster en Virlo (el plan de Alejo). |
| **D-2** | ¿Supadata se va? | **Pasa a respaldo** *(cambiada el 01/10 por la respuesta de Virlo)*. La ingesta lee el transcript de Virlo (`include_transcript=true`, gratis). `source: transcribed` trae tiempos ⇒ la regla de cobertura de ADR-095 corre igual (`cobertura` = último `segments.end`, `duración` = `duration`). `source: platform` no trae tiempos: se acepta como completo y la Fase 0 lo mide contra Supadata. `null` con `intelligence_status: pending` se relee a las ~6 h; `null` con el video sin voz (`is_silent`, `transcript_word_count = 0`) se descarta sin pagar; cualquier otro `null` va a Supadata. ⚠️ *(01/10, doc de Data Intelligence)*: un video con `intent_match: false` casi nunca recibe la revisión completa, y en Instagram la revisión es lo que transcribe. Si nuestro gate aprueba un reel que Virlo juzgó fuera de la intención, ese transcript lo paga Supadata: la Fase 0 cuenta cuántos. | Virlo ya transcribió para filtrar por intención: pagarlo dos veces es el desperdicio. TT/YT traen texto en ~85 %; IG en ~40 % con Data Intelligence, y casi todo el resto no tiene voz ([01 §1.4](./01-reunion-y-api.md)). El ahorro en plata es chico (Supadata es la línea más barata); lo que se gana es **un componente menos en el camino principal**, que es el dolor que se le contó a Virlo. | Supadata para todo y Virlo solo para comparar. |
| **D-3** | ¿Dónde vive la ingesta del carril nuevo? | **(c) En el cockpit**: `/api/virlo/webhook` + ejecución durable. | El carril es empujado por webhook y ya no necesita orquestador; construirlo en n8n para después sacarlo es trabajo doble; el motor de Apify queda intacto como sombra ([02 §5.2](./02-arquitectura.md)). | (a) rama en el motor · (b) workflow chico de n8n. |
| **D-4** | ¿El gate de Haiku sigue? | **Se mide, no se decide.** Corren los dos en la sombra. | `intent_match` juzga con una frase; el gate con los criterios completos ([02 §6](./02-arquitectura.md)). | |
| **D-5** | ¿En qué idiomas busca cada voz? | `english_only: false`, **ninguna keyword en español**, y lo que se cuele se descarta gratis con `language_detected = es` antes de transcribir. **Un agente por voz con keywords mezcladas** (EN + PT + FR) por defecto; pasar a un agente por idioma **solo en la voz donde la Fase 0 muestre que la mezcla rinde peor**. | Virlo confirmó (01/10) que mezclar funciona: cada keyword busca en su idioma y no traducen. Andrés recomienda uno por idioma (reportes en un idioma, resultados más limpios), pero eso multiplica el costo por la cantidad de idiomas. El reporte en un solo idioma le importa al lado tracker (PreWave), no al Feed. **Vara, escrita antes de medir:** si la mezcla da ≥ 80 % de la aprobación del agente de un solo idioma, se queda la mezcla. | Un agente por idioma (lo que recomienda Virlo). Qué idiomas, lo decide el equipo de media. |
| **D-6** | ¿Cómo es la sombra? | **Visible**: los candidatos de Virlo entran al Feed real marcados con su origen, en **1 o 2 voces piloto**. | La métrica (ADR-089) necesita que el equipo apruebe. Una sombra invisible mide volumen, no calidad. | Sombra invisible (solo registro). |
| **D-7** | ¿Data Intelligence? | **Sí, obligatoria** *(01/10)*. | **Sin ella no hay transcript de Instagram** (IG no publica transcripts y Virlo solo transcribe en agentes con Data Intelligence). Además: filtros antes de pagar, encaje con la voz, aprendizaje por característica ([05 §2](./05-payloads-y-decisiones.md)). Se mide que llegue a tiempo y en ~94 % de los videos. | Estándar (un tercio del costo), solo si el equipo decide no usar Instagram. |
| **D-8** | ¿En qué plataformas busca el agente? | **Las tres** (default), y se filtra al leer. | Virlo cobra por corrida y filtrar por `platforms` al leer es gratis: sacar YouTube del agente no abarata nada, y por lo que dijo Andrés cada keyword se busca en cada plataforma por separado, así que tampoco sube la cuota de Instagram (**preguntado a Andrés el 01/10**; si no contesta, lo mide la Fase 0). Lo que sí hay que decidir es si **un Short de YouTube cuenta como referente** (P-YT, §5). | `platforms: ["instagram","tiktok"]` si el equipo descarta YouTube y la Fase 0 muestra que no cambia el volumen de IG. |
| **D-9** | ¿Autopilot prendido en el piloto? *(01/10)* | **Prendido en una voz piloto y apagado en la otra** (D-6 ya pide 1-2 voces). | Autopilot **aplica solo, no propone** ([06 §2.2](./06-mapa-doc-virlo.md)): viene prendido en todo agente recurrente y cambia keywords después de cada corrida. Prendido en las dos, la Fase 3 no puede separar "Virlo trae mejor" de "autopilot movió las keywords"; partido, la diferencia entre las dos voces *es* la medición. Nunca borra nuestras keywords ni cobra más, así que el riesgo es de medición, no de plata. La Fase 0 usa agentes de una corrida y no lo tiene. | Prendido en todas (lo que vende Virlo) · apagado en todas (medición limpia, se pierde lo que más promete). |

---

## 4. Fases

Cada fase tiene su **verificación**: sin ella la fase no está cerrada.

### Fase 0 · Preguntar y sondear (sin tocar el sistema) · ~8 USD

1. ✅ **Correo a Virlo enviado por Mani (28/09) y respondido por Andrés (01/10)**: las seis respuestas
   y qué cambia cada una, en [01 §1.4](./01-reunion-y-api.md).
2. ✅ **Crédito pedido** (Mani, 01/10) para la cuenta `administrativa@retiagrowth.com`. Falta: la
   **API key** del pipeline (al `.env` y al gestor) y **ver el crédito cargado** con
   `GET /account/balance` antes de crear el primer agente.
3. **Sonda de agentes** con `sonda-virlo.mjs agent` (extendido): **4 agentes de una corrida con Data
   Intelligence** (~6 USD), **uno por voz**, con keywords que salen de sus proyectos:
   - 2 voces en inglés: una de psicología (María José Sánchez) y una de trading (Juan Pablo Vieira).
   - La misma voz de psicología con **keywords mezcladas EN + PT + FR** (D-5).
   - La misma voz de psicología **solo en portugués**, para comparar contra la mezclada.
   La intención se escribe **en el formato que recomienda Virlo** (*[Goal] [content type] about
   [niche], not [exclusion]*), con variaciones para elegir (decisión de Mani, 28/09), y las keywords
   se pasan por `suggest-keywords` (gratis).
4. De cada corrida se toman los videos con `min_views=500000` e `intent_match=true`, se leen **con
   `include_transcript=true`** (Supadata solo para los `null` y para comparar ~20 transcripts
   `platform` contra el suyo), se pasan por el gate actual (fuera de n8n, con el arnés de `test-nodos.mjs`) y **se
   le dan al equipo para calificar**, sin decirle de dónde vienen.

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

**Verificación:** una tabla en [04 §3](./04-operacion-y-costos.md) con los números medidos en vez de
los supuestos, y un veredicto de **sigue / no sigue** contra la fila en negrita.

### Fase 1 · Decisiones escritas

1. Cerrar D-1 a D-9 con los números de la Fase 0.
2. Reescribir **ADR-101**: *el eje vuelve a ser el tema, con intención*. Enmienda
   [ADR-019](../adr/ADR-019-remocion-total-eje-keyword.md) y [ADR-098](../adr/ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md).
3. Reescribir la **`046`** para lo que se decidió: `app.agentes_virlo` (voz, `agent_id`,
   idioma, intención, keywords, excluidas, cadencia, Data Intelligence, activo),
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
   `processed_items` y el Feed, tomar el transcript de Virlo (Supadata de respaldo, D-2), traducir, gate (si D-4 lo deja),
   **repartir en los proyectos de la voz** (cada video a un solo proyecto, hasta su N), escribir
   `candidatos` + `runs` con el **mismo contrato** que hoy.
2. **Agentes recurrentes** para las voces piloto (1 por semana; más solo si se quedan cortas).
3. **Pre-flight y vigilancia del saldo** ([04 §4](./04-operacion-y-costos.md)).
4. **En el cockpit:** la voz muestra su agente (intención, keywords, idiomas, última corrida,
   salud) y el Feed muestra el origen de cada candidato.

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
