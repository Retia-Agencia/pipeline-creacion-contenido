# Parte 5 · Los payloads de Virlo y qué decisiones habilitan

*Escrito el 2026-09-28. Mapeado desde el OpenAPI (`api.virlo.ai/openapi.json`: 121 rutas, 319
schemas, resueltos campo por campo) y, para lo que el OpenAPI deja como `object` opaco, desde la
referencia en prosa (`llms-full.txt`). Complementa [01 §2](./01-reunion-y-api.md), que describe los
endpoints; acá está **qué trae cada respuesta y para qué nos sirve**.*

---

## 0. Qué quedó mapeado y qué no

| Área | Estado | Nota |
|---|---|---|
| Video de un agente (`AgentVideoItemDto`) | ✅ entero | 42 campos |
| Data Intelligence (`intelligence`) | ✅ entero, **desde la prosa** | 79 campos + todos los enums. En el OpenAPI es un `object` sin forma: **su contrato no está tipado** y puede cambiar sin aviso. Los tests tienen que correr contra fixtures reales. |
| Corrida (`AgentRunResponseDto`) + webhook `run.completed` | ✅ | `keyword_breakdown` es `object` opaco en el OpenAPI; su forma sale del ejemplo. |
| Creadores outlier, similares, benchmarks, hooks, hashtags, tendencias, eventos, propuestas del autopilot, actividad | ✅ | |
| Tracking (creador, post, snapshots de creador y video, cadencia) + video outlier | ✅ | |
| `analysis_data` del reporte | 🟡 solo por ejemplos | `object` opaco en el OpenAPI. |
| `affinity` | 🟡 | `object` opaco, marcado "exploratorio" por Virlo. |
| Intelligence de slideshows (70 campos, `narrative_arc`, `panel_texts`) | 🟡 por encima | Los carruseles no son nuestro formato hoy. |
| Lookups de creador/sonido/hashtag (payload completo), audiencia | ⬜ | Solo se necesitan si entra el Carril B. |
| Endpoints globales (tendencias, sonidos, librería de hooks, hashtags, digests) | ⬜ por encima | Material del frente tracker/PreWave, no del motor. |
| Códigos de error, 55 herramientas del MCP | ⬜ | Se leen al construir. |

---

## 1. Qué trae un video del agente (sin Data Intelligence)

| Campo | Para qué nos sirve |
|---|---|
| `views`, `likes`, `comments`, **`shares`**, **`bookmarks`** | Hoy solo usamos vistas, likes y engagement. **Guardados y compartidos** son la mejor señal de contenido útil y accionable (lo que pide PreWave). |
| `publish_date` | Edad del video ⇒ **velocidad**: vistas o likes por día. La regla de PreWave (≥1.000 likes/día las primeras 2 semanas) se puede calcular directo. |
| `author.followers`, `author.verified`, `author.country` | **Virality Score** = ln(vistas ÷ seguidores) × ln(seguidores), comparable entre plataformas. Y detectar "autoridades" (cuenta mediana, video enorme). |
| `upload_region` + `upload_region_source` | Filtrar o priorizar por país. ~30 % no tiene región; en Instagram casi nunca. |
| `hashtags`, `description` | Lo que hoy usa el pre-trim. |
| `keyword_found_by` | Qué keyword trajo cada video ⇒ **qué keywords rinden aprobados** (aprendizaje). |
| `is_duet`, `is_stitch` | Descartar lo que no es original (TikTok). |
| `sound` (`duration`, `is_original`, ...) | `sound.duration` con `is_original: true` en TikTok ≈ duración del video. |
| `intent_match` (`matches`, `reasoning`) | Solo con Data Intelligence. Candidato a reemplazar el gate (D-4). |
| `id` | uuid de Virlo. **No** es el id de la plataforma: el nuestro se deriva de la `url`. |

**Desde el 01/10 también viene** ([01 §1.4](./01-reunion-y-api.md)):

| Campo | Para qué nos sirve |
|---|---|
| `duration` (segundos, `null` si la plataforma no la da) | `duracion_seg` de ADR-095, que hoy tiene 1 de 150 filas de `videos_meta`. |
| `transcript` (con `include_transcript=true`): `text`, `segments[{start,end,text}]`, `source` (`platform` \| `transcribed`) | El guion, sin pagar Supadata (D-2). `segments` da la cobertura en segundos. `null` = sin voz o todavía no procesado (se distingue con `intelligence_status` y `is_silent`). Con transcript, pedir páginas de 10-20. |

