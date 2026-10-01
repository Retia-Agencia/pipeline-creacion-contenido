# Plan — migración suave a Virlo (en sombra primero)

> ⚠️ **Revisado el 2026-09-28 en [docs/virlo/03-revision-plan-alejo.md](../virlo/03-revision-plan-alejo.md).**
> **Reemplazado el 2026-10-01** por [docs/virlo/00-plan.md](../virlo/00-plan.md) (decidido),
> [ADR-102](../adr/ADR-102-la-busqueda-pasa-a-virlo-por-tematica.md) y los tickets de
> [docs/virlo/07](../virlo/07-refactor-tickets.md): agentes por temática en vez de replicar el roster.
> Este doc es **antecedente**.

*Escrito el 2026-09-28, después de la llamada con Virlo (Nick) de ese día. Es el dueño de la
migración: si cambia algo, cambia acá primero. La dirección viene de Mani, 25/09 (handoff: el
scraping se terceriza). **Enmienda [ADR-098](../adr/ADR-098-el-proveedor-no-es-el-problema-la-cadencia-si.md)**,
que decidió "Apify se queda", así que el cambio real entra con ADR-101 y con los números de la Fase 0.*

**La regla que no se negocia:** Virlo se monta **al lado**. Apify y Supadata siguen entregando hasta
que Virlo gane con datos, y volver atrás es poner un ajuste en `0`. Nada se borra antes de la Fase 6.

## Qué trae Virlo (revisado en docs + `openapi.json`, 28/09)

| Utilidad | Endpoint | Precio | Para qué nos sirve |
|---|---|---|---|
| **Creator lookup** | `GET /v1/satellite/creator/instagram/{user}?include=videos&max_videos=1..100` · batch `POST /v1/satellite/creators/batch` (≤25) · async, poll `/status/{job_id}` | **0,50 USD por referente** (gratis si se repite <6 h) | Reemplazo de `Apify — IG Reels`/`TikTok Perfil` **con el roster que ya tenemos** |
| **Tracking** | `POST /v1/tracking/creators` · `GET …/posts` · `…/snapshots` · cadencia `daily..monthly` | 0,25 USD/chequeo · 0,50–2 USD la colección inicial (50/200/500 posts) · leer es gratis | Alternativa más barata al lookup, y reemplaza la **re-medición** (`pool_crudo` + `remedir`): Virlo guarda las vistas en el tiempo |
| **Content Research Agents** | `POST /v1/agents` (intent + 7–12 keywords) · `GET /v1/agents/{id}/videos?min_views&intent_match…` | 0,50 USD/corrida · **1,50 con Data Intelligence** | Carril **nuevo** por nicho, sin techo de roster. ⚠️ `english_only` viene en `true` por defecto |
| Data Intelligence | 79 campos (tema, hook, formato, idioma, `transcript_word_count`…) | dentro del 1,50 | Filtros previos al gate |
| Video outlier | `POST /v1/satellite/video-outlier` (una URL) | 0,50 USD/video | Único endpoint por URL suelta, y 200× lo que cuesta en Apify |

Auth `Authorization: Bearer virlo_tkn_…` · `X-Cost` en créditos (1 = 0,01 USD) · errores gratis ·
saldo prepago (`402` si no alcanza, sin endpoint de saldo documentado) · creator lookup **5/min ·
100/h · 1.000/día**.

## Los tres huecos

1. **Transcripts: la llamada y la doc no coinciden.** Nick dijo que con Data Intelligence entregan
   cada transcript (Whisper). La doc y el OpenAPI no muestran el texto en ningún campo: solo
   `transcript_word_count` y `exclude_keywords_strict`. Además es **solo de agents**, no de lookup.
   Y [ADR-095](../adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md) exige **cobertura en segundos** para detectar cortados. **Supadata no se toca
   hasta que la Fase 0 lo pruebe.**
2. **Costo del camino por referentes.** Hoy son ~48–52 USD/mes (Supadata con plan fijo de 47 y Apify
   a 1–5 USD por corrida, [costos.md](../costos.md) §3.3). En Virlo, un lookup de los referentes sale
   0,50 USD por cuenta. `pool_crudo` midió **83 cuentas en los últimos 14 días** (28/09; el "~74" del
   22/09 ya quedó viejo), o sea **~41 USD por corrida** y ~180 USD/mes a una corrida por semana. Con
   tracking semanal serían ~90 USD/mes. Nick ofreció hasta 50 % de descuento por volumen. **Se mide y
   se negocia.**
3. **El cockpit pide por URL suelta.** Son `lib/apify.ts` (metadata y mp4 de colecciones →
   `videos_meta`) y `lib/transcribir.ts` (la pantalla Transcribir). Virlo no tiene un camino barato
   para esto, así que **esas dos llamadas se quedan** aunque el motor pase a Virlo.

## El interruptor

