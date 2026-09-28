# Plan · Migrar la búsqueda de contenido a Virlo

> **Estado: PROPUESTA** (2026-09-28), pendiente de que Mani confirme las decisiones de §3.
> Al confirmarse, este plan es el dueño de la migración y
> [plan-migracion-virlo.md](../agents/plan-migracion-virlo.md) (Alejo, 28/09) pasa a antecedente.
> Hasta entonces **no se aplica nada, no se empuja nada y no se gasta nada.**
>
> **Cambios de la misma sesión (28/09, tarde):** el agente pasa a ser **por voz, no por proyecto**
> (D-1, decisión de Mani: los proyectos son variedad dentro de la voz); se aclaró cómo maneja Virlo los
> idiomas (D-5); y **el correo a Virlo se envió** ([01 §1.3](./01-reunion-y-api.md)).

## Los documentos

| Parte | Doc | Qué tiene |
|---|---|---|
| 1 | [01-reunion-y-api.md](./01-reunion-y-api.md) | Todo lo que se habló con Virlo (afirmación por afirmación, contrastada con la doc) y la API entera: agentes, las dos modalidades de corrida, los datos de cada video, tracking, lookups, webhooks, límites. |
| 2 | [02-arquitectura.md](./02-arquitectura.md) | Dónde encaja Virlo: los dos carriles, la arquitectura objetivo, qué reemplaza pieza por pieza, y las respuestas a "¿se va Supadata?" y "¿se va n8n?". |
| 3 | [03-revision-plan-alejo.md](./03-revision-plan-alejo.md) | Lo que Alejo dejó en `main`: qué se adopta, qué falta, qué se refactoriza, qué se quita. |
| 4 | [04-operacion-y-costos.md](./04-operacion-y-costos.md) | Modelo de costo por corrida, escenarios mensuales, rendimiento predicho, cómo se vigila el saldo, rollback, secretos. |
| 5 | [05-payloads-y-decisiones.md](./05-payloads-y-decisiones.md) | Qué trae cada respuesta de la API, campo por campo, y qué decisiones habilita: filtros antes de pagar, encaje con la voz, Feed, aprendizaje, salud de la corrida. |

---

## 1. En una página

**El problema real no es Apify, es el roster.** Con el piso de 500.000 vistas, buscar dentro de 78
cuentas da 0,6 a 2,3 aprobados por semana, y la demanda es ~300 (6 voces × ~200 guiones al mes).
Cambiar de proveedor sin cambiar el eje no arregla eso ([costos.md §4.1.1](../costos.md)).

**Lo que Virlo cambia es el eje:** sus agentes buscan **por tema en cualquier cuenta**, filtran por
intención con IA, se agendan solos y avisan por webhook. Filtrar por vistas es gratis y se paga por
corrida, no por video.

**Lo que Virlo no hace:** no entrega el texto del transcript (y en Instagram casi no existe), no da
metadata ni mp4 por URL suelta a precio razonable, no cubre LinkedIn.

**Entonces:**

| Herramienta | Qué pasa |
|---|---|
| **Apify** | Sale de la búsqueda. Se queda chico (~7 USD/mes) para Colecciones. |
| **Supadata** | **Se queda**. Es la línea más barata del sistema y Virlo no la reemplaza hoy. |
| **n8n** | **Deja de ser necesario para el carril nuevo.** El motor viejo sigue corriendo Apify como sombra y rollback hasta el corte. Apagarlo entero es otra decisión. |
| **Haiku** | Traduce siempre. El gate se mide contra el de Virlo. |
| **Virlo** | El carril principal de búsqueda: **un agente por voz**, con keywords que salen de sus proyectos. |