*Hasta el 01/10 este párrafo decía que no venían ni la duración ni el texto.*

## 2. Qué suma Data Intelligence (79 campos), agrupado por uso

### 2.1 Filtros **antes de pagar** Supadata y Haiku

Hoy pagamos transcripción y juicio de videos que después mueren. Con estos campos se cortan antes:

| Filtro | Campo | Por qué |
|---|---|---|
| **Sin nada que transcribir** | `is_silent`, `transcript_word_count = 0` | Hoy esos videos se transcriben, vuelven vacíos y el gate los tira como `sin_guion` (ADR-030). Se descartan gratis. |
| **Transcript roto** | `transcript_quality = garbled` | Directo a `generate` o descarte, sin probar `auto` primero. |
| **Idioma** | `language_detected`, `is_multilingual` | Política de idiomas (poco español) sin esperar a Supadata. |
| **No original** | `is_repost`, `is_compilation`, `has_platform_watermark` + `watermark_source` (un reel con marca de TikTok es un repost) | El guion tiene que ser de un creador, no de un recopilador. |
| **Publicidad** | `is_sponsored`, `content_format = ad_creative`, `cta_usages` de tipo `buy`/`use_code` | No sirve como referencia orgánica. |
| **Hecho con IA** | `ai_provenance` (`fully_ai`, `ai_presenter`) | Un avatar no se puede "grabar igual". |
| **Riesgo** | `brand_safety_tier`, `sensitive_topics` (`medical_claims`, `financial_advice`, `mental_health`) | Relevante para psicología y trading: marcar, no necesariamente excluir. |

### 2.2 Encajar el video con **cómo graba la voz**

Nuestros clientes graban hablando a cámara. Un video viral que es un montaje de b-roll o un texto
en pantalla no se puede replicar igual.

| Campo | Uso |
|---|---|
| `presence_style` (`on_camera_presenter`, `faceless_voiceover`, ...) + `visual_format` (`talking_head`, `interview`, `podcast_clip`, ...) | Preferir lo que la voz puede grabar. Podría ser un ajuste por voz. |
| `speaking_style`, `emotional_tone` | Afinidad con el tono de la voz. |
| `primary_subject_gender`, `primary_subject_age_bracket` | Referentes parecidos a la persona que va a grabar. |
| `content_format` (`tutorial`, `explainer`, `educational_breakdown` vs `motivational`), `is_educational` | PreWave prioriza **accionable sobre motivacional**. Hoy no hay forma de saberlo sin leer el guion. |

### 2.3 Lo que el equipo ve en el Feed

| Campo | Uso |
|---|---|
| `summary` (2-3 frases) | "Leer 100 resúmenes es ver 100 videos" (Virlo). Calificar más rápido. |
| `hook_text` (textual), `hook_type`, `visual_hook_type` | El gancho explícito, listo para el guion. |
| `text_overlay_content` | El texto en pantalla, que hoy se pierde (Supadata solo lee audio). |
| `cta_usages[].text` | Qué llamados a la acción usa el nicho. |
| `primary_topic`, `secondary_topics`, `keywords`, `category` | Etiquetas para buscar y agrupar en el histórico. |

### 2.4 Aprender de lo que el equipo aprueba

Hoy la señal de aprendizaje es **por referente** (`v_senal_seleccion`) y con el Carril A deja de
tener sentido (no hay referentes fijos). Con Data Intelligence la señal pasa a ser **por
característica**: comparar `hook_type`, `content_format`, `visual_format`, `emotional_tone` y
`presence_style` entre lo aprobado y lo descartado **por voz**. Es la receta que Virlo recomienda
(cuartil de arriba contra cuartil de abajo), con la aprobación humana en vez de las vistas. De eso
salen: un ajuste al ranking y propuestas de cambio a la intención y las excluidas del agente.

### 2.5 Detectar un transcript cortado

*Era una hipótesis indirecta (comparar largos de texto) hasta el 01/10.* Ahora es directo: con
`source: transcribed`, cobertura = último `segments.end` y duración = `duration`, que es exactamente
lo que pide ADR-095. Queda indirecto solo para `source: platform` (sin tiempos): ahí sí se compara
`transcript_character_count` contra el largo de Supadata, y la Fase 0 lo mide en ~20 videos.

