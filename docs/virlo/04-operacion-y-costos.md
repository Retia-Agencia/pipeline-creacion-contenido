# Parte 4 · Operación y costos con Virlo

*Escrito el 2026-09-28. Cómo se paga, cómo se vigila y cómo se apaga el carril de Virlo. Los
precios son los de la doc (`dev.virlo.ai/docs/credits`, 28/09), sin el descuento que ofreció Nick.
**Los rendimientos (videos por corrida que pasan 500k, que el equipo aprueba) son predicciones**: la
Fase 0 los reemplaza por medidas.*

---

## 1. El cambio de modelo de costo

| | Hoy (Apify) | Con Virlo (Carril A) |
|---|---|---|
| Se paga por | **Cada reel** devuelto (0,0023 USD) | **Cada corrida** (0,50 / 1,50 USD), traiga lo que traiga |
| Subir el piso de vistas | Gratis, pero ya se pagó todo lo de abajo | **Gratis de verdad**: `min_views` se aplica al leer |
| Ampliar la ventana hacia atrás | Es lo que se paga ([costos.md](../costos.md): *"elegir ventana es lo que se paga"*) | No aplica: el agente busca por tema, no recorre cuentas |
| Lo que escala el costo | Cuántos reels publican los referentes | **Cuántos agentes × cuántas corridas** |

El invariante de [costos.md](../costos.md) (*dedup, piso, gate y caché corren después de que Apify
cobró*) sigue siendo cierto en Virlo, pero con otra unidad: **lo que se filtra después ya no cambia
la factura porque la factura es plana por corrida**. La única palanca de costo es **cuántas
corridas**.

## 2. Escenarios mensuales (precio de lista)

**Grano: un agente por voz** (D-1, dirección de Mani del 28/09: los proyectos son variedad dentro de la
voz y comparten videos; un agente por proyecto compraría lo mismo varias veces). Hay **6 voces**, y
al 28/09 **solo una está activa** (Nicolás Martínez). Un mes = 4,33 semanas.

| Escenario (6 voces) | Corridas/mes | Estándar | Con Data Intelligence |
|---|---|---|---|
| 1 corrida por semana por voz | 26 | **13 USD** | **39 USD** |
| 2 por semana | 52 | 26 USD | 78 USD |
| 5 por semana (lo que haría falta si §3 se cumple) | 130 | 65 USD | 195 USD |
| Diaria (el máximo que permite Virlo) | 180 | 90 USD | 270 USD |
| + botón "correr ahora" (corrida única) | c/u | 0,50 USD | 1,50 USD |
| + Carril B: 15 referentes estrella, chequeo semanal | 65 chequeos | 16 USD | n/a |

**Con el precio que ofreció Virlo después del piloto (0,40 / 1,40 USD, 01/10):** 1 por semana = **10 /
36 USD**; 5 por semana = **52 / 182 USD**; diaria = **72 / 252 USD**. El descuento es sobre la base
(0,10 USD por corrida), no sobre Data Intelligence: con DI baja ~7 %, no 20 %.

**El piloto sale gratis:** Virlo carga **50 USD de crédito** para la prueba. Alcanza para ~33
corridas con Data Intelligence: la Fase 0 (4 corridas, ~6 USD) y la Fase 3 con 2 voces piloto
semanales durante 3 semanas (~9 USD) entran con margen.

Si el agente mezcla idiomas (D-5) sigue siendo una corrida; si hace falta un agente por idioma, cada
fila se multiplica por la cantidad de idiomas.

*La versión anterior de esta tabla era por proyecto (19 activos: 41 a 494 USD/mes). Se cambió el
28/09.*

Lo que se sigue pagando fuera de Virlo:

| Proveedor | Para qué | Mes |
|---|---|---|
| Supadata | **Respaldo** de transcripts (D-2, 01/10) + pantallas de URL suelta | 47 USD hoy (con el respaldo medido en el piloto, revisar si hay plan menor) |
| Apify | Solo Colecciones: metadata y mp4 por URL | ~7 USD (2,2 USD en 9 días, medido 25/09) |
| Anthropic (Haiku) | Traducir + gate (si D-4 lo deja) | similar a hoy |

