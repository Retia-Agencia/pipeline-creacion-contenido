# Decisiones para el HUB — TikTok · Substack · 8 voces · producción · publicación

*Escrito el 2026-09-22. Es el dueño del contenido del deck "Del cockpit al HUB — decisiones" (Artifact
privado). El deck es la versión presentable y **esto es la fuente**: si cambian, cambia acá primero.*

**Qué es y qué no es.** Es el material para **decidir**, no el plan de implementación. Con la
[hoja de decisiones](#hoja-de-decisiones) llena se escribe el plan final: tablas, pantallas, fechas.

## El pedido

Sumar TikTok y Substack, pasar de las voces de hoy (6 cargadas, 1 activa, todas de una empresa) a **8 activas, repartidas en varias empresas**, gestionar edición y
revisión, y publicar solo a una fecha y hora. El cockpit tiene que ser un **HUB**: el trabajo puede
correr afuera, pero se ve todo desde acá. La duda era si la arquitectura aguanta.

## La respuesta corta

**El stack aguanta (Next.js 16 + Supabase + n8n). Lo que no aguanta es el modelo:** hoy el sistema
llega hasta marcar un video como *grabado* y limpiar su guion, pero no tiene piezas por voz, versiones, revisión ni publicación. Llegaron a
esa conclusión, por separado, un agente de exploración y Codex en solo lectura.

## Lo que medimos

| Hecho | Fuente |
|---|---|
| Las voces son datos, sin número fijo en ningún lado. **Medido en prod el 22/09: 6 voces, 1 activa, 1 con `perfil_limpieza`, todas del mismo `client_id`** | `app.voces`/`app.proyectos` (`009`); PostgREST |
| `grabados` y `guiones_limpios` se identifican por `(instance_id, plataforma, external_id)`, **sin la voz** ⇒ dos voces que toman el mismo video se pisan | `core/schema/029_grabados.sql:106`, `032_guiones_limpios.sql:80` |
| Cada pipeline nuevo duplica tablas y pantallas (la infraestructura sí se comparte): LinkedIn fueron ~2.500 líneas | `docs/runbooks/agregar-workflow.md:22`; `app/api/engine/run-plan/route.ts:70` |
| TikTok ya está en el enum `app.plataforma` y en la rama Apify del motor. **Medido el 22/09: 74 referentes activos, todos Instagram** | `009`; `Workflows/workflow-short-form-content/workflow.json` |
| Substack no tiene API pública de publicación. Hoy hay un bot OpenClaw + Notion, inactivo | `Workflows/workflow-substack/` |
| Los límites: Vercel `maxDuration=60` en las rutas largas, 900 s por Code node en una sola instancia de n8n (hosting administrado, ADR-005), Supabase free 500 MB, PostgREST corta en 1.000 filas | `docs/agents/dev-doc.md`; `lib/supabase/tope.ts` |

## El HUB en una línea

Fuentes → motor (n8n) → curar (Feed) → **producir** (pieza → versiones → revisión) → **calendario** →
**publicar**. El cockpit ve todo lo que corre, lo que falla, lo que me toca y lo que está afuera. Las
tres etapas nuevas forman **un solo núcleo compartido** por todas las redes y voces, y la pieza lleva
la voz en su llave.

## Las diez decisiones

Precios de las webs públicas de septiembre 2026: **hay que verificarlos al contratar**.

### D1 · ¿Migrar o extender?
| Opción | A favor | En contra | Costo |
|---|---|---|---|
| Migrar (reescribir / no-code) | Arranque limpio | Rehacer curación y sus 17 pantallas antes de sumar nada (el motor puede quedarse) | Meses · riesgo alto |
| **Extender con núcleo compartido** | No toca lo que funciona · cada red nueva cuesta menos | Pide ordenar el modelo primero | USD 0 infra extra |
| Híbrido (SaaS para producir y publicar) | Rápido | Herramientas desconectadas, el HUB ciego | Licencias (a cotizar) |

**Recomendado: extender.**

### D2 · ¿Cómo se publica en IG, TikTok y LinkedIn?
| Opción | A favor | En contra | Costo/mes |
|---|---|---|---|
| Zernio (ex Late) | API única, nodo n8n, 2 perfiles gratis | Proveedor joven | Gratis 2 · desde ~USD 13 |
| Upload-Post | Posts ilimitados, procesa video | TikTok solo pago · tope de perfiles sin confirmar | ~USD 16–24 |
| Ayrshare | Maduro, 1 perfil = todas sus redes | Caro | USD 299 (10 perfiles) · 149 (1) |
| APIs nativas | Sin mensualidad | Revisión de Meta, auditoría de TikTok, 3–6 semanas | USD 0 + trabajo |
| Calendario manual | Sale en días | No publica solo | USD 0 |

**Recomendado:** manual mientras se construye → piloto gratis de Zernio (1 voz × 1 red) → pago tras 10
posts sin error. **Substack queda manual siempre.** 8 voces ⇒ ≥8 perfiles: **cotizar el tramo 8–10**.

### D3 · ¿Quién ejecuta lo programado y lo largo?
| Opción | A favor | En contra | Costo/mes |
|---|---|---|---|
| **n8n + cola en Postgres** | Cero herramientas nuevas, mismo patrón que el motor | El candado anti-doble-publicación va a mano; comparte instancia con el motor | USD 0 extra |
| Trigger.dev | Código testeable, reintentos y agenda nativos | Un servicio más | Gratis · 10 · 50 |
| Inngest | Sólido para flujos largos, 50k gratis | Pro caro | Gratis · 75 |
| Supabase pg_cron + Edge | Todo en un lugar | Duración corta, free se pausa | USD 0 · 25 Pro |

**Recomendado: n8n + cola**, que es la solución básica. Si hace falta más, se muda solo el
publicador a Trigger.dev y la cola (`app.publicaciones`) no cambia.

### D4 · ¿Dónde viven los videos de edición? — **tomada: links a Drive** (Mani, 22/09)
Supabase free tiene 500 MB. Las alternativas futuras son R2/S3 (subir al cockpit) o Frame.io
(revisión sobre el segundo exacto).

### D5 · ¿Qué pasos sigue una pieza y quién la aprueba? — **la decide el equipo**
Pasos propuestos: idea → guion → grabación → edición → **revisión** → aprobado → programado → publicado
(o descartado). Para aprobar hay tres opciones: 1 revisor por empresa · 1 por voz · doble (equipo +
cliente). Las tres cuestan USD 0 en herramientas (la doble suma usuarios del cliente). Quedan abiertas tres preguntas: cuántas rondas de cambios, si se puede descartar en
cualquier paso, y quién programa.

### D6 · ¿Cuándo entra TikTok como fuente?
Ya, en todo · **piloto de 1 proyecto y 1 corrida** · después de publicar. **Recomendado: el piloto**,
midiendo el costo de Apify contra [costos.md](../costos.md) antes de abrirlo.

### D7 · ¿Qué muestra el HUB y por dónde avisa?
El HUB muestra qué corre, qué me toca y qué está afuera. Para avisar: solo pantalla (USD 0) · email
(~USD 0) · WhatsApp (Twilio: por mensaje, a cotizar, y pide plantillas aprobadas por Meta). **Recomendado: primero la
pantalla.** Twilio es mensajería: sirve para avisos, no para alojar funciones.

### D8 · ¿Cambiamos Apify (y Supadata) por una herramienta más completa?
⚠️ **[ADR-098](../adr/ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md) (12/09) ya decidió
"Apify se queda" _por precio_**: ningún proveedor ahorra más de ~USD 29/año. El pedido del 22/09
cambia el criterio y pregunta por **cobertura**: una sola herramienta para IG, TikTok, LinkedIn y
YouTube, con transcripts. Si se cambia, ADR-098 necesita una enmienda.
**"Solo la key de Anthropic" no es posible**: Claude no lee redes ni transcribe audio. El mínimo es
Anthropic + 1 proveedor.

| Opción | Qué cubre | En contra | Costo/mes |
|---|---|---|---|
| Quedarse: Apify + Supadata | IG y TikTok integrados, medidos | 2 proveedores; falta LinkedIn/YouTube | ~USD 48–52: Supadata es **plan fijo de USD 47** ([costos.md](../costos.md) §1) + Apify ~1–5 (modelo con marca de agua) |
| **ScrapeCreators** | IG, TikTok, LinkedIn, YouTube, Threads **+ transcripts** en la misma API; los créditos no vencen | Transcript de IG solo < 2 min; remapear 23 campos del motor | USD 47 = 25k créditos · ~USD 5–10 estimado |
| Bright Data | El más completo y confiable, con LinkedIn | No transcribe (otra key); LinkedIn con mínimo de USD 250 | ~USD 1–2,50 / 1k registros |
| EnsembleData | IG, TikTok, YouTube, Threads | Sin LinkedIn; plan fijo | desde USD 100 |
| Meta Graph API | Oficial | Solo parte del roster: 25 % medido, hasta 50 % estimado | USD 0 |

**Transcripción si se va Supadata** (un reel de 60 s): Supadata ~0,0016 · ScrapeCreators en créditos ·
Groq Whisper ~0,0007 (hay que bajar el audio) · AssemblyAI ~0,0025 (recibe URL) · Deepgram/ElevenLabs
~0,004. **Todo reemplazo tiene que devolver la duración cubierta** (ADR-095), o se pierde el control
de transcript cortado.
**Recomendado:** piloto de ScrapeCreators (100 créditos gratis), 1 referente por red, comparando
campo por campo. El scraping solo ahorra poco (ADR-098), **pero el plan fijo de Supadata (USD 47/mes) sí
se va** si ScrapeCreators transcribe bien. Si no, medir el volumen real: con unos cientos de reels
al mes, un STT por uso (AssemblyAI) saldría pocos USD contra los 47 fijos.

### D9 · ¿Con qué editan los editores? (por usuario/mes)
CapCut Pro USD 10–20 (el estándar de reels) · Descript USD 16–50 (edita cortando el texto, encaja con
el guion) · Submagic USD 19–39 (subtítulos animados, se suma) · Opus Clip USD 15–29 (cortar videos
largos) · Vizard USD 20–48 (aprobaciones propias, duplica Producir). **Recomendado: CapCut Pro, y el
cockpit para revisar.** El editor exporta a Drive, así que la elección no toca el modelo.

### D10 · ¿Con qué buscamos referentes?
Para 150 videos por semana hacen falta **301–1.115 referentes** con `min_views` en 100.000
(1.656–6.132 con 500.000; [plan-refactor-motor](plan-refactor-motor.md) #14), y hoy hay 74.
Opciones: descubrimiento propio (ADR-020, a pedido desde Sugeridos; Apify por corrida + USD 0,20 por
lookalike de TikTok) · búsqueda de ScrapeCreators (en créditos) · Modash USD 299/mes (380M perfiles,
filtros por audiencia) · HypeAuditor USD 299–499. **Recomendado:** propio + ScrapeCreators, y Modash
**un solo mes** si hay que llegar rápido a 300.

## Costo mensual por escenario (sin Apify/Supadata/Anthropic)
- **Mínimo, USD 0:** manual + n8n + Drive.
- **Recomendado, a cotizar:** agregador para 8–10 perfiles + n8n. Ni Zernio ni Upload-Post publican ese tramo con claridad (USD 13–24 con pocos perfiles).
- **Premium, ~USD 374:** Ayrshare 299 + Trigger.dev Pro 50 + Supabase Pro 25.
- En mínimo y recomendado, 8 voces probablemente saquen a Supabase del free: **+USD 25** (premium ya lo incluye).
- Según D8–D10: datos hoy ~USD 48–52 (Supadata fijo 47 + Apify), con ScrapeCreators ~5–10 · edición ~USD 10–20 por editor · Modash 299 solo el mes que se use. Anthropic aparte.

## Orden propuesto (sin fechas)
1 voces → 2 producir (D5) → 3 calendario y publicar (D2, D3) → 4 TikTok (D6) → 5 Substack → 6 HUB (D7).
Cada fase se entrega sola, y el motor de reels no se toca.

## Hoja de decisiones

| Decisión | Recomendado | Decidimos | Quién |
|---|---|---|---|
| D1 Migrar o extender | Extender | | |
| D2 Cómo publicamos | Manual → piloto Zernio | | |
| D3 Quién ejecuta | n8n + cola | | |
| D4 Dónde viven los videos | Links a Drive | **Links a Drive** | Mani |
| D5 Pasos y quién aprueba | (equipo) | | |
| D6 Cuándo entra TikTok | Piloto | | |
| D7 HUB y avisos | Pantalla primero | | |
| D8 Apify/Supadata | Piloto ScrapeCreators | | |
| D9 Edición | CapCut Pro | | |
| D10 Búsqueda de referentes | Propio + ScrapeCreators | | |

## Fuentes de precios
[ayrshare.com/pricing](https://www.ayrshare.com/pricing/) ·
[getlate.dev/pricing](https://getlate.dev/pricing) ·
[docs.upload-post.com](https://docs.upload-post.com/landing/) ·
[Inngest vs Trigger.dev](https://comparetiers.com/compare/inngest-vs-trigger-dev) ·
[ScrapeCreators](https://docs.scrapecreators.com/) ·
[Bright Data](https://brightdata.com/products/web-scraper/social-media-scrape)