## 3. La corrida y el webhook: la salud del carril

| Campo | Uso |
|---|---|
| `videos_linked`, `total_videos_inserted`, **`total_videos_updated`** | Nuevos contra **re-medidos**: el ejemplo de la doc da 122 nuevos y 161 actualizados sobre 283. **La re-medición existe** y se puede contar por corrida. |
| `intent_filtered`, `language_filtered_count`, `exclude_keywords_filtered` | Por qué se perdió lo que se perdió: se muestra en la pantalla de Corridas como `razon_faltante`. |
| `youtube_count`, `tiktok_count`, `instagram_count` | ⚠️ En los dos ejemplos de la doc, Instagram es **11 %** (33 de 308) y **3 %** (5 de 183). Si en nuestros nichos pasa igual, el agente trae poco Instagram. **A medir y a preguntar.** |
| `keyword_breakdown[]` (por keyword: nuevos, actualizados, por plataforma) | Qué keyword rinde. Se cruza con lo aprobado. |
| `status` (`partial_failure` se cobra entero) | Avisos. |
| Webhook: `data.run_id`, `status`, `metrics`, `analysis` | La ingesta arranca con esto. La config del agente viene en `orbit`, `comet` o `content_research_agent` según cómo terminó; **puede llegar dos veces y en cualquier orden**. |

## 4. Lo demás que da el agente, gratis

| Endpoint | Campos clave | Uso para nosotros |
|---|---|---|
| `creators/outliers` | `follower_count`, `median_views`, `top_video_views`, **`breakout_video_count` / `videos_analyzed`** (consistencia), `posts_per_week`, `avg_engagement_rate`, `content_angle`, `weighted_score`; `order_by=rising` da crecimiento entre corridas | Proponer referentes: reemplaza el workflow de descubrimiento. Filtrar `follower_tier=micro` = las autoridades de PreWave. |
| `creators/:id/similar` | `similarity_score` (hashtags + 2× sonidos compartidos) | Ampliar desde un referente que funciona. |
| `benchmarks` | Medianas por tamaño de cuenta: engagement, seguidores, frecuencia | La vara relativa por nicho, para la conversación del umbral de 500k. |
| `hooks` | `hook_text`, `hook_type`, `weighted_score`, `usage_count`, `video.duration` | Banco de ganchos por proyecto. Gratis con Data Intelligence. |
| `hashtags` | `lifecycle` `new/rising/steady/fading` | Tracker. |
| `trends/latest` y `trends` | `why_it_works`, `tactics`, `confidence`, `status`, `stable_key`, `peak_hour_utc` | "Graba esto ya" cuando una tendencia pasa de `new` a `rising`. |
| `events` | Noticias o picos del nicho, con `salience` 0-10 | Contenido oportuno. |
| `proposals`, `activity` | Qué cambió el autopilot y por qué; se puede aplicar, descartar o revertir | Si se deja el autopilot prendido, esto va al cockpit para que el equipo lo apruebe. |

## 5. Tracking (solo si entra el Carril B)

`CreatorPostResponseDto` trae `duration_seconds` (IG), `is_outlier` y `outlier_ratio` contra la
mediana del creador. `VideoSnapshotsResponseDto` trae la serie de vistas con `delta_views` por
chequeo: **la curva de crecimiento de un video**, que es exactamente lo que `pool_crudo` reconstruye
a mano. `PostingCadenceResponseDto` da el ritmo de publicación, que hoy calcula `v_ritmo_referentes`.

## 6. Qué cambia en el diseño por todo esto

1. **Se guarda todo lo que llega, antes de decidir qué usar** (el mismo criterio que la `036` con la
   duración). Una tabla con las métricas + `intelligence` + `intent_match` crudos por video
   (`jsonb`). Leer es gratis pero `intelligence` no está tipado, y el aprendizaje de §2.4 necesita
   el histórico.
2. **El heat-score se rehace sobre datos mejores**: Virality Score + guardados/compartidos +
   velocidad, en vez de percentiles de vistas y likes. Es un cambio de fórmula y se decide con los
   datos del piloto, no antes.
