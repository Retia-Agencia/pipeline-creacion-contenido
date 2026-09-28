# Parte 1 · La reunión con Virlo y qué trae la API

*Escrito el 2026-09-28. Fuentes: la grabación de Granola de la llamada del 28/09 (Nick, el CTO de
Virlo, Alejo y Mani) y la documentación completa de la API, leída entera ese mismo día
(`https://dev.virlo.ai/llms-full.txt`, 12.455 líneas, y `https://api.virlo.ai/openapi.json`).
Es la **referencia**: qué es Virlo y qué dijo cada quien. Qué hacemos con eso vive en
[00-plan.md](./00-plan.md).*

---

## 1. La reunión, punto por punto

### 1.1 Lo que les contamos nosotros

| Tema | Lo que se dijo | Nota |
|---|---|---|
| El negocio | Agencia. Unos clientes solo compran redes sociales; otros venden cursos (trading, comunicación) y les manejamos ventas y marca personal. | |
| El volumen | ~7 clientes, ~200 guiones al mes cada uno. | En la base hay **6 voces y 28 proyectos (19 activos)** al 28/09. |
| El modelo | Voces (clientes) → proyectos con criterios en prosa → videos asignados al par voz × proyecto. Referentes = catálogo de cuentas a seguir. Feed para el equipo de media. Botón que dispara un workflow de n8n. | |
| El dolor con Apify | 1) Costo (~50 USD/mes en créditos). 2) **Recencia**: Apify baja desde lo más nuevo hacia atrás, así que para llegar a videos maduros hay que pagar todos los recientes. 3) **El techo del roster**: si hay pocas cuentas o rinden mal, la herramienta no encuentra nada. | El punto 3 es el que mide [costos.md §4.1.1](../costos.md): con 500k de piso, el roster da 0,6 a 2,3 aprobados por semana. |
| El arreglo actual | Pool de videos jóvenes que se re-miden en la corrida siguiente (marca de agua, ADR-100). | |
| El umbral | Mani dijo "alrededor de 400K vistas". | ⚠️ El valor vivo es **500.000** (`Mínimo de vistas`), pedido explícito del jefe. |
| Idiomas | Buscamos en todos los idiomas, con poco español y poco inglés. | |
| El resto del pipeline | Primer filtro por caption, transcripción con Supadata, agente de Claude que compara transcript contra criterios y asigna o descarta. | "Muchos componentes que entran en distintos puntos": lo que queremos reducir. |

### 1.2 Lo que dijo Virlo

| # | Afirmación de Nick / CTO | Qué dice la documentación | Estado |
|---|---|---|---|
| 1 | No son un scraper crudo: son **Content Research Agents**. Les das una intención ("videos de apps móviles para EE. UU., creador de 20 a 30 años") y buscan en TikTok, Instagram y YouTube. | Correcto. `POST /v1/agents` con `intent` (1 frase) + `keywords` (7 a 12). | ✅ |
| 2 | Cobran **por corrida, no por video**. Nicho grande: hasta 1.000 videos por el mismo precio. | Por corrida sí (0,50 / 1,50 USD). El volumen documentado es menor: **~360 videos en la primera corrida y ~200 en las siguientes** (recurrentes). | 🟡 exagerado |
| 3 | Filtran por intención: descartan lo que no calza con lo pedido. | Correcto. Cada corrida una IA lee caption, hashtags y transcript y descarta (`intent_filtered`). Con Data Intelligence, cada video trae `intent_match` (sí/no + razón). | ✅ |
| 4 | Análisis profundo: bajan audio, Whisper, frames, OCR, hooks en pantalla, edad del presentador, marcas mencionadas, "unos 70 campos". | **79 campos** en 14 grupos (Data Intelligence, +1 USD por corrida). | ✅ |
| 5 | Virality score por video, fórmula con seguidores y vistas. | `weighted_score = ln(vistas ÷ seguidores) × ln(seguidores)`. 18+ fuerte, 35+ excepcional. Ojo: en lookups y tracking el mismo nombre es **otra** fórmula. | ✅ |
| 6 | Se filtra por vistas, viralidad, recencia, likes. | `GET /agents/:id/videos` filtra por `min_views`, fechas, plataforma, región, `intent_match`. **Gratis y cuantas veces se quiera.** Ordena por fecha, vistas o `created_at`, **no** por virality score (hay que calcularlo). | ✅ |
| 7 | Cadencia diaria, semanal o mensual; el agente sigue buscando y si vuelve a encontrar un video **le actualiza las métricas**. | Cadencia `daily`, `weekly`, `monthly` o cron (máx. 1 por día). Las corridas reportan `total_videos_updated`. **No está garantizado** que un video vuelva a aparecer. | 🟡 a medir |
| 8 | Idioma: se puede pedir solo inglés o todos; detectan el idioma de cada video. | `english_only` (**default `true`**). Para otro idioma: `false` y escribir intent y keywords **en ese idioma**. `language_detected` viene con Data Intelligence. | ✅ con trampa |
| 9 | El transcript "es tuyo", lo pueden bajar; con Data Intelligence obtienes cada transcript. | ❌ **No en la API de agentes.** Ni la doc ni el OpenAPI exponen el texto: solo `transcript_word_count`, `transcript_character_count` y `transcript_quality`. El texto aparece solo en dos lados: los *digests* de 48 h (`transcript_raw`, y **nunca en Instagram**) y un video trackeado (`latest_transcript`, 0,25 USD por chequeo). Y la tabla de benchmarks de Virlo dice: videos de Instagram con transcript: **"almost none"**. | ❌ contradicción |
| 10 | Pueden reemplazar nuestro agente de Claude que decide si un video va o no. | Parcial. `intent_match` juzga contra **una frase de 500 caracteres máx.**; nuestros criterios son prosa larga por proyecto + voz + aprendidos. | 🟡 a medir |
| 11 | Dos productos: app web (desde 49 USD/mes) y API (prepago). La app es una capa sobre la API. La API sale 20-30 % más barata para quien solo quiere datos. | Correcto: saldo prepago, sin suscripción, 1 crédito = 0,01 USD. | ✅ |
| 12 | Descuentos por volumen de hasta **50 %**. Canal directo por email (no usamos Slack); se puede escribir en español (Andrés). | Comercial, no está en la doc. | 📌 compromiso |