**Hoy se gasta ~100 USD/mes** (Apify con tope de 50 + Supadata 47 + Haiku) **para 0,6-2,3
aprobados por semana** en el piso de 500k.

## 3. Cuánto rinde una corrida (predicción; lo medido está en §3.1)

| Paso | Supuesto | Fuente | Videos |
|---|---|---|---|
| Videos que guarda el agente | 200-360 | Doc de Virlo (corrida sana) | ~280 |
| Con 500k+ vistas | **15 %** (rango 5-30 %) | Supuesto: la búsqueda favorece lo popular; TikTok top 10 % empieza en 1M, IG top 3 % en 500k | ~42 |
| Que calzan con la intención | 70 % | Doc: ~30 % se descarta por intención | ~29 |
| Que no son repetidos de otro proyecto o corrida | 80 % | Supuesto (los 5 proyectos de psicología se pisan) | ~23 |
| **Que el equipo aprueba** | 39 % | [costos.md §4.1.1](../costos.md) | **~9** |

**Demanda por voz:** ~200 guiones al mes ≈ **46 aprobados por semana**. Si la predicción se cumple,
una corrida semanal por voz trae **una cuarta parte** de eso: **el riesgo es que falte, no que
sobre**. Sobraría solo si se baja el piso de 500k. Por eso las corridas se ajustan según la demanda:
se arranca con 1 por semana por voz y se suben (o se suma un segundo agente con otro ángulo) **solo
en la voz que se quede corta**, midiendo `aprobados / N`. Con las 6 voces activas y la predicción
cumplida, eso da la fila de 5 por semana: **65 USD (estándar) o 195 USD (con Data Intelligence)**
al mes, **antes** del descuento de hasta 50 %.

**Costo por aprobado** (predicción): ~0,06 USD estándar, ~0,17 USD con Data Intelligence. Hoy, con
Apify: 0,61 a 6,27 USD por entregado ([costos.md §3.3](../costos.md)), o sea **1,5 a 16 USD por
aprobado**. *Si la Fase 0 da la mitad de lo predicho, Virlo sigue siendo un orden de magnitud más
barato por aprobado.* Eso es lo que se lleva a la negociación con Nick.

### 3.1 Medido: la sonda de la Fase 0 (A2, 2026-10-01)

Seis agentes de una corrida con Data Intelligence, sobre las temáticas de
[07 §B0](./07-refactor-tickets.md): T1 (emocional), T2 (trading), y T3 (comunicación laboral)
cuatro veces: solo inglés, solo portugués, solo francés y **mezclada** (EN + PT + FR). Las tres
plataformas, `english_only: false`. Keywords de `suggest-keywords` (calidad 100 en las cinco)
más las nuestras de B0; las excluidas, recortadas a mano (Virlo proponía `money`, `strategy` y
`profit` para trading, y una excluida tira el video si la palabra aparece en el caption).
**Costo: 9,00 USD exactos** (saldo 50 → 41, medido con `GET /account/balance`). Cómo repetirla:
[`fixtures/virlo/sonda-2026-10-01.sh`](../../Workflows/workflow-short-form-content/fixtures/virlo/sonda-2026-10-01.sh)
y después `sonda-virlo.mjs leer-agent <id>` (gratis). Las respuestas enteras quedan en
`fixtures/virlo/crudo/` (gitignored, 24 MB); la muestra para los tests de A1, en
[`fixtures/virlo/real/`](../../Workflows/workflow-short-form-content/fixtures/virlo/real/).

Los números de abajo se leyeron entre 25 y 45 min después de cada corrida. **Todavía faltaba
llegar entre el 13 % y el 33 % de Data Intelligence** en los videos de 500k+, así que los
`intent_match` pueden subir.