3. **Los filtros de §2.1 van antes de Supadata.** Bajan costo y bajan ruido en el Feed.
4. **Los filtros de §2.2 son ajustes por voz**, editables en el cockpit.
5. **Data Intelligence (D-7) deja de ser un "tal vez"**: sin ella no hay filtros previos, ni
   encaje con la voz, ni aprendizaje por característica. Lo que queda por medir es si el **~94 %**
   de videos con campos listos se cumple en nuestros nichos, y si llegan a tiempo para la ingesta.

## 7. Precauciones al usar estos campos

- Usar los campos solo con `intelligence_status: ready`. Descontar lo que aparezca en
  `low_confidence_fields`. `tier3_unavailable` = no miró los frames (pasa en más de la mitad de
  YouTube): los campos visuales vienen `null`.
- `false` en los booleanos puede significar "no pudo saber".
- Los enums pueden sumar valores nuevos: el código tiene que aceptar valores desconocidos.
- `intent_match.reasoning` a veces es un string de máquina: no se muestra sin revisarlo.
- Los videos que Virlo marca con menores se quitan de todas las listas sin avisar.

## 8. Lo que entregó la sonda (A2, 01/10) y qué se usa

Las secciones de arriba se escribieron leyendo la doc. Esta sale de **respuestas reales**: seis
agentes con Data Intelligence, 4.029 videos únicos ([04 §3.1](./04-operacion-y-costos.md), y el
informe [Sonda de Virlo](https://claude.ai/artifact/W87qcpyknV8Zdpz1EhiRBx)). Donde lo medido
contradice lo de arriba, gana esto.

| Lo que trae Virlo | Para qué nos sirve | Estado | Ticket |
|---|---|---|---|
| Videos: link, vistas, likes, comentarios, compartidos, fecha | El candidato del Feed y los pisos | **Se usa** | A1, A4 |
| `duration` (vino en 4.029 de 4.029) | Saber si un transcript quedó cortado (ADR-095); hoy solo 1 de 150 filas de `videos_meta` la tiene | **Se usa** | A1, A4 |
| `transcript` | El guion. En TikTok y YouTube es el caption de la plataforma, **idéntico al de Supadata** (20 de 20) | **Se usa** | A4 |
| `intent_match.matches` | Primer filtro, antes del asignador (D-4b) | **Se usa** | A4 |
| `author.username` / `followers` | Virality Score (vistas ÷ seguidores) al lado de las vistas (D-11) | **Se usa** | B4 |
| Reporte de la corrida (`GET /agents/:id/runs`), con `keyword_breakdown` | Corridas en vivo y avisos de corrida pobre | En el plan | B6 |
| `stage`, `progress_pct`, `eta_seconds` (`GET /agents/:id`) | La barra de progreso mientras corre | En el plan | B6 |
| `intelligence.language_detected`, `is_silent`, `transcript_word_count`, `is_repost`, `is_compilation`, `content_format`, `is_educational`, `has_face_visible` | Filtros y avisos gratis antes de pagar Supadata o Claude; `is_repost` tapa parte del hueco del dedup (re-subidas con otro id) | En el plan | A4 |
| `creators/outliers` | Sugerir referentes nuevos: cuentas chicas con videos enormes (en T1, las 5 son de IG con 1.425 a 20.823 seguidores) | Idea | — |
| `analysis/latest`, `trends/latest` | Ideas de temas para media (en T1: "técnicas somáticas y nervio vago", 18 videos) | Idea | — |
| Carruseles (`slideshows`, 139 a 586 por agente) | Nada: el pipeline es de video | No se usa | — |
| Sonidos, hashtags, ganchos, el resto de los 79 campos | Nada por ahora | No se usa | — |

**Lo que la doc no decía y la sonda sí:**

- **`intent_match.reasoning` no es una frase**: son puntajes internos (`subject=0.69 stuffing=0.17`).
  No sirve para mostrarle al equipo por qué se descartó; la razón legible la da el asignador (A3).
- **Los transcripts `platform` casi nunca traen `segments`**; los `transcribed` sí. La cobertura en
  segundos de ADR-095 solo se puede calcular en los segundos.
- **Hay transcripts basura** de 10 a 18 caracteres: el chequeo es por largo, no por presencia.
- **El reporte dice más videos de los que se pueden leer** (T1: 1.477 en `videos_linked`, 794 por
  `GET videos`). Abierto, para preguntarle a Virlo.
- **Data Intelligence se estanca**: entre el 12 y el 33 % de los videos de 500k+ queda `pending` y
  no se movió en la hora siguiente.