**Plata:** con un agente por voz y una corrida semanal, **13 USD/mes (estándar) o 39 USD (con Data
Intelligence)** para las 6 voces; con más corridas solo en las voces que se queden cortas, hasta
~50-150 USD (antes del descuento de hasta 50 %), contra ~100 USD/mes hoy. **Por aprobado: ~0,06-0,17 USD contra 1,5-16 USD hoy.**
Todo eso es predicción hasta la Fase 0, que cuesta menos de 8 USD.

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
| **D-2** | ¿Supadata se va? | **No, por ahora.** Se le pregunta a Nick por escrito. | La API no entrega el texto; IG casi no tiene transcript; Supadata cuesta ~0 ([02 §5.1](./02-arquitectura.md)). | Entra como caché si Nick confirma un endpoint con texto y tiempos. |
| **D-3** | ¿Dónde vive la ingesta del carril nuevo? | **(c) En el cockpit**: `/api/virlo/webhook` + ejecución durable. | El carril es empujado por webhook y ya no necesita orquestador; construirlo en n8n para después sacarlo es trabajo doble; el motor de Apify queda intacto como sombra ([02 §5.2](./02-arquitectura.md)). | (a) rama en el motor · (b) workflow chico de n8n. |
| **D-4** | ¿El gate de Haiku sigue? | **Se mide, no se decide.** Corren los dos en la sombra. | `intent_match` juzga con una frase; el gate con los criterios completos ([02 §6](./02-arquitectura.md)). | |
| **D-5** | ¿En qué idiomas busca cada voz? | `english_only: false` y **ninguna keyword en español**; lo que se cuele se descarta gratis con `language_detected = es` antes de transcribir. Probar en la Fase 0 **un agente con keywords mezcladas (EN + PT + FR)** contra agentes de un solo idioma. | Hay dos cosas separadas: el filtro (`english_only: true` deja solo inglés; `false` deja **todo**, no existe "todo menos español") y la búsqueda (Virlo busca **en el idioma en que están escritas las keywords**). La doc no dice si se pueden mezclar idiomas en un agente. Si se puede, es 1 corrida por voz en vez de 1 por idioma. | Un agente por idioma (multiplica el costo). Qué idiomas, lo decide el equipo de media. |
| **D-6** | ¿Cómo es la sombra? | **Visible**: los candidatos de Virlo entran al Feed real marcados con su origen, en **1 o 2 voces piloto**. | La métrica (ADR-089) necesita que el equipo apruebe. Una sombra invisible mide volumen, no calidad. | Sombra invisible (solo registro). |
| **D-7** | ¿Data Intelligence? | **Sí**, y probablemente para quedarse. | Sin ella no hay filtros antes de pagar Supadata, ni encaje con la voz, ni aprendizaje por característica ([05 §2](./05-payloads-y-decisiones.md)). Se mide que llegue a tiempo y en ~94 % de los videos. | Estándar (un tercio del costo). |

---

## 4. Fases

Cada fase tiene su **verificación**: sin ella la fase no está cerrada.

### Fase 0 · Preguntar y sondear (sin tocar el sistema) · ~8 USD

1. ✅ **Correo a Virlo enviado por Mani (28/09)**: transcript, duración, Instagram, ventana de
   búsqueda y precio. Las preguntas y su fuente en la doc: [01 §1.3](./01-reunion-y-api.md). **Falta la
   respuesta.**
2. **API key** del pipeline, al `.env` y al gestor.
3. **Sonda de agentes** con `sonda-virlo.mjs agent` (extendido): **4 agentes de una corrida con Data
   Intelligence** (~6 USD), **uno por voz**, con keywords que salen de sus proyectos:
   - 2 voces en inglés: una de psicología (María José Sánchez) y una de trading (Juan Pablo Vieira).
   - La misma voz de psicología con **keywords mezcladas EN + PT + FR** (D-5).
   - La misma voz de psicología **solo en portugués**, para comparar contra la mezclada.
   La intención se escribe **en el formato que recomienda Virlo** (*[Goal] [content type] about
   [niche], not [exclusion]*), con variaciones para elegir (decisión de Mani, 28/09), y las keywords
   se pasan por `suggest-keywords` (gratis).
4. De cada corrida se toman los videos con `min_views=500000` e `intent_match=true`, se transcriben
   con Supadata, se pasan por el gate actual (fuera de n8n, con el arnés de `test-nodos.mjs`) y **se
   le dan al equipo para calificar**, sin decirle de dónde vienen.

**Predicciones (escritas antes de medir):**