| Pregunta | Predicción | Medido | ¿Se cumple? |
|---|---|---|---|
| Videos por corrida | 200-360 | **658-822** (`GET videos`). El reporte dice `videos_linked` 726-2.265: **el reporte no es lo que se puede leer** | Sí, de sobra |
| Con 500k+ vistas | ~15 % (≥ 30) | **6-12 %: 41-92 videos** por agente (T1 92 · T3-en 71 · T2 61 · PT 49 · mezcla 46 · FR 41) | El % no; el conteo ≥ 30 sí, en los seis |
| `intent_match` true entre esos | ~70 % | **24-71 %**: FR 71 · T1 65 · PT 63 · T3-en 52 · T2 38 · **mezcla 24** | Solo FR, T1 y PT. La mezcla, debajo del 40 % |
| Coincidencia `intent_match` vs nuestro gate | ≥ 75 % | No medido: va con el asignador (A3) | Pendiente |
| **Aprobación del equipo** | **≥ 25 %** | **Pendiente: hoja ciega de 105 videos** (abajo) | **Decide el veredicto** |
| Portugués vs inglés | PT trae menos volumen | El agente PT trajo **734 videos, pero solo 199 en portugués** (255 en inglés, 106 en español). El FR, **63 en francés de 658**. Entre los 500k+: 4 PT y 3 FR | Una keyword en otro idioma **no** garantiza videos en ese idioma |
| Agente mezclado (EN+PT+FR) | Trae los tres idiomas | **740 videos** (395 EN, 50 PT, 30 ES, 13 FR) contra **2.039 únicos** de los tres separados. El que más descarta por intención (**881, 39 %**) | **Un agente por idioma** (D-5): mezclar no ahorra, achica |
| Aprobados por corrida por voz | ~9-11 | Pendiente (sale de la hoja) | Pendiente |
| Transcript entre los 500k+ | TT/YT ~85 %, IG ~40 % | **TikTok 82-95 % · YouTube 87-100 % · Instagram 4 de 19 (21 %)** | TT/YT sí. IG por debajo del 25 %, con una muestra chica y DI todavía llegando |
| Transcript `platform` contra Supadata (20 videos) | ±15 % en ≥ 90 % | **20 de 20, 18 idénticos al carácter**: los dos leen el mismo caption de la plataforma | Sí. Para TT/YT, **Supadata no agrega nada** |
| Plataformas en el total | IG ~15 · YT ~50 · TT ~35 | **IG 9-12 % · YT 25-40 % · TT 56-64 %**. Entre los 500k+: **IG 1-8 %** | IG < 10 % entre los 500k+: toca el agente de prueba solo-Instagram (D-8) |
| Aprobación por plataforma | YT ≤ IG/TT | Pendiente (la hoja trae la plataforma en la clave) | Pendiente |
| Re-medidos en la 2.ª corrida recurrente | > 30 % | No medible con agentes de una corrida | Va al piloto (V-11) |
| `intelligence_status: ready` al terminar | ≥ 70 % | Al `finalized` (mezcla): **37 %** de los 500k+. Entre 25 y 45 min después: **67-87 %** | **No.** La ingesta tiene que releer más tarde (lo que ya dice §4) |

**Lo que la tabla no preguntaba y salió:**