### 1.3 Lo que quedó pendiente de la llamada

1. ✅ **La consulta por escrito a Virlo: ENVIADA por Mani el 28/09** (con copia a su correo personal;
   al cierre de la sesión la copia todavía no había llegado, así que el texto exacto enviado no se
   verificó). Destinatarios de la llamada: Nick (`nic@virlo.ai`) y Andrés, CTO (`andres@virlo.ai`).
   **Falta la respuesta.** La versión final que se le pasó a Mani, en inglés, tenía estas preguntas
   (ordenadas por lo que más cambia el plan):
   1. Texto del transcript de los videos de un agente: ¿endpoint o campo? ¿con tiempos? ¿en
      Instagram? (§1.2 #9). Decide si Supadata se va.
   2. Cobertura de Instagram: los ejemplos de la doc dan 3-11 % de IG por corrida. ¿Cómo se busca en
      IG y cómo subir esa proporción?
   3. Duración del video: no está en el video del agente (solo en hooks y tracking).
   4. Ventana y re-medición: ¿hasta qué fecha hacia atrás busca un agente? ¿`GET videos` acumula
      todas las corridas? ¿un video re-encontrado actualiza sus vistas siempre?
   5. Volumen: "hasta 1.000 por corrida" (llamada) contra ~360/200 (doc). ¿Cuántos pasan 500k en
      nichos como liderazgo, psicología, trading?
   6. Precio por volumen para **~25-100 corridas/mes**, parte con Data Intelligence (el rango se
      corrigió al pasar a un agente por voz; antes decía 80-330, que era por proyecto).
   7. *(Opcional, sugerida después; no se sabe si entró)*: ¿un agente puede buscar en varios idiomas
      a la vez (keywords EN + PT + FR con `english_only: false`) o conviene uno por idioma?

   *Recortada por Mani el 28/09.* **Quedan fuera:** idiomas, porque la doc ya lo responde (*"write
   the intent and keywords in that language"*); dos saldos, porque Mani no los quiere; la API de
   uso, porque el costo por corrida es fijo y se concilia contra `GET /account/balance`; y el
   límite de 500 caracteres del intent. **Decisión de Mani sobre el intent:** se escribe en el
   formato que recomienda Virlo, y cada proyecto puede tener variaciones para elegir.
2. **Precio de agencia**: presentarles el volumen real ([04 §2-3](./04-operacion-y-costos.md))
   después de la Fase 0, con números, para negociar el descuento.
3. La API key (la tiene que crear Mani o Alejo en `dev.virlo.ai/dashboard/api-keys`).

---

## 2. La API de Virlo, entera

Base `https://api.virlo.ai/v1` · `Authorization: Bearer virlo_tkn_…` · JSON dentro de `data` ·
saldo prepago en dólares compartido por el equipo · **los errores no se cobran** · `X-Cost` en cada
respuesta exitosa · **`GET /v1/account/balance` es gratis** (el plan de Alejo decía que no existía).

Tiene cinco familias. Las dos primeras son las que nos importan.

### 2.1 Content Research Agents (el producto central)

Un agente = **una búsqueda por nicho**, una vez o recurrente.

**Cómo corre (el flujo completo):**

1. `POST /agents/suggest-keywords` (**gratis**): le das la intención, devuelve 7 a 12 keywords
   calificadas + palabras a excluir + un puntaje de calidad de la lista.
2. `POST /agents` con `intent`, `keywords`, `exclude_keywords`, `is_recurring`, `cadence`,
   `platforms`, `english_only`, `data_intelligence_enabled`, `autopilot`, `meta_ads_enabled`.
   Devuelve el `id` al instante.
3. Esperar: `GET /agents/:id` hasta `finalized: true` (el polling es gratis) **o** recibir el
   webhook `content_research_agent.run.completed`. La mitad de las corridas termina en <8 min, 9 de
   cada 10 en <20.
4. Leer, casi todo gratis: resumen, videos, creadores outlier, tendencias, análisis, sonidos,
   hashtags, hooks.

**Las dos modalidades de corrida** (ortogonales, se combinan):

| Eje | Opción A | Opción B |
|---|---|---|
| **Cuándo corre** | **Única** (`is_recurring: false`): 0,50 USD cobrados al crear, aunque falle. Es la única forma de "correr ahora": **no existe un endpoint de "run now"**. | **Recurrente** (`is_recurring: true` + `cadence`): gratis de crear, 0,50 USD cobrados **al terminar cada corrida**; las fallidas no se cobran, las `partial_failure` sí. Corre en UTC hasta que se pause o borre. **Autopilot** (default on) reescribe y agrega keywords después de cada corrida, sin costo extra. |
| **Qué tan profundo** | **Estándar**: 0,50 USD. Videos con métricas, autor, hashtags, sonido, región. El filtro de intención igual corre. | **Data Intelligence**: 1,50 USD. + 79 campos por video (tema, hook exacto, formato, tono, idioma, quién aparece, marcas, uso de IA, resumen...) + `intent_match` por video. Llega **después** de `finalized`; un tercio o más puede quedar `pending` para siempre. |

**Qué trae cada video** (`AgentVideoItemDto`): `id` (uuid de Virlo), `url`, `description`,
`platform`, `views`, `likes`, `shares`, `comments`, `bookmarks`, `publish_date`, `author`
(`username`, `followers`, `verified`, `country`), `hashtags`, `thumbnail_url`, `keyword_found_by`,
`is_duet`, `is_stitch`, `upload_region`, `sound` (con `duration`), `intelligence`,
`intelligence_status`, `intent_match`.
**No trae:** duración del video (solo la del sonido; sí aparece en `GET /agents/:id/hooks`),
texto del transcript, ni el media id de la plataforma (se deriva de la `url`). Campo por campo, y
para qué sirve cada uno: [05-payloads-y-decisiones.md](./05-payloads-y-decisiones.md).

**Qué más da el agente, gratis:** `summary` · `creators/outliers` (cuentas chicas con videos
enormes, filtrables por tamaño `nano/micro/mid/macro`) · `creators/:id/similar` · `trends/latest`
(con estado `new/rising/steady/fading` entre corridas) · `analysis/latest` (reporte: temas, tácticas,
horarios, top 10) · `sounds` · `hashtags` · `benchmarks` · `runs` (el reporte de cada corrida: cuánto
entró, cuánto se descartó y por qué, por keyword). `hooks` cuesta 0,25 USD salvo con Data
Intelligence.

**Señales de salud de una corrida** (doc de Virlo): `videos_linked` de unos cientos (≤20 es malo);
descartados por intención ~30 % (0 % = intención vaga, >70 % = demasiado estrecha o keywords malas).

### 2.2 Tracking (seguir cuentas o videos en el tiempo)

- `POST /tracking/creators` (0,25 USD, cubre el primer chequeo) → luego **0,25 USD por chequeo**, con
  `scrape_cadence` de `six_hours` a `monthly`. Cada chequeo guarda un *snapshot* y escribe un reporte
  de IA.
- Cada chequeo guarda **hasta los 90 reels más nuevos de Instagram** (TikTok: ~10 nuevos + 10 más
  populares). Historia más vieja: `collection_depth` una vez (50 / 200 / 500 videos por 0,50 / 1 /
  2 USD).
- Lectura gratis: posts con métricas (`duration_seconds` viene en IG, no en TikTok), snapshots,
  señales (video breakout >3× la mediana), reporte, audiencia.
- `POST /tracking/videos` (0,25 USD por chequeo): un video solo, con `latest_transcript`.
- ⚠️ Los chequeos siguientes **no salen en `X-Cost`**. Sin saldo, el tracking **se pausa y no vuelve
  solo** al recargar: hay que reactivarlo.

### 2.3 Lookups ("satellite": consultas sueltas)

| Lookup | Precio | Para qué |
|---|---|---|
| Creador (`/satellite/creator/:plat/:user`, lote de 25 en `/satellite/creators/batch`) | 0,50 USD (hasta 1,75 con extras). Gratis si se repite en <6 h. | Perfil, stats y hasta 100 videos recientes de una cuenta. **5/min, 100/h, 1.000/día** (el lote usa el límite de 10.000/día). |
| Video outlier (`/satellite/video-outlier`) | 0,50 USD | ¿Este video le ganó a la mediana de su creador? Único camino por URL suelta. |
| Sonido / hashtag | 0,50 USD (hasta 1 / 2,50) | Muestra de videos que usan un sonido o hashtag. |

### 2.4 Datos globales (explorar)

Tendencias del día (global o por país), sonidos en tendencia, **hooks** (~1,4 M hooks reales con
vistas + 4.100 plantillas), hashtags top, y los videos más vistos de las últimas 48 h. De 0,05 a
0,25 USD por consulta.

### 2.5 Cómo funciona la API por dentro

| Tema | Regla |
|---|---|
| Trabajos lentos | Devuelven un id; se consulta cada 15 s (o lo que diga `retry_after_seconds`) hasta `finalized: true`. `status: completed` **no** alcanza. |
| Webhooks | `POST /v1/webhooks` con URL HTTPS y eventos. Eventos útiles: `content_research_agent.run.completed`, `tracking.cycle.completed`, `tracking.outlier_video.detected`, `tracking.paused`. **No vienen firmados**: se les pone un header secreto propio (`X-Webhook-Secret`) y se rechaza lo que no lo traiga. Responder 2xx en <30 s; los fallos se reintentan y hay log de entregas. |
| Paginación | Hasta 100 por página. Una página puede venir corta y `total` moverse: paginar hasta página vacía y deduplicar por `id`. |
| Límites | 10.000 requests/día por endpoint, salvo creator lookup y video outlier (5/min · 100/h · 1.000/día). |
| Saldo | `GET /account/balance` gratis. `402` sin saldo (sin cobro). Recarga automática opcional. |
| Errores | Gratis. `400 validation_error` antes de cobrar. Cualquier parámetro desconocido da `400`. |
| MCP | Servidor MCP con 55 herramientas (`https://dev.virlo.ai/api/mcp/mcp`), mismo saldo. Sirve para que el equipo le pregunte a Claude directamente. |

### 2.6 Tres trampas de vocabulario (de su propio glosario)

- **Outlier** significa cosas distintas: en agentes es vistas ÷ seguidores; en lookups, más de 2× la
  mediana del creador; en tracking, más de 3×.
- **`weighted_score`**: en agentes y hooks es el Virality Score; en lookups y tracking es otro
  ranking. No se comparan.
- **Run**: en agentes es una ronda de búsqueda; en lookups es un resultado guardado.

### 2.7 Benchmarks por plataforma (de Virlo) y por qué importan para el piso de 500k

| Plataforma | Mediana | Top 10 % desde | Top 1 % desde | Con transcript |
|---|---|---|---|---|
| TikTok | ~39K | ~1M | ~6,6M | ~63 % |
| Instagram Reels | ~3,8K | ~175K | ~3M | **casi ninguno** |
| YouTube Shorts | ~1K | ~32K | ~2,5M | ~38 % |

Un piso único de 500.000 vistas es el **top ~3 % de Instagram** y apenas el **top ~15 % de TikTok**.
Virlo lo dice explícito: *"never compare raw views across platforms"*. Es la misma discusión abierta
de [plan-refactor-motor §0](../agents/plan-refactor-motor.md) (vara absoluta contra vara relativa), y
Virlo trae la vara relativa ya calculada.