| Pregunta | Predicción | Si sale distinto |
|---|---|---|
| Videos por corrida | 200-360 | Menos de 100: el nicho está mal escrito o es chico |
| Con 500k+ vistas | ~15 % (≥ 30 videos) | < 10 videos: el Carril A no llena N con una corrida semanal |
| `intent_match` true entre esos | ~70 % | < 40 %: la intención está mal o Virlo no entiende el nicho |
| Coincidencia `intent_match` vs nuestro gate | ≥ 75 % | Baja: el gate se queda (D-4) |
| **Aprobación del equipo** | **≥ 25 %** (hoy 39 % sobre el roster) | **< 10 %: es ADR-019 otra vez y el Carril A se descarta** |
| Portugués vs inglés | PT trae menos volumen, aprobación igual o mejor | |
| Agente con keywords mezcladas (EN+PT+FR) | Trae los tres idiomas, aunque con menos PT/FR que el agente solo-PT | Si trae casi solo inglés: un agente por idioma |
| Aprobados por corrida por voz | ~9-11 | Si da ≥ 40: una corrida semanal por voz alcanza |
| Transcript en la respuesta | No hay texto | Si hay texto: se habilita D-2 alternativa |
| Instagram en el total | < 30 % de los videos (los ejemplos de la doc dan 3 % y 11 %) | Si es < 10 %: probar `platforms: ["instagram"]` y preguntarle a Nick |
| Re-medidos por corrida (`total_videos_updated`) | > 30 % en la segunda corrida de un recurrente | Si es ~0: la re-medición implícita no existe |
| Videos con `intelligence_status: ready` al llegar el webhook | ≥ 70 % | Si es bajo: la ingesta tiene que releer más tarde antes de filtrar |

**Verificación:** una tabla en [04 §3](./04-operacion-y-costos.md) con los números medidos en vez de
los supuestos, y un veredicto de **sigue / no sigue** contra la fila en negrita.

### Fase 1 · Decisiones escritas

1. Cerrar D-1 a D-7 con los números de la Fase 0.
2. Reescribir **ADR-101**: *el eje vuelve a ser el tema, con intención*. Enmienda
   [ADR-019](../adr/ADR-019-remocion-total-eje-keyword.md) y [ADR-098](../adr/ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md).
3. Reescribir la **`046`** para lo que se decidió: `app.agentes_virlo` (voz, `agent_id`,
   idioma, intención, keywords, excluidas, cadencia, Data Intelligence, activo),
   `candidatos.origen` (`apify` | `virlo`), tarifas de Virlo. Lo de `pool_crudo.proveedor` y las
   vistas filtradas solo si el Carril B entra en sombra.
4. Revertir en el repo la línea de `AJUSTE_MAP` que lee `proveedor_scraping` si el interruptor global
   se descarta ([03 §4](./03-revision-plan-alejo.md)).

**Verificación:** ADR aceptada, migración aplicada y medida por su efecto (PostgREST + catálogo),
`npm run validate` en verde.

### Fase 2 · El carril Virlo, en piloto

1. **Ingesta** donde diga D-3: recibir el webhook (header secreto + idempotencia por corrida), leer
   videos con `min_views`, normalizar con `external_id` desde la URL, deduplicar contra
   `processed_items` y el Feed, transcribir (Supadata + caché), traducir, gate (si D-4 lo deja),
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
| ¿Se transcribe **antes** de que el equipo apruebe (como hoy) o **después** (como PreWave)? Después ahorra Supadata y Haiku, pero el equipo califica sin guion. | Equipo de media + Mani |
| ¿500k absolutas o Virality Score? Virlo muestra que 500k es el top 3 % en IG y el top 15 % en TikTok. Es la conversación abierta de [plan-refactor-motor §0](../agents/plan-refactor-motor.md), ahora con datos. | El jefe (no un dev) |
| Transcript en texto, dos saldos, precio de agencia | Nick (Fase 0) |
| Límite de duración de funciones del plan de Vercel (si D-3 = c) | Dev, con la CLI de Vercel |
| ¿Alejo está de acuerdo con el cambio de encuadre? | Mani con Alejo, antes de la Fase 1 |