- 🩸 **YouTube trae videos de hasta 2020.** De los 312 videos únicos de 500k+, **109 (35 %) tienen
  más de un año, y los 109 son YouTube.** Virlo dijo *"hasta 1 año atrás"* ([01 §1.4](./01-reunion-y-api.md) #4):
  no vale para YouTube. Edad de los 312: < 30 días 14 % · 30-90 días 23 % · 90-365 días 28 % · > 1 año 35 %.
  El filtro `start_date` de `GET videos` es gratis, así que se corta al leer; lo que hay que decidir
  es **cuántos días** (hoy el ajuste `Días de recencia` del motor dice 50).
- **Los transcripts `platform` casi nunca traen `segments`**, y el `transcribed` sí. Para la regla de
  cobertura de ADR-095 alcanza igual: `duration` vino en **4.029 de 4.029** videos, pero la
  cobertura en segundos solo existe en los `transcribed`.
- **Algunos transcripts `platform` son basura corta** (10 y 18 caracteres en la muestra, Supadata
  devuelve lo mismo): el gate de "transcript vacío" tiene que medir largo, no presencia.
- **Virlo reescribe las keywords**: con una intención que dice *"practical scripts"*, le agregó
  `scripts` a casi todas las de T3 (`intent_keywords`). Se ve en el `keyword_breakdown` de cada corrida.
- **T1 y T2 casi no se pisan** (2 videos en común): temáticas distintas sí dan material distinto.

**Veredicto: técnicamente SIGUE; la compuerta todavía no se puede cerrar.** Todo lo que puede romper
el modelo por el lado de Virlo aguantó: alcanza el volumen, sale barato, trae los transcripts de
TT/YT y el id de Instagram se deriva bien (`external_id` de los seis reels de muestra, por la regla
de `normalizar-virlo.mjs`). La fila en negrita la contesta el equipo:
**`fixtures/virlo/crudo/calificacion-ciega.csv`** (105 videos de 500k+, 15 con `intent_match` true y
5 false por agente, sin repetidos, mezclados y **sin decir de dónde vienen**). La clave
(`calificacion-clave.json`, al lado) dice de qué agente, plataforma, idioma y `intent_match` es cada
fila, para cruzar después.

## 4. Cómo se vigila

| Riesgo | Qué pasa | Defensa |
|---|---|---|
| **Saldo en cero** | Los recurrentes y el tracking **se pausan y no vuelven solos** al recargar. El equipo ve un Feed vacío sin error. | Chequeo diario de `GET /account/balance` (gratis) con aviso en Corridas cuando baje de un umbral. Después de recargar, reactivar agentes (`PUT /agents/:id` `active: true`). Evaluar recarga automática (decisión de Mani: tarjeta). |
| **Cobros invisibles** | Las corridas recurrentes **no salen en `X-Cost`**. | Registrar el costo de cada corrida en `runs` con la tarifa (`app.tarifas`) y conciliar contra la baja del saldo una vez por semana. |
| **Pre-flight** | Crear una corrida única sin saldo da `402` (gratis), pero el recurrente se pausa en silencio. | Mismo patrón que `Cupo Apify (pre-flight)` (ADR-094): leer el saldo antes del botón "correr ahora". |
| **Saldo compartido** | Las sesiones de agente (MCP) y el pipeline gastan del mismo saldo, como pasó con Apify el 09/09 (12,30 USD en exploración). | Una API key para el pipeline y otra para exploración; si Virlo permite dos equipos, dos saldos. **A preguntar a Nick.** |
| **Webhooks falsos** | Los webhooks de Virlo **no vienen firmados**. | Header propio `X-Webhook-Secret` (secreto largo, en el gestor y en Vercel) y rechazar lo que no lo traiga. Idempotencia por `run_id`: el mismo aviso dos veces no crea candidatos dos veces. |
| **Data Intelligence tarde** | `finalized` no espera los campos; un tercio o más puede quedar `pending`. | Leer al recibir el webhook y **releer a las ~6 h** los que quedaron pendientes. Un video pendiente al día siguiente no se espera más. |
| **Corridas pobres** | `videos_linked` ≤ 20, o >70 % descartado por intención. | Leer `GET /agents/:id/runs` después de cada corrida y levantar un aviso en Corridas con la causa por keyword. |
| **`partial_failure`** | Se cobra entero aunque falle una plataforma o keyword. | Solo se registra; no hay defensa. |

## 5. Cómo se apaga (rollback)

- **Carril A:** `PUT /agents/:id` con `active: false` en todos los agentes = cero cobros desde la
  próxima corrida. Los candidatos ya entregados se quedan.
- **El carril de Apify no se toca durante la migración**, así que apagar Virlo deja el sistema
  exactamente como está hoy.
- Se borra un agente solo cuando el proyecto se borra: borrar pierde el historial de tendencias y la
  memoria del autopilot.

## 6. Secretos nuevos

`VIRLO_API_KEY` (pipeline) · `VIRLO_API_KEY_EXPLORACION` (sesiones y MCP, si se separan) ·
`VIRLO_WEBHOOK_SECRET`. Van al `.env` (comentados var por var, como el resto), al gestor de
contraseñas y a las variables de entorno de Vercel. **Nunca a git.**
