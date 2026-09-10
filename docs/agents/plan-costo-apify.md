# Plan — el costo de Apify no es sostenible

> **Estado al 2026-09-10 21:42 UTC.** Nace del reporte de Marú sobre las corridas de Juan Pablo
> Vieira (2 proyectos, muchos referentes, ~32 videos por proyecto y al menos uno fuera de tema) y de
> que el cupo de Apify se comió **la mitad del mes en 21 horas**.
>
> 🔑 **El hallazgo ordenador: el costo no depende de lo que se entrega, depende de lo que se colecta,
> y los dos números no se tocan.** Hoy el motor paga **529 reels por cada video entregado**. Ninguna
> fórmula de proporción arregla eso sola: hay que mover filtros a **antes** del pago, porque el
> dedup, el piso de vistas y el gate corren todos **después** de que Apify ya cobró.

---

## 1. Lo medido (2026-09-10, contra prod)

### 1.1 Dónde se va la plata

| | |
|---|---|
| Cupo Apify | **25,79 / 50 USD**, ciclo 10/09 00:00 UTC → 09/10 23:59 |
| Corridas de Apify ese día | 124, **todas `origin: API`** (el pipeline, no sesiones de agente) |
| `apify/instagram-scraper` | **114 corridas = 25,62 USD = 99,5 % del gasto del día** |
| Los otros dos actores juntos | 0,135 USD |
| Modelo de precio | `PAY_PER_EVENT`, **0,0023 USD por reel devuelto**. Lineal, sin descuento por volumen. |

Atribución por ventana de ejecución (cruzando `runs.inicio/fin` contra `startedAt` de Apify):

| ventana | corridas Apify | USD |
|---|---|---|
| motor 182 | 25 | 6,00 |
| motor 181 | 22 | 5,18 |
| **motor 178 (murió en `gate`, entregó 0)** | 19 | **4,09** |
| motor 177 | 16 | 4,01 |
| descubrimiento 180 | 3 | 0,67 |
| fuera de toda ventana (cron + sin identificar) | 39 | 5,80 |

**El motor es ~75 % del gasto.** El descubrimiento es ruido en comparación.

### 1.2 El embudo, corrida por corrida

| exec | reels pagados | entregados | de esos, bajo umbral |
|---|---|---|---|
| 177 | 1.742 | 6 | **6** |
| 178 | (pagó, murió en `gate`) | 0 | — |
| 181 | 2.523 | 6 | **4** |
| 182 | 2.610 | 1 | **1** |
| **total** | **~6.875** | **13** | **11** |

**1,97 USD por video entregado. Y 11 de los 13 entregados hoy no aprobaron relevancia.**

Desglose de la exec 182 (`filtrados_por_motivo`): 2.610 colectados → **1.545 muertos por
`min_views`** (59 %) → 329 por dedup → ~729 por el pre-trim de Haiku → **6 sobreviven** → gate → **1
entregado**.

### 1.3 La fórmula del costo

```
costo = (nº corridas) × (handles IG distintos) × (resultados_referente) × 0,0023 USD
```

Los cuatro factores estaban en máximo y sólo uno tenía perilla visible:

| factor | valor al 10/09 | default del Config | nota |
|---|---|---|---|
| `resultados_referente` | **150** | 20 | el `cap_resultados_referente` permite hasta **500** |
| `dias_recencia` | **200** | 7 | **el único filtro pre-pago que existe**, y estaba apagado de hecho |
| handles distintos | 58 con los 15 proyectos "activos"; **2 proyectos corren de verdad** | — | 149 links, **53 handles compartidos por más de un proyecto** |
| corridas/día | 4 | — | **el dedup corre después de pagar** |

🩸 **El punto que nadie había nombrado: `Leer procesados` está aguas abajo del nodo de Apify.**
Correr 4 veces el mismo día paga 4 veces por casi los mismos reels (`dedup: 329` en la 182, `295` en
la 181 — todos ya pagados). *La memoria del dedup ahorra trabajo, no ahorra plata.*

