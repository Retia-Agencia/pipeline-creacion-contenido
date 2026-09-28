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

Si el agente mezcla idiomas (D-5) sigue siendo una corrida; si hace falta un agente por idioma, cada
fila se multiplica por la cantidad de idiomas.

*La versión anterior de esta tabla era por proyecto (19 activos: 41 a 494 USD/mes). Se cambió el
28/09.*

Lo que se sigue pagando fuera de Virlo:

| Proveedor | Para qué | Mes |
|---|---|---|
| Supadata | Transcripts (~4.000/mes a escala objetivo, dentro del plan) | 47 USD hoy (revisar si hay plan menor) |
| Apify | Solo Colecciones: metadata y mp4 por URL | ~7 USD (2,2 USD en 9 días, medido 25/09) |
| Anthropic (Haiku) | Traducir + gate (si D-4 lo deja) | similar a hoy |

**Hoy se gasta ~100 USD/mes** (Apify con tope de 50 + Supadata 47 + Haiku) **para 0,6-2,3
aprobados por semana** en el piso de 500k.

## 3. Cuánto rinde una corrida (predicción, a reemplazar por la Fase 0)

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
