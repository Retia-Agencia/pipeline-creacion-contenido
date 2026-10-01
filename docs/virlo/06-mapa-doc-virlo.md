# Parte 6 · La doc de Virlo, sección por sección

*Escrito el 2026-10-01. Fuente: **https://dev.virlo.ai/docs** (índice en
`https://dev.virlo.ai/llms.txt`, todo junto en `https://dev.virlo.ai/llms-full.txt`, tipos en
`https://api.virlo.ai/openapi.json`). Es el inventario de **qué ofrece Virlo y qué proponemos
integrar**. Lo que ya se decidió vive en [00-plan.md](./00-plan.md); los campos, en
[05-payloads-y-decisiones.md](./05-payloads-y-decisiones.md).*

---

## 0. Por qué existe este doc

El 28/09 leímos `llms-full.txt` entero (12.455 líneas) y concluimos que la API **no entregaba el
texto del transcript ni la duración**. El 01/10 Virlo contestó que sí, y el mismo archivo ya tenía
12.473 líneas con `include_transcript` y `duration` documentados ([01 §1.4](./01-reunion-y-api.md)).
**La doc de Virlo se mueve.** Este mapa guarda cada sección con su fecha de lectura, para que una
conclusión vieja no se cite como si fuera de hoy.

**Cómo se re-mide** (gratis, sin API key):

```bash
curl -s https://dev.virlo.ai/llms-full.txt | wc -l
```

Si el número no es el de la última fila de §3, la doc cambió: se re-leen primero las secciones de
**prioridad 1** y se anota la fecha.

---

## 1. Leyenda

- **Para qué:** `Motor` (el carril que llena el Feed) · `Tracker` (el cockpit como centro de la
  operación de media, el frente de PreWave) · `Operación` (cómo se usa la API sin romper nada) ·
  `—` (no aplica).
- **Propuesta:** `Ya` (Fase 0-2 del plan) · `Piloto` (se prueba en la Fase 3) · `Después` (frente
  tracker/PreWave o Fase 5) · `No` (con su porqué).
- **Prioridad de re-lectura:** **1** = el plan depende de lo que dice; **2** = se lee al construir;
  **3** = se lee si se usa.

## 2. El mapa

### 2.1 Para empezar