### 1.4 Por qué pasaron tan pocos, y por qué uno "era nada"

Tres causas, ninguna es Apify:

**(a) `Mínimo de vistas = 500.000` es GLOBAL.** Vive en `app.ajustes`, que tiene `instance_id` pero
**no** `proyecto_id`. El mismo número gobierna a `@the.holistic.psychologist` y a las cuentas de
trading de Vieira.

Medido sobre los 6.341 reels que se pagaron el 10/09 (leídos gratis de los datasets de Apify):

| pool | reels | mediana de vistas | % que llega a 500k |
|---|---|---|---|
| **cuentas de trading (las de Vieira)** | 5.808 | **19.306** | **1,8 %** |
| resto (psicología, comunicación, descubrimiento) | 533 | **243.134** | 32,1 % |

**La mediana del pool de trading es 12,6× más baja que la del resto.** Las cuentas no son malas: sí
producen virales (`casper_smc` tiene un reel de 6,3 M con mediana de 22 k), pero el 1-2 % de las
veces. Trading en Instagram es un nicho de menor alcance que autoayuda, y 500k es un umbral de
audiencia masiva.

**(b) El video fuera de tema no es un bug del gate: es el escalón 5 haciendo su trabajo.**
`bajo_umbral_entregados` fue **11 de 13** entregados. `razon_faltante` fue `"supply"` en los dos
proyectos, en las tres corridas. Cuando no alcanza el supply, el motor entrega lo que reprobó
relevancia antes que entregar menos. *A Marú no le falló el criterio: le llegó el relleno.*

**(c) Techo estructural aparte:** los 15 proyectos con `activo = true` suman **N = 320** y
`cap_top_n` corta la transcripción en **250**. El equipo pidió 350 en Ajustes y el motor lo baja a
250. Aunque sobrara supply, no cabe.

### 1.5 Dos hallazgos de datos que salieron de paso

- 🐛 **Dos proyectos activos que sólo se diferencian en la tilde:** `Comunicación para lideres`
  (N=15, 14 referentes, 20 candidatos) y `Comunicación para líderes` (N=20, 4 referentes, 40
  candidatos). Los dos corren. Alguien los duplicó y nadie lo vio.
- 🔴 **13 de los 15 proyectos "activos" no corren porque su VOZ está apagada.** La fachada
  (`?ambito=motor`) devuelve **2 proyectos**; la tabla devuelve 15 con `activo = true`. La pantalla
  de proyectos dice una cosa y el motor hace otra. Es el caso `_salteadosPorVoz`, que ya avisa, pero
  el aviso vive en `runs.metricas.avisos` y no en la pantalla donde se prende el proyecto.
- ⚠️ **3 de las 24 cuentas de trading registradas no devolvieron nada.** Revisar si están mal
  escritas o son privadas.
- ⚠️ **4 de las 21 cuentas leídas tienen mediana < 6.000 vistas** (`therobinritter` 1.233,
  `eliteoptionstrader2` 3.072). Con cualquier umbral razonable no van a aportar nunca.

---

## 2. Lo aplicado hoy (2026-09-10 ~21:15 UTC)

Cambio de knobs en `app.ajustes`, **sin código y sin `n8n:push`**, decidido por Mani:

| clave | antes | ahora |
|---|---|---|
| `Días de recencia` | 200 | **50** |
| `Resultados por cuenta de referente` | 150 | **25** |

✅ **Verificado por sus dos caminos, no por el eco del PATCH:** re-lectura directa por PostgREST, y
**la fachada `GET /api/engine/run-plan?ambito=motor&instancia=…` que es la que lee el motor**, que
devuelve `Días de recencia = 50` y `Resultados por cuenta de referente = 25`.

⚠️ **Se hizo por SQL y no por la pantalla de Ajustes, así que no dejó fila en `app.eventos`.** Si
algún canario se lee por eventos, este cambio es invisible para él.

---

## 3. 🔴 Los dos knobs se pelean, y esto se escribió ANTES de correr