Mismo patrón que `Usar marca de agua` (ADR-100): `Proveedor de scraping` en `app.ajustes`, leído por
la fachada. **0 apify** (default) · **1 sombra** (entrega Apify; Virlo corre y solo se registra en
`pool_crudo`) · **2 virlo** (entrega Virlo; Apify sigue cableado). Virlo desemboca en **la misma forma
interna** que `Normalizar IG`, así que Asignar, Pre-trim, Heat-score, Gate y Armar candidato no se
tocan.

🩸 **La sombra no puede mover lo que se compra** (encontrado el 28/09, al escribir la `046`). Las
tres vistas de la marca de agua (`v_watermark_referentes`, `v_ritmo_referentes` y
`v_remedir_candidatos`) leían **todo** `pool_crudo`. Si las filas de Virlo entraban ahí, la marca de
agua de una cuenta avanzaba con un reel que vio Virlo, el motor le pedía a Apify "solo lo
posterior", y ese reel no lo compraba nadie. La sombra habría hecho perder videos al flujo real, sin
error. La `046` filtra las tres vistas a `proveedor = 'apify'`. Son el único camino por el que
cockpit y fachada leen `pool_crudo`, así que la app no cambia.

## Fases

| # | Qué | Estado |
|---|---|---|
| 0 | Sonda con plata real, sin tocar el pipeline | 🔧 script listo, **falta la API key** |
| 1 | ADR-101 + migración `046` (ajuste, `pool_crudo.proveedor`, vistas filtradas, `videos_meta.fuente='virlo'`, tarifas) + CATALOGO del cockpit + `AJUSTE_MAP` | 🔧 **escrito el 28/09, sin aplicar ni desplegar**. Falta: Mani aplica la `046` → deploy de la app → `n8n:push -- motor --nodos "Armar plan de corrida"` |
| 2 | Rama Virlo en el motor, **en sombra** (`onError: continue`, solo hasta `pool_crudo`) + tests con los fixtures | 🔧 `normalizar-virlo.mjs` + `test-virlo.mjs` listos contra la forma de la doc (**provisorio**). Falta cablear los nodos, y eso espera los fixtures reales |
| 3 | 2–3 corridas semanales en sombra + `comparar-proveedores.mjs` | 🔧 script listo y probado (con datos reales solo de Apify; la comparación, con un `fetch` simulado) |
| 4 | Carril Agents por proyecto (si la Fase 0 da volumen) | ⬜ |
| 5 | Transcript de Virlo antes que Supadata (solo si la Fase 0 muestra texto) | ⬜ |
| 6 | Corte: ajuste en `2` dos corridas → borrar nodos Apify con `n8n:push --borrar` → docs | ⬜ |

**Orden obligatorio en 1→2:** migración → deploy de la app → push del motor (como la `037`).
**Criterio de pase de la Fase 3, escrito antes de mirar:** Virlo trae ≥ 90 % de lo que Apify trae
sobre `min_views`, y el costo mensual cierra con el descuento negociado.

## Fase 0 — la sonda

[`Workflows/workflow-short-form-content/sonda-virlo.mjs`](../../Workflows/workflow-short-form-content/sonda-virlo.mjs).
Por defecto es dry-run y solo gasta con `--apply`. Guarda las respuestas crudas en
`fixtures/virlo/`, que después usan los tests de la Fase 2.

```bash
set -a && source .env && set +a     # con VIRLO_API_KEY cargada
node Workflows/workflow-short-form-content/sonda-virlo.mjs lookup --apply          # 1,50 USD: 3 referentes IG activos
node Workflows/workflow-short-form-content/sonda-virlo.mjs agent --di --apply \
  --intent "<criterio de un proyecto real, en una frase>" --keywords "a;b;c;…"    # 1,50 USD
node Workflows/workflow-short-form-content/sonda-virlo.mjs leer-agent <id>          # gratis; re-leer a los minutos (DI llega tarde)
```

### Predicciones (escritas el 28/09, ANTES de medir)

| Pregunta | Predicción | Si sale distinto |
|---|---|---|
| ¿Qué es `id` en un lookup de IG? | No es el media id numérico; se deriva de la `url` (shortcode → `shortcodeAExternalId`) | Si es numérico, más simple |
| ¿Hasta dónde llega con `max_videos=100`? | ≥ 50 días en la mayoría de los referentes | Si llega a menos, Virlo repite el problema de recencia de Apify |
| ¿Viene `duration`? | En ≥ 90 % de los reels | Sin duración no hay cobertura (ADR-095) |
| ¿Las vistas coinciden con `pool_crudo`? | Dentro de ±10 % para el mismo reel medido con <7 días de diferencia | Si no, hay que decidir qué fuente es la verdad |
| ¿El agent con DI trae el **texto** del transcript? | **No** (solo conteos), 70 % de confianza | Si trae texto, se habilita la Fase 5 y hay que mirar si trae tiempos |
| ¿Volumen de un agent de nicho grande? | ≥ 200 videos por corrida y ≥ 20 sobre 400k vistas | Si da menos, la Fase 4 no se justifica |

### Resultados

*(vacío hasta correr la sonda)*