| Sección | Qué es | Para qué | Dónde está en el repo | Propuesta | Prio |
|---|---|---|---|---|---|
| [Introduction](https://dev.virlo.ai/docs.md) | Qué es Virlo, las familias de endpoints | — | [01 §2](./01-reunion-y-api.md) | — | 3 |
| [Quickstart](https://dev.virlo.ai/docs/quickstart.md) | API key + primera consulta | Operación | — | **Ya** (Fase 0, paso 2) | 3 |
| [Authentication](https://dev.virlo.ai/docs/authentication.md) | `Bearer virlo_tkn_…` | Operación | [01 §2](./01-reunion-y-api.md), [04 §6](./04-operacion-y-costos.md) | **Ya** | 3 |
| [Billing and pricing](https://dev.virlo.ai/docs/credits.md) | Saldo prepago, `X-Cost`, recarga automática, `GET /account/balance` gratis | Operación | [04](./04-operacion-y-costos.md) | **Ya**: pre-flight de saldo ([04 §4](./04-operacion-y-costos.md)) | **1** |
| [Glossary](https://dev.virlo.ai/docs/glossary.md) | Las tres palabras que cambian de significado (outlier, `weighted_score`, run) | — | [01 §2.6](./01-reunion-y-api.md) | Se cita en [context.md](../agents/context.md) al nombrar | 2 |

### 2.2 Content Research Agents (el núcleo)

| Sección | Qué es | Para qué | Dónde está en el repo | Propuesta | Prio |
|---|---|---|---|---|---|
| [Overview](https://dev.virlo.ai/docs/agents.md) | Crear, correr y leer un agente: videos (con **transcript** desde el 01/10), outliers, tendencias, análisis, corridas | Motor + Tracker | [01 §2.1](./01-reunion-y-api.md), [05 §1, §3, §4](./05-payloads-y-decisiones.md) | **Ya** (D-1, D-2). *Re-leída entera el 01/10 (diff contra la del 28/09).* | **1** |
| [Autopilot](https://dev.virlo.ai/docs/agents/autopilot.md) | El recurrente ajusta sus keywords solo después de cada corrida | Motor | [01 §2.1](./01-reunion-y-api.md), [05 §4](./05-payloads-y-decisiones.md) | **Piloto**, con sus cambios visibles en el cockpit (`activity`). ✅ *Leído el 01/10:* **aplica solo, no propone** (`proposals` está deprecado). Viene prendido en todo agente recurrente, reescribe búsquedas, agrega keywords hasta 15 y "colecta más amplio" si una corrida vuelve flaca; nunca borra las keywords que mandamos (`pinned_keywords`) ni cobra más. Se apaga con `autopilot: false`. Como cambia keywords en medio de una medición, va como **D-9** en [00 §3](./00-plan.md). | **1** |
| [Intent cookbook](https://dev.virlo.ai/docs/intent-cookbook.md) | Cómo escribir la intención de una frase | Motor | [context.md](../agents/context.md) (formato), [00 §4](./00-plan.md) | **Ya**: la Fase 0 escribe las intenciones con esto | **1** |
| [Data Intelligence](https://dev.virlo.ai/docs/intelligence.md) | 79 campos por video (+1 USD/corrida) | Motor + Feed + aprendizaje | [05 §2, §7](./05-payloads-y-decisiones.md) | **Ya, obligatoria** (D-7): sin ella no hay transcript de Instagram | **1** |

### 2.3 Lookups ("satellite")

| Sección | Qué es | Para qué | Dónde está en el repo | Propuesta | Prio |
|---|---|---|---|---|---|
| [Creator lookup](https://dev.virlo.ai/docs/satellite.md) | Perfil + hasta 100 videos de una cuenta, 0,50 USD | Carril B | [01 §2.3](./01-reunion-y-api.md), [03 §4](./03-revision-plan-alejo.md) | **No** como reemplazo del roster (~41 USD por corrida). Solo para evaluar una cuenta suelta. | 3 |
| [Creator lookup add-ons](https://dev.virlo.ai/docs/satellite/creators.md) | Patrones de un creador, Data Intelligence de sus videos | Tracker | — | **Después**: "¿por qué le funciona a esta cuenta?" | 3 |
| [Video outlier check](https://dev.virlo.ai/docs/satellite/video-outlier.md) | ¿Este video le ganó a su creador? Por URL suelta, 0,50 USD | — | [02 §4](./02-arquitectura.md) | **No** para Colecciones (200× Apify) | 3 |
| [Sound lookup](https://dev.virlo.ai/docs/satellite/sounds.md) | Videos que usan un sonido | Tracker | — | **No por ahora**: las voces graban hablando, el sonido pesa poco | 3 |
| [Hashtag lookup](https://dev.virlo.ai/docs/satellite/hashtags.md) | Muestra de videos de un hashtag | — | — | **No**: es el eje que mató [ADR-019](../adr/ADR-019-remocion-total-eje-keyword.md), sin filtro de intención | 3 |

### 2.4 Tracking

| Sección | Qué es | Para qué | Dónde está en el repo | Propuesta | Prio |
|---|---|---|---|---|---|
| [Track creators and videos](https://dev.virlo.ai/docs/tracking.md) | Re-chequear una cuenta o un video con cadencia, 0,25 USD por chequeo, con snapshots y reporte | Carril B + re-medición garantizada | [01 §2.2](./01-reunion-y-api.md), [05 §5](./05-payloads-y-decisiones.md) | **Después**, para 10-20 referentes estrella (D-1). Andrés lo nombró como la forma de seguir un video "sí o sí" (01/10) | 2 |

### 2.5 Datos globales (explorar)

Todo esto es material del **frente tracker / PreWave** ([02 §7](./02-arquitectura.md)), no del motor.

| Sección | Qué es | Para qué | Propuesta | Prio |
|---|---|---|---|---|
| [Trends](https://dev.virlo.ai/docs/trends.md) | Temas en tendencia, global o por país, con momentum | Tracker | **Después**: "graba esto ya". Por voz, las `trends` **del agente** ya vienen gratis | 2 |
| [Hooks](https://dev.virlo.ai/docs/hooks.md) | ~1,4 M hooks reales con vistas + 4.100 plantillas | Tracker + guion | **Después, alta**: banco de ganchos para el guion. Los `hooks` del agente vienen gratis con Data Intelligence | 2 |
| [Videos](https://dev.virlo.ai/docs/videos.md) | Lo más visto de las últimas 48 h | Tracker | **Después**: "lo que explota hoy" | 3 |
| [Sounds](https://dev.virlo.ai/docs/sounds.md) | Sonidos en tendencia | — | **No por ahora** (mismo porqué que Sound lookup) | 3 |
| [Hashtags](https://dev.virlo.ai/docs/hashtags.md) | Hashtags top hasta 90 días | — | **No por ahora** | 3 |
| Por plataforma ([YT hashtags](https://dev.virlo.ai/docs/youtube-hashtags.md), [YT videos](https://dev.virlo.ai/docs/youtube-videos.md), [TT hashtags](https://dev.virlo.ai/docs/tiktok-hashtags.md), [TT videos](https://dev.virlo.ai/docs/tiktok-videos.md), [IG hashtags](https://dev.virlo.ai/docs/instagram-hashtags.md), [IG videos](https://dev.virlo.ai/docs/instagram-videos.md)) | Las mismas listas, una plataforma | Tracker | Cubiertas por las de arriba | 3 |

### 2.6 Cómo funciona la API

| Sección | Qué es | Para qué | Dónde está en el repo | Propuesta | Prio |
|---|---|---|---|---|---|
| [How results load](https://dev.virlo.ai/docs/async-data.md) | `finalized` vs `status`; Data Intelligence que llega después | Operación | [01 §2.5](./01-reunion-y-api.md), [04 §4](./04-operacion-y-costos.md) | **Ya**: la ingesta relee a las ~6 h lo `pending` (también el transcript, que puede venir en camino) | **1** |
| [Pagination](https://dev.virlo.ai/docs/pagination.md) | Hasta 100 por página; paginar hasta vacía y dedupear por `id` | Operación | [01 §2.5](./01-reunion-y-api.md) | **Ya**. Con transcript, páginas de 10-20 | 2 |
| [Rate limits](https://dev.virlo.ai/docs/rate-limits.md) | 10.000/día por endpoint; lookups 5/min | Operación | [01 §2.5](./01-reunion-y-api.md) | **Ya** | 2 |
| [Webhooks](https://dev.virlo.ai/docs/webhooks.md) | Aviso al terminar una corrida; sin firma; reintentos y log | Motor | [01 §2.5](./01-reunion-y-api.md), [04 §4](./04-operacion-y-costos.md), [05 §3](./05-payloads-y-decisiones.md) | **Ya** (D-3): la ingesta arranca acá | **1** |
| [Errors](https://dev.virlo.ai/docs/errors.md) | Códigos; los errores no se cobran | Operación | [01 §2.5](./01-reunion-y-api.md) | **Ya**, al construir | 2 |
| [Workflow recipes](https://dev.virlo.ai/docs/recipes.md) | Recetas con costo y tiempo, incluida *"qué funciona en otro idioma o país"* | Motor | — | **Ya**: leer antes de la Fase 0 (toca D-5) | **1** |
| [API playground](https://dev.virlo.ai/docs/playground.md) | Endpoints con datos de muestra, **sin API key y sin cobro** | Operación | — | ✅ *01/10:* fixtures en `Workflows/workflow-short-form-content/fixtures/virlo/playground/` y `test-virlo.mjs` corre contra ellos. La muestra de **Agent videos** trae TikTok + YouTube y **ningún Instagram**; el creador viene en `author` (sin bio), `id` es uuid de Virlo y no trae `external_id`. La de **Instagram videos** (explorar, otra forma) sí trae `external_id` y `transcript_raw`, pero sus shortcodes son inventados y no sirven para probar el id. La muestra no se pide al servidor: la arma la página. | **1** |

### 2.7 Para asistentes de IA

| Sección | Qué es | Para qué | Propuesta | Prio |
|---|---|---|---|---|
| [MCP server](https://dev.virlo.ai/docs/mcp.md) | 55 herramientas, mismo saldo | Tracker | **Después**: que el equipo de media le pregunte a Claude. ⚠️ Gasta del mismo saldo que el pipeline (el 09/09 pasó con Apify) | 3 |
| [Connect an AI assistant](https://dev.virlo.ai/docs/ai-agents.md) | Cómo conectar Claude, Cursor, etc. | — | — | 3 |
| [Research playbook](https://dev.virlo.ai/docs/agent-playbook.md) | Cómo leer resultados: Virality Score, benchmarks por plataforma, campos de IA | Motor + Tracker | **Ya**: leer antes de la Fase 0. De acá salen la vara relativa y la tabla de [01 §2.7](./01-reunion-y-api.md) | **1** |

### 2.8 Obsoleto

| Sección | Nota |
|---|---|
| [Orbit](https://dev.virlo.ai/docs/orbit.md) / [Comet](https://dev.virlo.ai/docs/comet.md) | Nombres viejos de los agentes únicos y recurrentes. **No se construye contra `/v1/orbit` ni `/v1/comet`.** Ojo: el webhook todavía puede traer la config del agente en `orbit` o `comet` ([05 §3](./05-payloads-y-decisiones.md)). |
| [OpenAPI](https://api.virlo.ai/openapi.json) | La fuente de tipos. `intelligence` y `analysis_data` son `object` sin forma: los tests corren contra fixtures reales ([05 §0](./05-payloads-y-decisiones.md)). |

---

## 3. Lecturas

| Fecha | `llms-full.txt` | Qué se leyó | Qué cambió |
|---|---|---|---|
| 2026-09-28 | 12.455 líneas | Entero, más el OpenAPI (121 rutas, 319 schemas) | — (primera lectura, [01](./01-reunion-y-api.md) y [05](./05-payloads-y-decisiones.md)) |
| 2026-10-01 | 12.473 líneas | §Get videos y §Transcripts de Agents; el índice `llms.txt` | Aparecen `include_transcript` (transcript con `segments` y `source`) y `duration`. **Falta re-leer las demás secciones de prioridad 1.** |
| 2026-10-01 (2ª) | 12.473 líneas | `diff` de la copia del 28/09 contra la de hoy, línea por línea; las 10 secciones de prioridad 1 bajadas por separado; el playground | **El diff son solo las ~25 líneas de transcript y duración** (Agents §Get videos, Data Intelligence §Captions, Research playbook §benchmarks, índice de "qué llamada contesta qué"). Lo leído el 28/09 en las demás secciones de prioridad 1 sigue valiendo. Lo que contestaron para el plan: Autopilot aplica solo (**D-9**); un video con `intent_match: false` casi nunca recibe la revisión completa (y en Instagram, sin revisión no hay transcript: **D-2**). |