**Bajar `dias_recencia` hace MÁS difícil pasar `min_views`, no más fácil**, porque un reel necesita
semanas para acumular vistas. Medido sobre el pool real de trading:

| ventana | reels | mediana | **pasan 500k** | pasan 250k | pasan 100k | pasan 50k |
|---|---|---|---|---|---|---|
| 14d | 1.233 | 13.408 | **4** | 19 | 65 | 183 |
| 30d | 2.166 | 18.367 | **13** | 52 | 156 | 402 |
| **50d (config actual)** | 2.917 | 18.742 | **18** | 65 | **237** | 590 |
| 200d (config vieja) | 5.745 | 19.092 | 83 | 206 | 648 | 1.250 |

**Con la config de este momento, el pool entero para llenar N=70 es de 18 videos**, antes de que el
gate mire uno solo. Y el gate mata ~90 %.

📏 **La cifra honesta para hablar con Dani sobre sus cuentas es la de ventana corta, no la larga.**
`braidenshaw` tiene mediana 155k sobre 186 reels de 200 días, pero **en sus últimos 11 reels la
mediana es 63k y ninguno llega a 500k**. Las vistas se acumulan: las medianas de ventana larga
exageran lo virales que son las cuentas.

### 3.1 Predicciones para la corrida de control (escritas 21:42 UTC, antes de disparar)

Decisión de Mani: **no tocar `min_views` todavía y medir el daño real** en vez de proyectarlo.
Config bajo la que corre: `dias_recencia = 50`, `resultados_referente = 25`, `min_views = 500.000`,
2 proyectos activos (~28 handles).

| qué | predicción | contra qué se compara |
|---|---|---|
| costo Apify de la corrida | **1,20 – 2,00 USD** | 6,00 USD de la exec 182 |
| `apify_ig` (reels colectados) | **500 – 750** | 2.610 |
| `filtrados_por_motivo.min_views` | **> 85 % de los colectados** | 59 % |
| `outputs` (entregados) | **0 – 2** | 1 |
| `bajo_umbral_entregados` | **= casi todos los `outputs`** | 1 de 1 |
| `por_proyecto[*].razon_faltante` | **`supply` en los dos** | `supply` en los dos |

**Si el costo baja como se predice y la entrega cae a 0, la conclusión NO es que el cambio fue
malo:** es que el costo y la entrega estaban atados por el lugar equivocado, y que `min_views` tiene
que bajar. **Si el costo NO baja, la fórmula de §1.3 está mal y hay que rehacerla.** Las dos son
falsables y la corrida decide.

---

## 4. Las palancas, ordenadas por retorno

| # | palanca | ahorro estimado | costo de hacerlo | estado |
|---|---|---|---|---|
| 0 | `dias_recencia` 200→50, `resultados_referente` 150→25 | ~75 % | 2 knobs | ✅ **aplicado 10/09** |
| 1 | **Ventana por referente**: `onlyPostsNewerThan` = días desde que se scrapeó ESA cuenta, no un global | ~60 % de lo que quede | ~10 líneas en `Armar plan` + `Split IG referentes` | ⬜ |
| 2 | **Fórmula proporcional** (abajo) | evita que sumar referentes multiplique el costo | ~15 líneas en `Armar plan` | ⬜ |
| 3 | **Actor más barato** (§5) | **×0,29** sobre todo lo anterior | bake-off + `n8n:push` | 🔧 bake-off hecho, falta 2ª prueba |
| 4 | `min_views` **por proyecto** | no ahorra: **arregla el supply** | migración + ADR | ⬜ bloqueado por la medición de §3.1 |
| 5 | Separar el token/cuenta de Apify del motor y de las sesiones de agente | no ahorra: **evita que una exploración deje al pipeline sin cupo** | decisión de Mani, cuesta plata | ⬜ |

### 4.1 La fórmula proporcional, escrita

Lo que pidió Mani: si hay muchos referentes, no hace falta pedir tantos videos por cabeza.

```js
// presupuesto_reels = cuántos reels estamos dispuestos a PAGAR por corrida (knob nuevo)
const resultados_referente = Math.min(
  cap_resultados_referente,
  Math.max(piso_resultados, Math.ceil(presupuesto_reels / Math.max(n_referentes, 1)))
);
```

**El presupuesto se fija en reels, no en videos entregados**, y esa es la diferencia que importa:
hoy el motor quema 529 reels por entregado, así que un presupuesto expresado en entregados no se
puede traducir a plata sin adivinar. Un presupuesto en reels **es** el costo (× 0,0023) y se lee
directo.

⚠️ **La fórmula sola no alcanza**, y conviene que quede escrito para no volver a discutirlo: reparte
mejor un gasto que ya es demasiado grande. Lo que baja el gasto de verdad es la palanca 1, porque es
la única que reduce lo que Apify **devuelve y cobra**, en vez de repartirlo.

---

## 5. Alternativas de herramienta

### 5.1 Bake-off medido (2026-09-10 21:21 UTC, cuenta `braidenshaw`)

| | `apify/instagram-scraper` (actual) | `instagram-scraper/instagram-profile-reels-scraper` |
|---|---|---|
| costo real medido | 0,115 USD / 50 reels = **0,0023 / reel** | **0,0074 USD / 11 reels = 0,00067 / reel** (incluye start y filtered-out) |
| **relación all-in** | — | **3,4× más barato** |
| campos que necesita el motor | todos | **todos** (`play_count`, `like_count`, `caption`, `url`, `shortcode`, `taken_at`) |
| filtro por fecha | `onlyPostsNewerThan`, gratis | server-side, **cobra 0,0004 por descartado** |
| entrada | 1 corrida por cuenta | **array de cuentas → 1 sola corrida** |
| adopción | 12.487 usuarios/mes (oficial de Apify) | 248 usuarios/mes |

🎁 **Bonus no buscado: devuelve `video_duration` en todos los items.** Hoy `app.videos_meta` tiene
duración en **1 de 150 filas**, y esa es exactamente la razón por la que el aviso de "guion
incompleto" de [ADR-095](../adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md) casi no
se puede dibujar. Migrar de actor lo arreglaría de rebote.

⛔ **NO está aprobado todavía, y el motivo es medido:** se pidieron 25 posts con ventana de 50 días y
devolvió **11, todos de los últimos 11 días**. La semántica de `recent` no es la que dice el nombre.
**Antes de migrar hay que correr una segunda prueba con 2-3 cuentas y formato de fecha ISO.** Un
actor 3,4× más barato que trae un tercio de lo pedido no es más barato.

### 5.2 Lo que NO se evaluó todavía

- `apify/instagram-reel-scraper` (oficial, mismo precio por reel pero acepta array de usernames y
  tiene `skipPinnedPosts`).
- Bajar de tier en Apify: el precio por resultado del actor barato cae de 0,00059 (BRONZE) a 0,00045
  (GOLD). No se evaluó si el salto de plan se paga solo.

---

## 6. Invariantes que salieron de acá y no hay que re-litigar

1. **El costo se decide antes del pago.** Dedup, `min_views`, pre-trim y gate corren todos después
   de que Apify cobró. Cualquier optimización que toque esos cuatro mejora la calidad, no la
   factura.
2. **`dias_recencia` y `min_views` están acoplados y hay que moverlos juntos.** Bajar la ventana
   sube de hecho el umbral, porque las vistas se acumulan con el tiempo.
3. **Un pool chico no baja la entrega: la ensucia.** Cuando falta supply, el escalón
   `bajo_umbral_entregados` rellena N con lo que reprobó relevancia. La queja de "me entregó un
   video que era nada" es el síntoma de un pool chico, no de un gate malo.
4. **El canario del costo no es el gasto del día: es USD por video entregado.** 25,62 USD suena
   distinto de 1,97 USD/video, y el segundo es el que se compara contra el norte de
   [ADR-089](../adr/ADR-089-una-sola-metrica-aprobados-contra-lo-pedido.md).
5. **El cupo no es un estado, es un saldo.** Se re-mide con `/v2/users/me/limits`. No se cita de un
   doc.
