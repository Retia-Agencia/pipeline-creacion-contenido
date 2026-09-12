# HANDOFF — estado vivo del MVP de reels

> **Si vas a trabajar en el repo, leé esto primero (2 min).** Acá vive el estado real: qué task
> está libre, quién tiene qué, y qué pasó en las últimas sesiones. El *qué hacer y cómo* de cada
> task vive en [ROADMAP §3](../../ROADMAP.md); el contexto de producto en [ROADMAP §1](../../ROADMAP.md) y el
> diseño en [PLAN.md](../../PLAN.md). El tablero activo del refactor vive en
> [refactor-voces-proyectos.md §4–§5](./refactor-voces-proyectos.md) (componentes A–E).

## Protocolo (lo único que hay que respetar)

1. **Al tomar un task:** ponete como dev y pasalo a 🔧 en el tablero. Commit chico ("toma B1").
   Así nadie duplica trabajo.
2. **Al terminar la sesión** (termines o no el task): actualizá el tablero, y agregá una entrada
   al log de abajo — *qué se hizo · qué quedó a medias · gotchas/aprendizajes · qué sigue*.
   Marcá `[x]` lo completado en el checklist del ROADMAP. Commit + push de todo junto.
3. **Credenciales e IDs: JAMÁS acá ni en ningún archivo del repo.** Todo va al gestor de
   contraseñas compartido (el validador escanea secretos en cada corrida).
4. Si un task revela que el diseño está mal → no parchear en silencio: anotarlo en el log y
   discutirlo (si es estructural, termina en ADR).

**Estados:** ⬜ libre · 🔧 en curso · ✅ hecho · ⛔ bloqueado


## 🗂️ Dónde está cada cosa (rotado el 2026-09-12)

Este archivo llegó a **8.334 líneas** con **cuatro** secciones "ARRANCÁ POR ACÁ" apiladas, y el
tercio del medio eran cierres viejos anidados uno dentro de otro bajo un encabezado que decía
"Pendiente vivo". Cuatro puertas de entrada es ninguna. Se rotó.

| buscás | está en |
|---|---|
| **el estado de hoy** | el §ARRANCÁ POR ACÁ de acá abajo (cierre 152) |
| **el refactor del motor** | 🧭 [plan-refactor-motor.md](./plan-refactor-motor.md) — el punto de partida único |
| **los cierres 145 a 152** | acá abajo, completos |
| **los cierres 70 a 144** | [handoff-archivo-2026-06_09.md](./handoff-archivo-2026-06_09.md) |
| **el tablero del refactor Voces→Proyectos** | [refactor-voces-proyectos.md](./refactor-voces-proyectos.md) §4–§5 |

**Regla al cerrar sesión:** el cierre nuevo va **arriba**, como hermano de los demás (`## 🔒 CIERRE
N`), **nunca anidado dentro del anterior**. Así fue como nacieron las 5.736 líneas de blockquotes
dentro de blockquotes que se acaban de archivar.

## 🚦 ARRANCÁ POR ACÁ — CIERRE 152 (2026-09-12): brainstorm del refactor del motor, y cuatro conclusiones propias que se cayeron

> 🧠 **Sesión de brainstorm y documentación. Cero código del motor, cero corridas, cero migraciones.**
> Lo único aplicado al producto fue **bloquear el botón ▶** (`e4c1133`).
>
> 📕 **El doc es [plan-refactor-motor.md](./plan-refactor-motor.md) y es el punto de partida único.**
> Consolida las sesiones del 10, 11 y 12/09. **No re-derives nada de acá: está todo allá**, con §11
> listando lo que quedó abierto y §8 el resumen sin jerga.

**Lo que hay que saber antes de tocar el motor, en orden de cuánto cambia decisiones:**

1. 🩸 **El `min_views = 500.000` NO es un default de dev: es una instrucción explícita del jefe**, y
   *"para él eso es accuracy"* (Mani). ⇒ el refactor **no es un arreglo técnico, es una
   renegociación de qué significa accuracy**. Hay dos definiciones en tensión y **un video de 500k
   que el equipo no aprueba sube una y baja la otra** (ADR-089, que ya lleva el aviso). Quién da esa
   conversación **queda ABIERTO**.
2. 🟢 **Las vistas NO se congelan, y ahora está medido de verdad y GRATIS.** 5.706 reels comparados
   entre fechas, **95,8 % creció**; en las ventanas de semanas, ~100 % (122/122, 120/120). ~1-3 %/mes.
   **La salida estaba en el desperdicio:** la re-compra dejó el mismo reel medido en varias fechas
   dentro de datasets ya pagados. Script y dato crudo en
   [`docs/experimentos/`](../experimentos/crecimiento-historico-apify.mjs). **Falta el tramo del reel
   JOVEN, sale de los mismos datos, cuesta 0 y VENCE EL 2026-10-11.**
3. 🧭 **Reencuadre de Mani: el motor no mata videos, los ASIGNA · ORDENA · MIDE.** Con el obstáculo
   medido: hoy el gate **no puede** asignar, porque puntúa cada par (video × proyecto) con la prosa
   de ese proyecto y **15 proyectos son 15 rúbricas incomparables**. *El mismo bug que `min_views`,
   por segunda vez: un número absoluto usado como si fuera comparable.*
4. ⬜ **Los dos mensajes al equipo de redes están escritos y SIN ENVIAR** (§9). Falta luz verde.

### 🩸 Cuatro conclusiones de este repo que esta sesión desmintió

Van juntas porque **el patrón es uno**: un número o una forma que nadie verificó, citado como si
estuviera medido. **Las cuatro las disparó Mani preguntando de dónde salía el dato.**

| decía | dice |
|---|---|
| `cap_top_n` es *"un techo estructural"* | **nunca muerde**: sobreviven 15/14/6 de un cupo de 250 |
| *"las views se congelan"* (48 h en `costos.md`, 7 d acá) | **nunca dejan de crecer**; la medición era de 52 min y no tenía resolución |
| `madurez()` sube hasta el día 7 y se aplana | **eso es un escalón inventado**; la curva se lee, no se asume |
| *"el costo de Apify no es sostenible"* | **0,84-2,41 USD/mes** bien usado; lo caro fue disparar 5 tandas en un día |

Las cuatro quedaron **marcadas en su doc de origen**, no sólo acá.

### Lo demás que se hizo

- **`docs/` ordenado:** este handoff pasó de **8.334 a ~1.300 líneas** (tenía 4 «ARRANCÁ POR ACÁ» y
  5.736 líneas de cierres anidados unos dentro de otros); 4 planes ejecutados a
  [`docs/archivo/`](../archivo/); ~90 links re-apuntados, 0 rotos.
- **Medido contra prod:** 59 referentes activos **todos de Instagram** (⇒ el eje TikTok corre vacío,
  y el onboarding ya lo dice con el número) · el ledger de cuentas **ve 3-6 de las ~59 que se
  compran** · 15 proyectos piden N=320 · criterios de relevancia: mediana 879 chars de prosa con
  **seis tipos de regla revueltos**, incluida una de **cumplimiento** ("no recomendaciones explícitas
  de inversión") que hoy se puede perder cuando alguien reescriba las de tema.
- ✅ **Cerrado el origen del N:** sale de **sesiones de grabación ya comprometidas con clientes**
  (Mani). Demanda derivada, no aspiración.
- ⭐ **Hallazgo que no es corrección sino lo contrario:** `costos.md §4.3.2` **ya había probado una
  métrica relativa** (≥2× la mediana de la propia cuenta) y medido que mantiene la dirección de las
  vistas absolutas (12,0 % → 41,1 %). *Estaba escrito y sin conectar, así que se volvió a descubrir.*

### ⚠️ Dos advertencias para quien siga

- **Mani sospecha que `plan-refactor-motor.md` está sobre-diseñado** y abrió sesión aparte para
  simplificarlo. Su criterio de aceptación, que está en el encabezado del doc: **si no se le puede
  explicar al equipo de redes en 3 a 5 pasos, el diseño está mal.**
- **La consolidación de `docs/` (merges + script) tiene su propia sesión dedicada** y va a
  §12 del plan. **Re-medir el diagnóstico antes de correrla**: la sesión de simplificar va antes y
  puede cambiar la lista.

---

## 🔒 CIERRE 151 (2026-09-12) — El proveedor nunca fue el problema, y 25 referentes no pueden dar 150 videos

> 🔬 **Sesión de investigación pura: cero código, cero corridas del motor, cero migraciones.** Todo
> se midió leyendo la API de Apify y los datasets YA PAGADOS de la exec 183, que no cuesta nada.
> Disparada por Mani: *"evaluar alternativas al actor de Apify y traer una recomendación con
> números"*.
>
> 📕 **El doc entero es [evaluacion-proveedores-scraping.md](./evaluacion-proveedores-scraping.md)**
> — 5 actores de Apify y 7 alternativas externas, con precio, paginación, infraestructura y riesgo.
> Acá van sólo los cinco hechos que cambian decisiones. **No los re-derives.**

**1. 🔴 El cuello de botella no es la plata ni el proveedor: son 25 referentes.** El equipo pide
~150 videos/semana. El techo físico del roster, con todo comprado y ningún filtro, es **59 a 218
reels crudos/semana** ⇒ **0,6 a 45 aprobados** (× la tasa de `min_views` medida sobre las 450 filas
del pool × 39 % de aprobación humana). Para 150 hacen falta **301 a 1.115 referentes con `min_views`
en 100.000** (25,9 USD/mes, cabe). Con `min_views` en 500.000 hacen falta 1.656-6.132 y **no cabe en
el cupo a ningún precio** (142 USD/mes).

**2. 🟢 Apify bien usado cuesta 0,84 a 2,41 USD/mes**, con marca de agua por referente
(`onlyPostsNewerThan` = fecha del reel más nuevo ya comprado de esa cuenta) y **una corrida por
semana**. El cupo de 50 aguanta **580 a 2.149 referentes** a ese régimen. ⇒ **La marca de agua no es
la mejora: es el PERMISO para multiplicar los referentes por 12-40.** Es lo que conecta el punto 1
con el 2, y es la tesis del doc.

**3. 🩸 Y el dato que reordena el diagnóstico de costo entero:** la exec 183 **con la config actual,
sin marca de agua**, a cadencia semanal cuesta **4,45 USD/mes — el 9 % del cupo**. Los 23,83 USD del
10/09 no los causó la ventana, ni el actor, ni la falta de `onlyPostsOlderThan`: **los causó disparar
5 tandas en un día.** El 74 % de re-compra del cierre 149 es re-compra **intradía**. *El proveedor
nunca fue el problema; la cadencia sí, y es gratis.*

**4. ⛔ Confirmado y extendido: ninguno de los 5 actores de Apify tiene cota superior de fecha**
(verificado el input schema de `instagram-scraper`, `instagram-api-scraper`, `instagram-post-scraper`,
`instagram-reel-scraper` y `apidojo/instagram-scraper` vía `GET /v2/acts/<id>/builds/default`). El
`until` de apidojo dice literal *"Returns posts newer than this date"*: es otro piso. **Y deja de
importar con marca de agua: el piso de esta corrida es el techo de la anterior.**

**5. 🔓 Dos precios que se creían no consultables SÍ están en la API de Apify** (`pricingInfos[-1]
.pricingPerEvent.actorChargeEvents[*].eventTieredPricingUsd`; nuestro plan STARTER = tier **BRONZE**,
verificado porque BRONZE de `instagram-scraper` = 0,0023 y coincide exacto con lo medido):
- **El add-on `transcript` cuesta 0,041 USD por minuto empezado, por reel.** Supadata `auto` cuesta
  0,001567 por video ⇒ **26× más caro**. ⛔ **La idea de "que el transcript venga con el reel y
  Supadata salga del pipeline" queda cerrada con número.** *El handoff decía "Apify no lo expone por
  API" y era falso.*
- **`instagram-reel-scraper` NO es más barato** (0,0023, lo mismo). Lo que trae es **`skipPinnedPosts`**,
  y ese es su único argumento: la fuga de fijados es **26 de 450 reels (5,8 %) hoy** y pasa a ser
  **el 31 % de la factura** cuando la marca de agua baje el denominador a 85. *Crece justo cuando se
  arregla la cadencia.*

### Lo que se contestó a Mani, y por qué sus dos intuiciones necesitaban número

- **P: *"¿si Apify no es caro, arreglar la cadencia es suficiente?"*** → **NO.** Es suficiente para el
  costo y es **hostil al supply**: la marca de agua abarata comprando menos. Es la tensión central
  del doc y es lo que empujó el punto 1 por encima del 2.
- **P: *"hay un actor con esquema idéntico 13 % más barato, propongo pasarnos"*** → `instagram-api-scraper`
  cobra 0,0020 **más 0,001 por arranque de corrida**, y el motor arranca **una corrida por cuenta**
  (`Split IG referentes`). Punto de equilibrio: **3,3 reels por corrida de actor**. En el régimen con
  marca de agua (2,4 reels/cuenta) sale **+5,1 % MÁS CARO**. El 13 % sólo aparece mandando todos los
  handles en UNA corrida (`directUrls` es array). **Ahorro total: 3,76 USD/año.**
- **P: *"Apify es un cuello de botella, es nuestra única herramienta de scrapeo; miremos Meta Graph
  API y HikerAPI"*** → 🟡 **Meta Graph API cubre 25-50 % del roster**, medido sobre
  `metaData.isBusinessAccount` de los reels ya pagados: **5 de 20 cuentas son Business**, otras 5
  tienen `businessCategoryName` (probables Creator). **Nunca puede ser proveedor único** —la mitad
  del roster son cuentas personales que `business_discovery` no ve— pero es la única fuente
  **oficial** posible, imposible de bloquear por scraping. Requiere App Review con Advanced Access.

### Lo evaluado y descartado, con su porqué

- 🔴 **Agent-Reach** (`Panniantong/Agent-Reach`, el repo que mandó Mani). **Su código está limpio**
  (cero `eval`/`exec`/ofuscación/`shell=True`/`curl|sh`; cookies acotadas por dominio y **sin
  Instagram** en la lista; el `postinstall` de su dependencia npm **no hace red**). **Queda
  descalificado por arquitectura, no por seguridad:** su módulo de IG tiene **13 líneas** y delega en
  **OpenCLI**, que maneja *tu Chrome real logueado* y es **desktop-only, sin headless** ⇒ **no puede
  correr en el servidor de n8n**. Y el mismo adaptador expone `like`, `follow`, `comment`, `unfollow`.
  ⚠️ Sus 79.695 ⭐ contra **282 watchers** (ratio 283:1, sano 20-60:1) y OpenCLI 29.225 ⭐ / **62
  watchers** (471:1): **el conteo de estrellas no es evidencia de uso real** y era la única señal de
  confianza disponible.
- ⛔ **instaloader / instagrapi:** el costo no es el código, es proxies + cuentas quemables + el ban
  cayendo sobre cuentas propias, a cambio de ahorrar ~29 USD/año.
- 🟨 **`apidojo/instagram-scraper` a 0,00049 (4,7× más barato):** anotado, **no adoptado**. A este
  régimen ahorra ~1,4 USD/mes, tiene 776 usuarios/30d contra 42.748 del oficial, y su output schema
  no está verificado. **Se reabre pasados los ~400 referentes.**
- ⬜ **PreWave** (herramienta interna que el jefe de Mani pidió y aún no llega): casilla abierta. Las
  3 preguntas que la deciden en 20 minutos están en §7 del doc.

### 📏 Lo que cuesta migrar, para que el cero del ahorro se vea entero

`Normalizar IG` lee **23 campos** del item de Apify. Cualquier proveedor nuevo obliga a remapear los
23, re-verificar el dedup por `external_id`, y reescribir el pre-flight de cupo de ADR-094 (que lee
`/v2/users/me/limits` y **no tiene equivalente en ningún otro proveedor**). Son días. **Para ahorrar,
como máximo, 29 USD al año.**

### ⚠️ Lo que NO se pudo medir, y qué lo cierra

1. **El rango del ritmo de publicación es 59 a 218 reels/semana (4×) y este pool no puede cerrarlo**:
   14 de 26 cuentas topearon en `resultsLimit = 25`, así que su historia dentro de la ventana está
   truncada. *Elegir uno de los dos sería inventar precisión.* **Lo cierra** una corrida con
   `resultsLimit` 100 y ventana 14 d sobre el roster actual (**~1,50 USD**).
2. **El tamaño de página de `user/medias/chunk` de HikerAPI.** Cobra por PÁGINA, no por reel: si trae
   12+, su tier de entrada (0,02/req) sale **más barato que Apify** sin prepagar; si trae 1, es 8,7×
   peor. **Es el único número que podría dar vuelta un veredicto.** **Lo cierra su trial de 100
   requests: 0 USD.**
3. **El output schema de `instagram-reel-scraper`** (input idéntico ≠ output idéntico). **Lo cierra**
   una corrida de 1 reel: **0,0033 USD**.

### 🔴 Lo que esta evaluación NO toca, y sigue siendo el frente más grande

El termómetro roto del cierre anterior: `relevancia_score ↔ aprobado` = **+0,041** y
`heat_score ↔ aprobado` = **+0,044** (n=136). **Multiplicar los referentes por 12 sin arreglar eso
multiplica por 12 el material que se juzga con una vara que no mide.** Y sumar 300 cuentas sin el
ledger por cuenta (`app.v_salud_referentes` + los dos contadores que le faltan, §2.a de la sesión del 11/09) son 300 suscripciones que nadie cancela: hoy ya
hay 5 corriendo que se llevan el 24 % del gasto y devuelven cero.

### 🩸 El error propio de esta sesión

Se sospechó que el `postinstall` de `@jackwener/opencli` descargaba código en tiempo de instalación,
**por el nombre del script** (`fetch-adapters.js`). Se bajó el tarball de npm y se leyó: **no hace ni
una llamada de red**, sincroniza hashes locales. *Un nombre no es una medición, ni siquiera para
acusar.*


## 🧭 El brainstorm del refactor (sesiones del 10, 11 y 12/09) vive en su propio doc

Las tres sesiones de brainstorm que estaban acá **se consolidaron en
[plan-refactor-motor.md](./plan-refactor-motor.md)** el 2026-09-12, a pedido de Mani. Ese doc es el
punto de partida: hechos con su fuerza de evidencia, diseño propuesto, decisiones que no se
re-litigan, y las preguntas abiertas partidas por **quién las contesta** (equipo de medios · una
medición · un dev). Trae además el resumen no técnico (§8) y el mensaje para el equipo (§9).

⚠️ **Dos correcciones de ahí que invalidan cosas que este handoff daba por buenas:**
- **Las vistas NO se congelan** (§1.2). La medición era de 52 minutos y su `0,00 %` está redondeado:
  es compatible con ~66 %/año. Este archivo lo citaba como "a los 7 días" y `costos.md §3.6` como
  "a las 48 horas", los dos sobre la misma tabla.
- **`cap_top_n` no es un techo estructural.** Nunca muerde: sobreviven 15 / 14 / 6 de un cupo de 250.

El texto original está en [handoff-archivo-2026-06_09.md](./handoff-archivo-2026-06_09.md).

## 📌 Pendientes operativos vivos (post cierre 149)

> *Esto era un tercer "ARRANCÁ POR ACÁ" y no lo es: el arranque es uno solo, el de arriba. Acá
> viven los pendientes que siguen abiertos y no entraron al refactor del motor.*

> 🔴 **LO PRIMERO, y es un bug con causa raíz y tarea abierta: el run no cierra cuando la corrida
> no entrega nada.** 11 de 63 corridas del motor terminaron bien en n8n y quedaron marcadas
> `fallo` por el barredor, así que **de 19 filas en `fallo`, 11 son mentira** y el norte de ADR-089
> (`aprobados / N pedido`) se calcula sobre un universo sucio. `Cerrar run en el registro` cuelga
> del final de una cadena lineal de 30 nodos, y `Gate de relevancia` / `Armar candidato` devuelven
> `[]` cuando no sobrevive nada: con 0 items n8n corta la cadena. Diagnóstico completo y arreglo
> propuesto en el **cierre 149 §1**. *Estaba anotado sin diagnosticar desde el cierre 145.*

> 📏 **Y el solapamiento ya no es una estimación: es 100,0 % medido id por id.** El 10/09 se
> pagaron **10.351 reels para 2.679 distintos: 17,63 de 23,83 USD (74 %) en re-comprar lo mismo**.
> Dos tandas separadas por 52 minutos trajeron **cero videos nuevos**. La ventana por referente
> tiene tarea propia y sesión propia; no la decidas de paso (cierre 149 §2 y §6).


> 💰 **El costo de Apify YA SE ARREGLÓ y está medido — 6,00 → 1,04 USD por corrida,
> 83 % menos.** Lo que quedó abierto es lo contrario: **la corrida de control entregó CERO videos.**
> El costo y la entrega estaban atados por el lugar equivocado y ahora se ven por separado.
>
> 📕 **Los dos docs nuevos son la puerta de entrada, no este bloque:**
> - **[docs/costos.md](../costos.md)** — el mapa monetario entero: los 3 proveedores, el diagrama de
>   dónde se paga, el histórico, la tabla de decisión ventana × umbral **con costo por celda**, y
>   los pendientes de plata. **Si la pregunta es "cuánto cuesta", empieza acá.**
> - **[plan-costo-apify.md](./plan-costo-apify.md)** — el diagnóstico, las predicciones escritas
>   antes de correr y su veredicto. **Si la pregunta es "por qué", empieza acá.**
>
> ✅ **Aplicado y verificado por la fachada que lee el motor (no por el eco del PATCH):**
> `Días de recencia` 200 → **50**, `Resultados por cuenta de referente` 150 → **25**. Cero código,
> cero `n8n:push`. ⚠️ Se hizo por SQL, así que **no dejó fila en `app.eventos`**.
>
> 🆕 **Y hay un tercer eje medido, escrito el 10/09 en [costos.md §4.3](../costos.md): el REPARTO
> entre referentes.** Tres cosas que cierran preguntas abiertas, todas medidas gratis sobre datasets
> ya pagados: **(1) no hay costo fijo por corrida ni por referente** (`usageTotalUsd / 0,0023` = el
> número exacto de reels), así que *repartir el mismo presupuesto entre más referentes con menos
> profundidad no ahorra un centavo*; **(2) bajar `resultados_referente` es la palanca equivocada** —
> la cola de cada cuenta es su tramo productivo (2,7 % de útiles en los 5 reels más nuevos contra
> 28,8 % en los 5 más viejos), así que la profundidad es un knob de VOLUMEN y por eso la 183 bajó
> 83 % el costo y 100 % la entrega; **(3) el eje que sí manda es CUÁLES referentes** — 5 cuentas se
> llevan el 24 % del gasto y devuelven CERO útiles, y podarlas baja el USD/útil de 0,0155 a 0,0117
> sin perder nada. ⚠️ **La lista de poda de §7 estaba armada por mediana y mandaba podar dos cuentas
> que sí producen.** Y el desperdicio grande no es la profundidad: **94-98 % de cada corrida
> re-compra lo que la anterior ya pagó**, y el actor no tiene `onlyPostsOlderThan` para evitarlo.

> 🩸 **SUPERADO el 2026-09-12 — no lo ejecutes como está escrito.** Sigue siendo cierto que 500.000
> ahoga a trading, pero la salida ya no es mover el knob a 100.000: es **sacar el umbral absoluto
> del camino** y reemplazarlo por una medida relativa a la propia cuenta
> ([plan-refactor-motor §3.2](./plan-refactor-motor.md)). Y hay un dato que este bloque no tenía:
> **el 500.000 es una instrucción explícita del jefe**, así que bajarlo no es una decisión de dev.
>
> 🔴 **LA DECISIÓN QUE ABRE LA PRÓXIMA SESIÓN, y es de un solo knob: bajar `Mínimo de vistas`.**
> Está en **500.000** y es **global** (`app.ajustes` no tiene `proyecto_id`). Medido: el pool de
> trading de Vieira tiene mediana **22.394** contra **256.556** del resto — 11,5× de diferencia — y
> sólo el **2,4 %** de sus reels llega a 500k. Con ventana de 50 días el pool entero para llenar
> **N = 70** son **5 videos**. La corrida 183 lo confirmó entregando 0.
> **Recomendación medida: 100.000** (45 videos en el pool, ~1 USD la corrida). Bajarlo **no cuesta
> un centavo** — `min_views` filtra DESPUÉS de pagar. La tabla completa está en
> [costos.md §4](../costos.md).
>
> 🔴 **Y se reprodujo el bug del cierre 145, ahora 2 de las últimas 6 corridas:** la exec **183**
> terminó `success` en n8n y su fila en `runs` quedó **`en_curso` con sólo `metricas.etapa`**.
> **Perdió todas las métricas del embudo**, así que la entrega hubo que medirla contra
> `app.candidatos` y el costo contra la factura de Apify. *Mientras esto siga abierto,
> `USD/entregado` no se puede calcular para las corridas afectadas y `v_costos_semana` las cuenta
> como cero.*
>
> ⛔ **El ⛔ de "no corras el motor" queda LEVANTADO** (Mani, 10/09 ~21:40, eligió medir en vez de
> proyectar). Pero el cupo sigue siendo un saldo: **26,85 / 50 USD al 22:14 UTC**, ciclo hasta el
> 09/10. Una corrida hoy cuesta ~1,10 USD, así que quedan ~21 corridas. **Re-medí con
> `/v2/users/me/limits` antes de disparar, no cites este número.**
>
> 🩸 **Y una tarifa del repo está mal por 5,7×, dato aportado por Mani al cierre:** Supadata es
> **plan Mega, 47 USD/mes = 30.000 créditos**, y **cobra por crédito, no por video** — `auto` = 1
> crédito (0,00157 USD), `generate` = **2 créditos por MINUTO**, traducción = 30 por minuto.
> `app.tarifas` dice `0,009 USD/video`. Corregido en el doc: **el ranking real es Apify 73,9 % ·
> Haiku 18,8 % · Supadata 6,8 %**, y el histórico baja de 109,71 a **83,03 USD**. La cifra vieja
> hacía ver a Supadata como el segundo frente de costo cuando es el tercero y lleva gastado el 12 %
> de **un solo mes** de su cupo en toda la historia del proyecto. **Falta escribir la corrección en
> `app.tarifas`** — hoy sólo está en el doc.
>
> ⚠️ **Anthropic es el único de los tres proveedores SIN tope**, o sea el único que no se frena
> solo, y con la corrección quedó segundo. Nadie le ha mirado la factura nunca.
>
> ✅ **ADR-095 ESTÁ ENTERO EN PRODUCCIÓN, LOS DOS LADOS, y ahora ADR-096 también (a medias, a
> propósito).** Motor: `n8n:push` del nodo `Transcribir (Supadata)` el 10/09 19:43 UTC, `n8n:diff`
> **verde en los 5**, workflow activo, snapshot `.n8n-snapshots/motor-2026-09-10T19-43-03-945Z.json`.
> Cockpit: hasta `8b8c9b5` en `origin/main`. Migraciones `039`–`042` aplicadas y **la `042` ya
> verificada en el catálogo**.
>
> ✅ **La Tarea 9 está CERRADA: los 23 transcripts cortados ya no existen.** 7 recuperados
> (`generate`), 16 con candado puesto **después de medirlos de verdad**, **0 pendientes**. Era la
> única tarea con vencimiento del plan. Verificado por efecto: `origen = 'motor'` quedó en
> `{generate: 7, auto_tras_generate: 16, auto: 568}`.
>
> 🔴 **PERO NADIE MIDIÓ EL MOTOR TODAVÍA, y ahora no se puede.** El nodo corre el arreglo en el live
> desde las 19:43 y **no hubo una sola corrida después**. Los tres números escritos ANTES de mirar
> siguen en [plan-transcript-completo §Tarea 11](./plan-transcript-completo.md), con la advertencia
> de que **uno de los tres NO PUEDE funcionar**: `metricas.llamadas.supadata` está definido como
> `_distinct($('Transcribir (Supadata)').all())`, o sea **videos distintos, no llamadas**.
> *Construido y verde no es medido — y ahora además está bloqueado por plata.*
>
> ⏳ **LO SIGUIENTE QUE SÍ SE PUEDE HACER HOY, y no toca Apify: la verificación humana #16.** Es la
> de más retorno porque **prueba dos cosas de una**: que el deploy del cockpit llegó a producción
> —**no se pudo confirmar el build**, la cuenta de Vercel conectada (`Manigreen`, hobby) no tiene el
> proyecto— y que el reintento le llega a **Majo**, que es a quien se le rompió. Paga 3 créditos de
> Supadata y nada de Apify. Instrucciones, precondición ya chequeada y tabla de lectura en
> [verificaciones-humanas §16](../verificaciones-humanas.md).
>
> ⏳ **Y la #15**, el aviso de "guion incompleto", que va con **un link de Instagram Y uno de
> TikTok**: el de TikTok va a quedar **sin aviso y eso es lo esperado hoy** (ADR-095 §3.6). Probar
> sólo con Instagram pasa en verde tapando la mitad del sistema. Tampoco toca Apify.
>
> ✅ **Cinco verificaciones humanas se cerraron el 10/09** (3, 4-bis, 4-ter, 4-quater y 17). Quedan
> abiertas la **15**, la **16**, la **10** (RLS de LinkedIn con filas) y la **8** (V6, que
> 🛑 **no hay que correr**: pide rediseño antes).
>
> 🩸 **Al cerrarlas apareció otra vez el mismo defecto de siempre, y por tercera vez con el mismo
> dato:** la #4-quater esperaba `Grabados 294`, medido el 20/08, y `app.grabados` tiene **366** (la
> última fila es del 07/09). La pantalla tenía razón y el doc no. Quedó la consulta en vez del
> número. *El número no va en prosa: se cuenta.*

> 🟡 **La concurrencia del motor queda COMO ESTÁ, por decisión de Mani** (10/09): prefiere corridas
> rápidas y va midiendo. Es relevante porque es **la causa medida** de que Supadata encole y
> conteste `202` (ver cierre 147 §2). Si algún día conviene bajarla, el número **no está en el
> código**: es `concurrencia_transcribir` en el nodo `Config`, se cambia en n8n sin push. La señal
> de que está costando es la línea `Supadata encoló el generate (202)` en el log del nodo, que
> existe desde hoy.

> ✅ **CERRADO en el repo (cierre 149, 11/09) el bug que venía del 145:** la corrida que termina
> bien, entrega cero y no se cierra. Es la familia de ADR-094 al revés — aquella cierra las que
> **mueren**, ésta terminaba **bien** y no se cerraba sola, perdiendo todo el embudo (o sea
> `aprobados / N pedido`, el norte de ADR-089). Arreglado con un **centinela** en `Gate de
> relevancia` y `Armar candidato` ([ADR-094 §Enmienda](../adr/ADR-094-una-corrida-que-muere-tiene-que-cerrarse-sola.md)).
> ⚠️ **Falta el `n8n:push` y la corrida que lo mida.**

> 🟡 **El cupo de Apify: 25,74 de 50 USD, ciclo arrancado el 10/09 a las 00:00 UTC** (medido el
> 10/09 19:00 con `/v2/users/me/limits`). **La mitad del mes en 19 horas**, y el ciclo anterior
> cerró en 50,02 de 50 con TRES corridas. **Ese es el motivo del ⛔ de arriba.** *El cupo no es un
> estado, es un saldo: se re-mide con `/v2/users/me/limits`, no se cita.*
>
> 🔑 **Apify marca el origen de cada corrida, y eso ya evitó un diagnóstico errado.** El 09/09 dos
> corridas `origin: MCP` (11:03 y 11:09 UTC) gastaron **USD 12,30** — exploración con agente, no el
> motor, que gastó ~1,68 ese día. El 10/09 se volvió a mirar y **las 60 corridas del día son
> `origin: API`** (el pipeline), a ~$0,34 por referente. **El pipeline y las sesiones de Claude
> comparten una sola cuenta con un solo tope.** ADR-094 lo **avisa**; separarlo (token o cuenta
> propia para el motor) sigue siendo decisión pendiente de Mani.

> 🔴 **Sigue vigente: el `heat_score` no mueve lo que llega al Feed.** Medido en la corrida 167:
> mediana **1,2775** en los entregados contra **1,2736** en los no entregados, y correlación con la
> relevancia de **r = −0,104** (n=159). Los 4 videos de más vistas rankearon 6/63, 8/63, 21/55 y 34/63
> por heat y murieron en el gate con relevancia 0–0,2. **El score decide dónde se gasta la plata, no
> qué ve el equipo.** Fórmula y trampa de medición en el cierre 142 §3–§4.

> ⏳ **Y el norte de la corrida 167 todavía no se puede leer** — los 65 están sin calificar. **35 de
> esos 65 entraron por el escalón 5** (`bajo_umbral_entregados`, que daba 0 en las 3 corridas
> anteriores). Si el norte baja, ese es el sospechoso #1. Medir antes de tocar.

> ✅ **Los dos bugs MUDOS del cierre 141 ya no son mudos ([ADR-094](../adr/ADR-094-una-corrida-que-muere-tiene-que-cerrarse-sola.md), 09/09).**
> **(a)** una corrida sin cupo de Apify **se cierra sola en `fallo` con el número adentro** — verificado
> en prod con el cupo agotado (exec 174, 1 segundo, costo 0); **(b)** un proveedor que rechaza el 100%
> de las llamadas ya grita, y `{error}` (nos rechazaron) quedó separado de `{}` (no había nada), que
> era justo la distinción que faltaba para el TikTok mudo del cierre 142.
> ⏳ **Lo que sigue sin probarse en vivo:** el rechazo **a mitad de camino** (capa 2) y que
> `metricas.etapa` sobreviva una corrida completa. Los dos se leen de la próxima corrida real —o
> sea, **después** de que se levante el ⛔ de Apify.

## 🔒 CIERRE 150 (2026-09-11) — El centinela, y una columna que mentía en verde

> **Todo en el repo, NADA en producción todavía.** Dos pendientes de gate humano: el
> **`n8n:push` del motor** (4 nodos) y la **migración `043`** en el SQL Editor.

Dos pedidos de Mani: arreglar el cierre de las corridas sin entregas, y averiguar por qué
`ajustes.actualizado_en` no reflejaba el cambio del día anterior.

### 1 · El centinela (ADR-094 §Enmienda) — 4 nodos, cero topología, cero migración

El diagnóstico ya estaba escrito abajo (§1 del cierre 149, acá abajo) y se confirmó nodo por nodo: **en
n8n un nodo que saca 0 items apaga todo lo que cuelga de él, y de `Armar candidato` cuelga la única
cadena que cierra la corrida.**

**Medido: sólo DOS nodos de esa cadena pueden sacar 0 items.** `Preparar procesados` y `Resumen del
run` devuelven siempre 1 item, y `POST processed_items` tiene `alwaysOutputData` + `onError:
continue`. De los dos que pueden, **`Armar candidato` es el que pasó** y `Gate de relevancia` es el
defensivo: hoy no puede quedar en cero porque `min_relevancia` está en **0** y `cap_descartes` en
**10**, y se abre el día que suba `Relevancia mínima`.

🔬 **La autopsia de la exec 183**, que es lo que convirtió la hipótesis en un hecho: 3
transcripciones escritas, **0 descartes, 0 candidatos**. Como `Etapa: gate` disparó, `Traducir` emitió
items y el gate corrió; el gate emitió sus 3 descartes `sin_guion` —por eso `app.descartes` quedó en
0, `Preparar descartes` filtra justo ese motivo— y `Armar candidato` se quedó con 0.

**Los 4 nodos tocados** (`Gate de relevancia`, `Armar candidato`, `Preparar candidatos`, `Resumen del
run`) y el detalle de qué hace cada consumidor con el centinela están en la tabla de la
[§Enmienda de ADR-094](../adr/ADR-094-una-corrida-que-muere-tiene-que-cerrarse-sola.md). El que más
fácil se escapa: en `Armar candidato` un item **sin `external_id` cae en `_keep` FAIL-OPEN**
(ADR-017), así que un centinela sin filtrar se volvería **candidato fantasma en el Feed**.

#### 🔑 Cómo se verificó, y por qué 18 tests verdes no alcanzaban

**Un test verde que pasaría igual sin el arreglo no prueba nada.** Se revirtió **cada uno de los 4
nodos por separado** contra el fix y se contó qué se ponía en rojo:

| nodo revertido | tests en rojo |
|---|---|
| `Gate de relevancia` | 1 |
| `Armar candidato` | 2 |
| `Preparar candidatos` | 1 |
| `Resumen del run` | 5 |

Los cuatro parches son load-bearing, medido. Más `auditar-workflows.mjs` sin hallazgos, `npm run
validate` en verde (2.803 checks) y `n8n:diff` marcando **exactamente esos 4 `[drift]`** y nada más.

#### 🩸 El número que circulaba no existía

Se pidió arreglar "**12 de 64** corridas afectadas". **64 es la cantidad de corridas del
`transcriptor`**, otro workflow; el motor tiene **63**. Y el 11 del diagnóstico previo es correcto
pero es un **superset**: son las barridas por el zombie, de las que 2 son el tope de Apify que
ADR-094 ya explica. La firma buena —independiente de lo que n8n haya podado— es
`runs.error like 'run de motor sin cerrar%'`, y el reparto de las 11 está en §1 más abajo.

### 2 · `ajustes.actualizado_en` — no está roto, la columna significa otra cosa ([ADR-097](../adr/ADR-097-actualizado-en-lo-sella-la-base-no-el-que-escribe.md))

`actualizado_en` es `timestamptz not null default now()`, y un **`default` sólo dispara en INSERT**.
Lo único que la mantenía viva era el cockpit, que la escribe a mano en `lib/ajustes.ts`. El cierre
148 movió los knobs **por SQL** ⇒ `valor` se movió y la fecha no.

**Dos señales independientes:** el catálogo (`pg_trigger` da **cero** triggers no-internos sobre
`app.ajustes`) y el efecto (`Días de recencia` = 50 con fecha del **31/08**, `Resultados por cuenta
de referente` = 25 con fecha del **01/09**).

🔑 **La columna no significa lo que su nombre dice**: significa *"la última vez que alguien la tocó
desde el cockpit"*, y nadie la lee así. Arreglo: trigger `before update` que sella `now()` siempre,
con `set search_path` desde el día uno (la lección de la `035`), más el re-sellado de las dos filas
**al DÍA y no a la hora** — la hora no existe y no se inventa.

📏 **Dato que baja la urgencia y por eso va escrito:** hoy la columna **no se renderiza en ninguna
pantalla**. `leerAjustes` la parsea con zod y ahí muere. Su único consumidor es un humano con SQL.

⚠️ **No arregla el *quién***: `app.eventos` sigue sin fila, porque un SQL no tiene `usuario_id`.

### Lo que queda, en orden

1. ⏳ **`npm run n8n:push -- motor --nodos "Gate de relevancia,Armar candidato,Preparar candidatos,Resumen del run"`**
   (dry-run primero, después `--apply`). Sólo `parameters`, sin topología.
2. ⏳ **Correr la [`043`](../../core/schema/043_ajustes_actualizado_en.sql)** en el SQL Editor. Su
   verificación #2 es la que importa: un trigger creado y no disparando se ve idéntico a uno que anda.
3. ⏳ **La corrida que mide el centinela.** Una corrida con cero entregas tiene que cerrar sola en
   `ok`, con `metricas.sin_entregas: true` y el embudo completo. *Construido y verde no es medido.*
   ⚠️ Cuesta plata (Apify), así que va junto con la decisión de `min_views` que abre el bloque de arriba.

### 🩸 El error propio de esta sesión

Se escribió en la ADR y en la migración que el nodo `Etapa: colecta` (commit `2f7c427`, el que guarda
`runs.params.ajustes`) **estaba en el repo y no en el live**, deducido de que las 6 corridas del
10/09 tienen `params->'ajustes'` en null. Es falso: **está en el live desde el 11/09 01:05 UTC**, lo
que pasa es que **no hubo ninguna corrida después**. Lo cazó `n8n:diff`, que marcó 4 drifts y no 5.
*Un `null` en los datos no dice dónde está el código: dice que nadie lo ejecutó.* Corregido en los 3
archivos.

---

## 🔒 CIERRE 149 (2026-09-11) — El run que no cierra tiene causa, y el 74 % del gasto de un día se fue en re-comprar lo mismo

> **Commiteado y empujado al live** (1 nodo, `Etapa: colecta`). Cuatro tareas nuevas en Notion.
> La corrida 183 se cerró a mano. Cero migraciones, cero `core/`.

### 0 · Dos cosas que este handoff YA DECÍA y esta sesión re-derivó desde cero

🩸 **Se quemó media sesión averiguando por qué las 5 tandas del 10/09 le pidieron a Apify
`resultsLimit: 150` y `onlyPostsNewerThan: 200 days` cuando `app.ajustes` dice 25 y 50.** Se
revisó `n8n:diff` (verde), el `Config` del live, la fachada, el caché de Next, las instancias y el
`actualizado_en` de cada fila. La respuesta estaba escrita **en el bloque ARRANCÁ POR ACÁ de este
mismo archivo**: *"`Días de recencia` 200 → 50, `Resultados por cuenta de referente` 150 → 25 … se
hizo por SQL, así que no dejó fila en `app.eventos`"*. Los knobs se bajaron **esa noche**, después
de las cinco tandas caras. No hubo bug.

🩸 **Y el bug del run que no cierra estaba anotado hace seis días**, en el cierre 145: *"🔴 Bug
encontrado de paso, sin diagnosticar: una corrida que terminó OK y no se cerró"*, sobre la exec
178. Volvió a pasar con la 183 y hubo que diagnosticarlo igual. *Es exactamente el patrón que
CLAUDE.md nombra: un diagnóstico a medias en un doc se ve idéntico a uno que nadie empezó.* Ahora
tiene causa raíz y tarea.

### 1 · El run no cierra cuando la corrida no entrega nada — CAUSA RAÍZ

**De 63 corridas del motor, 11 terminaron bien en n8n y nunca cerraron su fila.** El barredor las
marcó `fallo` dos horas después. **De 19 filas en `fallo`, 11 son mentira**; los 8 reales son tope
de Apify (×4), credencial de la fachada, timeout de Supadata y un `Bad request` en POST Candidatos.

Prueba: la ejecución 183 es `status: success`, `finished: true`, parada 21:54:44, y su fila seguía
`en_curso` con `fin = null`.

**`Cerrar run en el registro` cuelga del final de una cadena lineal de 30 nodos:**

```
Gate de relevancia → Armar candidato → Preparar procesados
  → POST processed_items → Resumen del run → Cerrar run en el registro
```

Los dos primeros hacen `const out = []` + `push` + `return out`. Si no sobrevive nada devuelven
`[]`, y **con 0 items n8n no ejecuta ningún nodo más**. El cierre no corre y la ejecución termina
en verde. Las dos corridas colgadas con rastro de etapa dicen las dos `etapa: gate`: llegaron al
gate y nunca escribieron `Etapa: entrega`, que cuelga de `Armar candidato`. **Cero entregas = run
sin cerrar.**

Es la familia de ADR-094 capa 2, que arregló esta misma trampa en la rama de Apify. El comentario
de `Normalizar IG` ya la nombra con todas las letras; quedó viva dos ramas más abajo.

✅ **APLICADO el 2026-09-11 (cierre 149), con el nombre `_centinela` y no `_vacio`.** Ver el bloque
del cierre 149 arriba: 4 nodos, cero topología, 18 tests, y cada parche verificado por reversión
individual. ⚠️ Falta el `n8n:push` y la corrida que lo mida.

📏 **Y el reparto de las 11 quedó medido, que es distinto de "11 son mentira".** La firma buena no es
el join contra n8n (que pierde las ejecuciones podadas) sino **`runs.error like 'run de motor sin
cerrar%'`**, que lo escribe el propio barredor y no caduca: **11 de 63**. De esas 11:

| cuántas | cuáles | qué son |
|---|---|---|
| **2** | execs **178** y **183** | **este bug**, con firma exacta (`metricas.etapa` en `gate`, n8n `success`) |
| 2 | execs **169**, **170** | **tope de Apify** — sí fallaron, y ADR-094 ya les puso el pre-flight. `fallo` no es mentira ahí; lo que faltaba era la causa |
| 1 | exec **155** (31/08, 191,9 min) | compatible, sin miga: es anterior a `metricas.etapa`. Es la que el cierre 130 atribuyó a `Heat-score v1` en 0, ya arreglada con `alwaysOutputData` |
| 6 | jul–ago, **sin `execution_id`** | indecidibles: el campo no existía y n8n las podó |

*La 183 no aparece en las 11 porque alguien la pasó a `ok` a mano después del barrido.*

### 2 · El solapamiento, medido id por id y gratis

El handoff estimaba *"94-98 % de cada corrida re-compra lo que la anterior ya pagó"*. Se midió
exacto, comparando los datasets que Apify ya tiene guardados (leerlos no cuesta nada):

| tanda (UTC) | pagados | nuevos | repetidos | USD | USD tirados |
|---|---|---|---|---|---|
| 13:06 | 1.742 | 1.742 | 0 | 4,01 | 0,00 |
| 13:58 | 1.741 | **0** | 1.741 | 4,01 | 4,00 |
| 14:46 (falló) | 1.741 | **0** | 1.741 | 4,01 | 4,00 |
| 16:05 | 2.520 | 784 | 1.736 | 5,80 | 3,99 |
| 17:17 | 2.607 | 153 | 2.454 | 6,00 | 5,64 |

**10.351 reels pagados, 2.679 distintos. 17,63 de 23,83 USD (74 %) en videos ya pagados ese mismo
día.** Las dos de la mañana solaparon **100,0 %**: cero videos nuevos en 52 minutos.

⚠️ **El día costó 23,83 USD y la base decía 19,82.** La diferencia son los **4,01 USD de la exec
178**, que falló y no dejó métrica. *Una corrida que muere paga igual y no se cuenta.*

### 3 · ~~Las views se congelan a las 48 horas~~ 🩸 DESMENTIDO el 12/09

> ⛔ **Esta conclusión es falsa y se deja tal cual por ser registro de cierre.** La medición era de
> 52 minutos y no tenía resolución para ver crecimiento lento. Medido de verdad y gratis el 12/09:
> **las vistas no dejan de crecer nunca** ([plan-refactor-motor §1.3](./plan-refactor-motor.md)).
> Lo que sí vale de la tabla: la velocidad se desploma con la edad.

Como las mismas 1.741 filas se pagaron dos veces con 52 minutos de diferencia, se pudo medir el
crecimiento sin gastar nada:

| edad al colectar | n | crecimiento en 52 min |
|---|---|---|
| < 24 h | 19 | **2,29 %** |
| 1-2 d | 16 | 0,38 % |
| 2-3 d | 21 | 0,19 % |
| > 7 d | 1.603 | **0,00 %** |

**Cierra la idea de "colectar de viejo a nuevo para que las views estén consolidadas":** el efecto
es real pero afecta **35 de 1.740 reels (2 %)**, y en Instagram **no se puede pedir** — el actor
sólo tiene piso de fecha, ni techo (`onlyPostsOlderThan`) ni ordenamiento. Traer el rango entero y
tirar los nuevos **cuesta más, no menos**. En TikTok sí se puede (`newestPostDate`,
`profileSorting: 'oldest'`), y TikTok son 0,20 USD en toda la historia.

📏 Dos números más del mismo pool: **97 % está por debajo del piso de 500.000** (mediana **21.881**
views) y **92 % tiene más de 7 días** (mediana 59 d, máximo **768**), que es la ventana de 200 días
en acción.

### 4 · Lo aplicado: el run guarda con qué ajustes corrió

`Etapa: colecta` ahora escribe también `params`. Va en ese nodo y no en otro porque es el único
punto donde se cumplen las tres condiciones: ya conoce los ajustes (cuelga de `Armar plan de
corrida`), ya hace un PATCH a la fila del run, y **corre antes de que Apify cobre**, así que una
corrida que después se cuelga igual deja escrito con qué corrió.

```
params: { workflow, execution_id, plan_generado_en, referentes,
          ajustes: { resultados_referente, dias_recencia, cap_top_n, top_n,
                     min_views, min_likes, min_relevancia } }
```

🔑 Reconstruye `workflow` y `execution_id` a mano porque **un PATCH sobre `params` reemplaza el
jsonb entero**, y de esos dos dependen `Barrer runs zombie` (filtra por `params->>workflow`) y
`workflow-registro-fallos` (busca por `params.execution_id`). `plan_generado_en` va porque es el
campo que habría contestado en un segundo la pregunta del §0.

Verificado por dos vías: `n8n:diff` verde en los 5 y el nodo leído de la instancia trae el cuerpo
nuevo. Snapshot: `.n8n-snapshots/motor-2026-09-11T01-05-30-747Z.json`.
⏳ **Falta la prueba real:** la próxima corrida tiene que traer los siete knobs en
`runs.params.ajustes` y conservar `params.workflow = 'motor'`.

### 5 · Sobre pasarle el piso de views a Apify (la pregunta que abrió la sesión)

**No existe**, y la asimetría es cruel: Instagram (96 % del gasto) no tiene ningún filtro de
popularidad; TikTok tiene `leastDiggs`, que filtra por **corazones y no por views**, no combina con
el filtro de fecha, y es la plataforma que no gastamos.

Sí se confirmó la física que lo haría valer la pena: los dos actors son `PAY_PER_EVENT` sobre
*"each result written to the dataset"*, o sea que **filtrar arriba sí ahorra**. La fórmula:
conviene cuando `supervivencia < p / (p + a)`; en TikTok `0,002 / 0,003` = **67 %**.

⛔ **Y un actor propio que envuelva a `apify/instagram-scraper` no ahorra un centavo**, porque el de
adentro cobra igual. Sólo sirve si el scraping es nuestro, y ahí el costo se muda a proxies
residenciales y a aguantar que Meta rompa los endpoints. Por eso el research quedó apuntado a
**otros proveedores**, no a otro actor. Criterio de comparación: **dónde está la frontera del
cobro**.

### 6 · Lo que sigue, en orden

1. 🔴 **Arreglar el cierre de runs con cero entregas** (test primero). Tarea en Notion, prioridad 1.
2. **Research de proveedores de scraping alternativos**, por frontera de cobro.
3. **La ventana por referente**, en sesión propia: la llave va por referente y no por corrida, y la
   marca avanza al más nuevo **aceptado**, no al más nuevo **visto**. Bloqueo real: desde ADR-087
   `processed_items` sólo recuerda lo entregado, así que el 97 % de lo que se paga no deja rastro de
   su fecha y no hay dónde guardar la marca.
4. **Decidir si los ajustes necesitan bitácora propia**, ahora que se sabe que tienen dos puertas
   (cockpit, que deja marca, y SQL, que no).

## 🔒 CIERRE 148 (2026-09-10) — El costo bajó 83 % y la entrega cayó a cero, que es la misma noticia

> **Todo commiteado.** Dos docs nuevos: `docs/costos.md` (el mapa monetario) y
> `docs/agents/plan-costo-apify.md` (el diagnóstico + predicciones). Sin cambios de código, sin
> `n8n:push`. Los knobs se movieron en `app.ajustes`, por SQL.

Arrancó por un reporte de **Marú**: las corridas de **Juan Pablo Vieira** (2 proyectos, muchos
referentes) devolvieron ~32 videos por proyecto y **uno estaba fuera de tema**. Y el cupo de Apify
iba en la mitad del mes en 21 horas.

### Lo que se midió

- **99,5 % del gasto del día es UN actor**: `apify/instagram-scraper`, 114 corridas, 25,62 de 25,75
  USD. El motor es ~75 % de eso; el descubrimiento, 0,67.
- **El embudo del 10/09: ~6.875 reels pagados → 13 entregados = 1,97 USD por video.** Y **11 de los
  13 entraron por `bajo_umbral_entregados`**, o sea reprobaron relevancia y se entregaron para
  llenar N. **El "video que era nada" de Marú no es un gate roto: es relleno por falta de supply.**
- **La causa del pool chico no es Apify: es `min_views = 500.000`, que es GLOBAL.** El pool de
  trading tiene mediana 22.394 contra 256.556 del resto (11,5×). Sólo 2,4 % de sus reels llega a
  500k. *Las cuentas de Dani sí producen virales —`casper_smc` tiene un reel de 6,3 M— pero el 2 %
  de las veces.*
- **Los 2 proyectos de Vieira comparten 23 de sus 24 cuentas.** No son dos universos de referentes.

### El hallazgo ordenador

🔑 **Dedup, `min_views`, pre-trim, gate y caché corren TODOS después de que Apify cobró.** Ninguno
baja la factura. **Sólo dos cosas deciden lo que se paga, y las dos viven en `Armar plan de
corrida`: cuántos handles y `resultados_referente`**, acotados por `dias_recencia`, que es el único
filtro que corre del lado de Apify. De ahí sale el invariante que gobierna el doc de costos:
**elegir umbral es gratis; elegir ventana es lo que se paga.**

Y uno que va contra la intuición y quedó en la tabla: **con umbral alto, la ventana LARGA sale más
barata por video** (0,12 USD en 200d contra 0,52 en 7d), porque los reels viejos ya acumularon
vistas. **La peor celda de la tabla es ventana corta + umbral alto.**

### Lo aplicado y su medición

`Días de recencia` 200→50, `Resultados por cuenta de referente` 150→25. Corrida de control **183**,
con las predicciones **commiteadas antes de dispararla**:

| | predicción commiteada | modelo deduplicado | medido |
|---|---|---|---|
| costo Apify | 1,20 – 2,00 | **1,02** | **1,042** |
| entregados | 0 – 2 | 0 | **0** |

**83 % de ahorro, y cero entrega.** Las dos son la misma noticia: el costo estaba atado al lugar
equivocado. La corrida anterior entregaba 1 video por 6 USD.

### 🩸 Los dos errores propios de esta sesión

1. **Se reportó un pool de 5.808 reels de trading contando el MISMO reel una vez por cada una de
   las 4 corridas del día.** Deduplicado son 2.400: **59 % de inflación**. No movió la conclusión
   (la relación entre medianas pasó de 12,6× a 11,5×) pero **sí envenenó la predicción**, que salió
   15-30 % alta y la corrida la dejó fuera de rango. *Un pool mal contado falla como un presupuesto
   que sobra, que es la dirección cómoda.* Invariante 7 de `costos.md`.
2. **Se verificó el cambio de knobs contra la fachada y no contra el eco del PATCH**, y ahí se
   descubrió que **la fachada devuelve 2 proyectos mientras la tabla tiene 15 con `activo = true`**:
   **13 proyectos no corren porque su voz está apagada**, y la pantalla no lo dice.

### Lo que queda abierto

- 🔴 **Bajar `min_views`** (recomendado: 100.000). Un knob, gratis, y es lo único que separa a
  Vieira de recibir videos.
- ✅ **El bug de la corrida que termina bien y no se cierra: ARREGLADO en el repo** (cierre 149,
  11/09). Centinela en `Gate de relevancia` + `Armar candidato`, ADR-094 §Enmienda.
  ⚠️ **Falta el `n8n:push`**: el arreglo existe en el repo y no en producción.
- ⛔ **Bake-off del actor barato SIN aprobar**: 3,4× más barato medido (0,00067 vs 0,0023 USD/reel)
  y trae `video_duration` —que falta en 149 de 150 filas de `videos_meta`— **pero devolvió 11 de
  los 25 pedidos**. Falta 2ª prueba con fecha ISO.
- Higiene que cuesta plata: el proyecto duplicado por la tilde, 3 cuentas que no devuelven nada,
  4 cuentas con mediana < 6.000, `app.tarifas` con 52 días sin actualizar.

---

## 🔒 CIERRE 147 (2026-09-10) — Se corrió la Tarea 9, y el candado que la protegía se estaba poniendo sobre videos que nadie midió

> **Todo commiteado y empujado.** Siete commits, de `a9dd839` a `8b8c9b5`, todos en `origin/main`.
> `n8n:push` del motor a las 19:43 UTC, `n8n:diff` verde en los 5. Working tree limpio.

La sesión arrancó para correr la **Tarea 9** (completar los 23 transcripts cortados que ya existían
en la base). Eso se hizo y cerró. Lo caro fue todo lo que apareció mientras.

### 1 · La Tarea 9, cerrada — y el dry-run que el plan documentaba no existía

Dry-run: **23**, el número que el plan pedía re-medir. Confirmado por dos caminos independientes
(consulta propia + el predicado del script). Verificado por efecto al terminar:
`origen = 'motor'` pasó de `{auto: 591}` a **`{generate: 7, auto_tras_generate: 16, auto: 568}`**.
Los 7 recuperados quedaron **todos a ≥0,99 de cobertura**, y uno venía de **0,04** — 1,0 s de 25,9 s,
un guion que era ruido.

🩸 **El Paso 1 del plan no se podía ejecutar.** `--completar --umbral 0.9` sin `--apply` moría con
`⛔ --completar necesita --apply` (exit 1). El plan lo documentaba como dry-run **desde que se
escribió**, así que *el único paso que existía para mirar antes de gastar era gastar*. Agregado:
lista las candidatas, cero llamadas a Supadata, cero escrituras.

### 2 · Tres mediciones para encontrar la causa, y las dos primeras hipótesis eran falsas

La primera corrida dio **CERO completadas**. Las dos hipótesis descartadas quedaron escritas en el
plan **antes** de caerse, porque las dos parecían ciertas:

| hipótesis | por qué se cayó |
|---|---|
| *"es la duración"* — los 23 se partieron **exacto** por duración (los 7 de ≤25,7 s contestaron, los 16 de ≥25,9 s no) | el mismo video de 76,5 s pedido **solo** contesta `200` con transcript |
| *"es el timeout de 90 s"* — subirlo a 240 destrabó 12 de 16 | un `generate` que contesta tarda **9 s y 13 s**. Los 90 s nunca apretaron a una llamada que iba a servir: lo que no cabía era el **`202`**, que tarda ~91 s en llegar |
| ✅ **es la CONCURRENCIA** | con `--concurrencia 1`, **3 de los 4 encolados contestaron el transcript** |

Entre esos 3 está **`Db9Y_EGulGk`** (`3962433134007046564`), el caso estrella de ADR-095 §1
—*"cortado, `generate` lo salva entero"*— que el plan daba por perdido esa misma tarde:
**41,5 s → 150,2 s de 150,4**.

### 3 · La fuga real: el `202` ponía un candado FALSO, y un candado falso no se distingue de uno bueno

[ADR-096](../adr/ADR-096-un-202-de-supadata-no-es-un-error-ni-un-transcript.md) se escribió el
**09/09** y decidió *documentar y esperar*. `auto_tras_generate` nació el **10/09** (ADR-095
§Enmienda 3). Al juntarse, el hallazgo dejó de ser "gasta créditos" y pasó a **corromper datos**:

`202` cae adentro de `res.ok`, así que llegaba a `modoResultante` como `gano = false`
—**indistinguible de "generate se probó y perdió"**— y el video quedaba marcado `auto_tras_generate`
**para siempre**. El candado que existe para no re-pagar lo ya medido terminaba puesto sobre lo
único que **nunca** se midió. **Ningún `count(*)` lo habría delatado.**

🔑 **El criterio correcto ya estaba escrito a cinco líneas de distancia**, en el `catch` de
`transcribirConReintento`: *"una caída de red no es un veredicto sobre el video"*. El `202` se le
colaba por adelante **porque no tira excepción**.

Arreglado en las **tres** copias, con la distinción que da todo el valor: un video **mudo**
(`transcript-unavailable`) sí es un veredicto y sí merece candado; un **encolado** no se midió nunca.
- `domain/cobertura.ts`: `esTranscriptEncolado(cuerpo, status)` + tabla `CASOS_ENCOLADO`, y
  `modoResultante` gana un tercer parámetro **sin default**, para que el compilador obligue a los
  call sites. El del nodo lo obliga `test-nodos.mjs`, que pinza los **cuatro** desenlaces.
- `lib/transcribir.ts`: el tipo `Transcripcion` gana `encolado` — exactamente lo que la §Toca de
  ADR-096 pedía, y por el motivo que decía.
- El nodo `Transcribir (Supadata)` y `medir-cobertura.mjs`.

### 4 · El polling: ADR-096 preguntaba dónde va, y la medición lo contestó sin diseñar a ciegas

Ciclo completo medido a mano sobre `3947142661160278921` (550,6 s), que se encola **aun estando
solo**:

| paso | medido |
|---|---|
| `POST …&mode=generate` → `202 {jobId}` | **93 s**, cuesta **2 créditos** |
| `GET /v1/transcript/{jobId}` | `active` … `completed` |
| los polls | **gratis** (`x-billable-requests: 0`) |
| el job entero | **326 s** |
| devolvió | **550,4 s de 550,6 = 1.00** (estaba en 0,46) |

🔑 **Ese 326 s ES la decisión.** No entra en una ruta con `maxDuration = 60` ni en un slot del pool
del motor sin comerse su presupuesto; entra sin problema en una herramienta de barrido que se corre
a mano. Así que el polling vive **sólo** en `medir-cobertura.mjs`, y **el nodo y el cockpit siguen
sin él a propósito**: ya no mienten (no marcan candado, lo dicen en el log) y lo que se les escapa lo
levanta el barrido.

⚠️ **NO verificado: `esperarJob` contra un `202` real.** La corrida que escribió esa fila contestó en
19 s **sin encolar**, porque Supadata cachea el ASR y la sonda ya lo había disparado. El mecanismo
está medido en la API; **la implementación no se ejercitó**. La señal para la próxima vez es la línea
`⏳ Supadata encoló (…)` en la salida.

### 5 · El timeout quedó con DOS números distintos, y el criterio no es la API

Es el presupuesto de **quien llama**:
- **`lib/transcribir.ts` → 25 s para `generate`** (90 s para `auto`, sin cambio). Esa ruta corre con
  `maxDuration = 60`: una llamada que pasa el minuto **no devuelve un guion, mata la función, deja la
  fila sin marcar y la pasada siguiente la vuelve a pagar**. Esperar más ahí no es paciencia, es
  gasto.
- **El nodo del motor queda en 90 s, a propósito.** No tiene techo duro y no hay medición que diga
  que esté mal; bajarlo sin datos abortaría `generate` legítimos bajo carga y se leería como *"el
  reintento no mejora nunca"*.
- `medir-cobertura.mjs` queda en 240 s y gana `--concurrencia`, que es la palanca de verdad.

### 6 · Verde, y con qué

553 tests · `typecheck` · `build` · `test-nodos.mjs` **314 checks** (era 313) ·
`auditar-workflows.mjs` sin hallazgos · `npm run validate` 2758 checks · `n8n:diff` verde en los 5,
antes y después del push.

### 7 · Lo que sigue, en orden

1. ⛔ **Nada que dispare una corrida**, hasta que se resuelva lo de Apify (prioridad #1 de Mani, en
   otra sesión).
2. ⏳ **Verificación humana #16** — la única que prueba que el deploy llegó a producción. No toca
   Apify.
3. ⏳ **Verificación humana #15** — el aviso, con IG **y** TikTok.
4. ⏳ **Tarea 11** (medir el motor) y el ejercicio real de `esperarJob`: los dos esperan a que haya
   corridas.
5. 🐛 El bug de la corrida que termina `success` y no se cierra, todavía sin diagnosticar.

**Skills para la próxima sesión:** `/diagnose` para el bug de la corrida que no se cierra;
`/grill-with-docs` antes de tocar el gasto de Apify, que es una decisión de producto disfrazada de
optimización.

## 🩸 CIERRE 146 (2026-09-10) — El reintento no vivía del lado equivocado: escribía su resultado a medias, y eso se re-pagaba en cada corrida

> **Todo commiteado, empujado y publicado.** `06acacd` (la fuga + Tarea 8) y `ab25c3f` (Tarea 10),
> los dos en `origin/main`. `n8n:push` del motor a las 19:14 UTC. Migración `042` aplicada por Mani.
> Cero working tree sucio.

La sesión arrancó para hacer la **Tarea 8** (llevar el reintento con `generate` al cockpit, porque
Majo pega los links ahí y el arreglo vivía sólo en el motor). Terminó siendo otra cosa.

### 1 · Lo que el handoff no sabía, medido al empezar

Siete cosas, ninguna citada del doc:

1. **Ya hubo dos corridas post-push del cierre 145** — execs **181** (16:05→16:41) y **182**
   (17:17→17:47). Escribieron 7 transcripciones con `cobertura_seg` y `duracion_seg`: el código nuevo
   corre. El handoff decía que nadie lo había ejercitado y eso venció el mismo día.
2. **Una de esas 7 es parcial**: `3841875677876678939`, 9,5 s de 10,75 s = **0,88**, bajo el umbral.
   Quedó en `modo = 'auto'`.
3. **Y no había forma de saber si el reintento disparó**, que es lo que destapó todo (§2).
4. **El check #2 de la Tarea 11 no puede funcionar**: `metricas.llamadas.supadata` es
   `_distinct($('Transcribir (Supadata)').all())` — videos distintos, **no llamadas** — así que su
   diferencia contra "videos transcritos" es **cero por construcción**. Leído del código, no deducido.
5. **Los cortados son 23, no 22.**
6. **El bug de exec 178 se movió**: la cerró la corrida siguiente como `fallo`, perdiendo sus métricas.
7. **La 182 dejó un aviso sin leer**: *"posible caida de Supadata: 80% de transcripciones vacias esta
   corrida"* (4 de 5). Es ADR-094 funcionando; nadie lo miró.

### 2 · La fuga: `modo` se escribía sólo cuando `generate` GANABA

Tres desenlaces distintos quedaban escritos `'auto'`: *nunca disparó*, *disparó y perdió*, *disparó y
se cayó*. El del medio es el caro, porque **dos lugares deciden re-pedir un transcript preguntando
por ese campo**: el filtro de caché del nodo (`rModo !== 'generate' && parcial` ⇒ re-pide) y
`medir-cobertura.mjs --completar` (`r.modo !== 'generate'`). O sea que un video donde `generate` ya se
probó y no alcanzó **vuelve a la cola en cada corrida, para siempre**.

🔑 **Y el comentario de `medir-cobertura.mjs` ya prometía protegerlo, con el caso por nombre:**

> *"el caso documentado como cortado e irrecuperable (`Day8CXdBLwK`) se re-pagaría para siempre"*

La intención estaba escrita **el día anterior**. Lo que faltaba era la línea que escribe la marca:
en `sinMejora` el script hace `return` sin escribir. **La `040` cerró la puerta sólo para los que
ganan.** Medido contra prod: **los 23 parciales están los 23 en `'auto'`** — cero candados puestos.

📌 **Tres señales independientes**, no una: el filtro del nodo, el `return` sin escribir de
`medir-cobertura.mjs`, y el propio comentario que documenta el caso que no protege.

### 3 · La decisión: un tercer valor, y el predicado en el dominio

[ADR-095 §Enmienda 3](../adr/ADR-095-un-transcript-cortado-no-puede-pasar-por-completo.md) +
[`042`](../../core/schema/042_modo_auto_tras_generate.sql) (sólo corrige el `comment`; `modo` es
`text` libre, sin migración de datos ni backfill).

`modo` = `auto | generate | **auto_tras_generate**`. El tercero es el candado: *el texto sigue siendo
el de `auto` (no se pisa nada) y el video no se vuelve a pedir*.

🔑 **El desenlace "se cayó" NO marca nada, a propósito.** Una caída de red no es un veredicto sobre el
video: merece otro intento. Marcarlo convertiría un timeout en una sentencia de irrecuperable.

`yaProboGenerate` / `debeReintentar` / `ganaElReintento` / `modoResultante` viven en
`apps/dashboard/domain/cobertura.ts`, los copia el nodo, y **`CASOS_REINTENTO` los pinza** igual que
`CASOS_COBERTURA` pinza al veredicto. `ganaElReintento` era la **TERCERA** copia de la misma
comparación (nodo + .ts + `medir-cobertura.mjs`) y es justo la que decide si se pisa un guion pagado.

### 4 · Y la Tarea 10 no era "consuelo": era el INTERRUPTOR de la Tarea 8

El plan decía que la 10 *"sólo sirve para que el aviso pueda dibujarse, que es consuelo y no
arreglo"*. **Es al revés**: sin duración no hay veredicto, y sin veredicto **no hay reintento**.
Medido antes de construir: de **275** transcripciones `listo` del cockpit, **150** tenían fila en
`app.videos_meta` y **1** tenía `duracion_seg` ⇒ el reintento nuevo habría disparado para **1 video
de 275**. Y las que faltaban **son los videos de Majo**, no videos ajenos.

Se corrió, con [`backfill-duraciones-meta.mjs`](../../Workflows/workflow-short-form-content/backfill-duraciones-meta.mjs):

- `app.videos_meta`: **de 1 a 179 de 183** con duración. **El `count(*)` TOTAL no se movió de 183** —
  esa es la señal que prueba merge por PK y no inserción.
- Costo real **$0,35** (cupo 25,39 → 25,74), clavado en la estimación de $0,34.
- **4 quedaron sin duración y NO es un bug del script**: Apify devuelve el post (`type: "Video"`, id
  correcto) **sin el campo `videoDuration`**. Medido pidiendo una sola.

🩸 **Y llenar `videos_meta` NO alcanzaba: hay DOS tablas.** `fila.tsx` deriva el veredicto de
`t.duracion_seg` de **la fila de `app.transcripciones`**, que se copia al transcribir. Las 32
transcritas hoy quedaron con `null` y no se curaban solas. El paso `--filas` las copió **sin tocar
Apify**, y ahí apareció lo único visible de toda la sesión: **un guion cortado de verdad**,
`3791690130135350581`, **19,2 s de 64,2 s = 0,30**, que hasta hoy se leía sin aviso.

### 5 · Un número que se movió DOS veces dentro de la misma sesión

`app.videos_meta` pasó de **150 filas a 183** mientras se medía: **Mani** (`4698ac74`) estaba usando
el cockpit en ese momento — 39 links pegados a las 18:59, 6 abandonados, una colección de 33 creada y
enriquecida a las 19:02, y eso escribió 32 duraciones. **No es adopción: es él mismo.**
✅ **Adopción real del día: Dani Rodríguez** (`22981a69`), `colecciones.limpiar` ×2 y
`colecciones.quitar` a las 18:09–18:19. *Un canario se re-mide, no se cita — y éste se movió mientras
se escribía el renglón que lo citaba.*

### 6 · Verde, y con qué

544 tests + `typecheck` + `build` del cockpit · **313 checks** de `test-nodos.mjs` · `auditar-workflows.mjs`
sin hallazgos · `validate` con 2749 checks · `n8n:diff` verde en los 5 · el nodo leído del live por la
API trae `yaProboGenerate`, `auto_tras_generate`, el filtro nuevo y `modoResultante`, con
**`placeholder literal: false`**.

⚠️ **Un test viejo afirmaba la fuga** (`_tx_modo === 'auto'` cuando el reintento pierde) y hubo que
corregirlo: estaba escrito para el comportamiento que había, no para el correcto.

### 7 · Lo que sigue, en orden

1. **Tarea 9** — los 23 cortados. Desbloqueada: el motor ya lee el candado. Es la única con vencimiento.
2. **Tarea 11** — mirar la primera corrida post-push (no hubo ninguna todavía), con el check #2 tachado.
3. **Las dos verificaciones humanas de un minuto** (la `042` en el catálogo, el aviso en la pantalla).
4. **Diagnosticar** la corrida que termina bien y no se cierra sola.

**Skills sugeridas para la próxima:** `/diagnose` para el bug de la corrida que no se cierra;
`/tdd` si se toca el contador de reintentos que hoy no existe.

## 🚀 CIERRE 145 (2026-09-10) — Se publicó el arreglo de ADR-095, y publicarlo mostró que no es un arreglo sino dos

> **Todo commiteado y en el live.** `045bc07` (la `041`), `25a38fc` (su verificación) y el
> `n8n:push` de los 4 nodos. Cero working tree sucio.

Mani aplicó la `040` y pidió tres verificaciones. Las tres se hicieron contra prod, ejercitando el
**código real** (`lib/apify.ts`, `lib/videos.ts`, `lib/transcribir.ts` importados tal cual con un
resolve hook, no reimplementados).

### Las tres verificaciones

1. **La duración llega a `app.videos_meta`** ✅ — `traerMetadata` + `guardarMeta` sobre un video que
   **ya estaba** en la tabla, para que fuera merge y no fila nueva: `duracion_seg: 29.375`, total
   **150 → 150**, 1 de 150 con duración. ⚠️ Pero *"una colección muestra la duración"* **es falso**:
   ninguna pantalla la dibuja (`grep duracion` en `app/` da sólo el aviso de Transcribir y
   `duracionLegible`, que es la duración de una *corrida*). La duración es insumo del veredicto, no UI.
2. **Transcribir con TikTok** ✅ y ❌ a la vez — el transcript anda igual de bien que en Instagram
   (17.1 s de 17 s · 60.3 s de 61 s, con la duración comprada al actor de TikTok que ya usa el motor),
   pero el **aviso no puede existir**: medido, `traerMetadata` de un TikTok manda la URL al scraper de
   Instagram, vuelve **400** y devuelve `[]` con un `console.error` que no lee nadie. Confirma ADR-095
   §3.6 y le agrega el **cómo** falla. *Lo roto en TikTok no es transcribir, es enterarse.*
3. **El canario `modo = 'generate'`** ✅ da **0**, sin contaminar (no se insertó ninguna fila de
   prueba). Pero cero **no** es "no hay nada que reintentar": de las **584** filas del motor con
   cobertura —que las escribió el **backfill** de la Tarea 3, no el motor— **22 son parciales al 0.9
   (3,8%)**.

### La `041`, que Mani pidió revisar antes de hacerla

`revoke execute on function app.cache_transcripts(uuid, text[]) from public`. Se revisó **antes** de
escribirla y el archivo dice con números que **hoy no tapa ningún agujero**: `anon` rebota con
`42501 permission denied for schema app` en la puerta del **schema**, dos metros antes de la función,
y la RPC es `security invoker`, así que las policies de la `021` filtrarían igual. Lo que arregla es
el **default** de Postgres (`EXECUTE` a `PUBLIC` en cada función nueva). Aplicada y verificada en el
catálogo: **`anon = false · authenticated = true · service_role = true`**.
🔑 **Es la única migración de la serie que NO se puede verificar por su efecto desde afuera**: la
respuesta de PostgREST es idéntica antes y después. Está escrito en el archivo para que nadie pierda
media hora buscando el cambio en un `curl`.

### El push, con sus dos señales

`test-nodos.mjs` verde y `auditar-workflows.mjs` sin hallazgos **antes**. Después, además del
`n8n:diff` verde, se leyó el nodo del live por la API: `23624b · placeholder literal: False ·
r.modo: True · cobertura: True · generate: True`. Ese `placeholder literal: False` no es adorno: la
key de Supadata se resolvió desde el `.env` y no del live (el script lo avisó), y un
`<SUPADATA_API_KEY>` sin resolver es exactamente lo que tumbó al error handler dos veces.

### 🔴 Bug encontrado de paso, sin diagnosticar: una corrida que terminó OK y no se cerró

**exec 178 terminó `success` en n8n a las 15:07:45 y su fila en `runs` sigue `en_curso` con `fin` en
`null`.** Dos consecuencias: esa corrida **perdió sus métricas** (no hay `aprobados / N pedido` para
ella, que es el norte de ADR-089), y el `Guard single-flight` bloqueó cualquier corrida del motor
hasta las 15:46 UTC, porque lee corridas vivas de los últimos `ventana_corrida_min = 60`. La ventana
ya pasó, así que **no bloquea más** y por eso no es urgente. Es la familia de ADR-094 al revés:
aquella cierra las que **mueren**, ésta terminó **bien** y no se cerró.

### 💰 El cupo, otra vez

De **2,84 a 13,43 de 50 USD en tres horas**, y casi todo son las **tres** corridas del motor de hoy
(execs 176, 177, 178: ~$0,345 por referente, `origin: API` las 20 corridas de Apify revisadas). Las
verificaciones de esta sesión costaron ~**$0,07**. A ese ritmo el ciclo no llega al 09/10. *El cupo
no es un estado, es un saldo.*


## Tablero activo — refactor Voces→Proyectos

Vive en [refactor-voces-proyectos.md](./refactor-voces-proyectos.md) §4–§5 (componentes A–E). *Acá
había un espejo de esa tabla, de la era Airtable; se archivó porque un tablero duplicado envejece
en silencio.*

## Log de avance (más reciente arriba)

**2026-09-10 (cierre 145) — Publicar el arreglo mostró que era dos arreglos, y sólo se publicó uno (Claude, con Mani).**

**Qué se hizo:** las 3 verificaciones de ADR-095 contra prod ejercitando el código real, la `041`
(revisada antes de escribirla, aplicada y verificada en el catálogo), y el `n8n:push` de los 4 nodos
del motor al live. Detalle arriba, en §CIERRE 145.

**Lo que hay que saber antes de tocar nada:** el reintento con `generate` es **del motor**; el
cockpit avisa y no reintenta, así que Majo —que reportó el problema desde la pestaña Transcribir—
recibe el aviso y el guion cortado. Y el aviso casi no puede dibujarse: 1 de 150 filas de
`videos_meta` tiene duración, y las otras 149 no se curan solas. Escrito en ADR-095 §Enmienda 2 y
descompuesto en las **Tareas 8–11** de `plan-transcript-completo.md`.

**Qué sigue:** Tarea 8 (el reintento en el cockpit) es la única que le cambia algo al equipo; la
Tarea 9 (los 22 ya cortados, `medir-cobertura.mjs --completar`) es la única con vencimiento, porque
11 de esos 22 ya están en `candidatos` y 12 en `processed_items` y el dedup no los va a traer de
nuevo. Antes de todo eso: la Tarea 11, que es mirar la primera corrida nueva.

**Skills sugeridos para la próxima sesión:** `/tdd` para la Tarea 8 (el paso 1 ya está escrito como
test que falla), `/diagnose` para el run 178 que no cerró.


**2026-09-09 — La cola de Transcribir la vacía el navegador, no el servidor (Claude, con Mani).**

**Qué se encontró:** Mani preguntó si una tanda de ~100 videos pegados en Transcribir estaba
procesándose o stale. `apps/dashboard/app/[cliente]/[pipeline]/(zonas)/transcribir/procesador.tsx`
es un `useEffect` client-side: mientras `pendientes > 0` llama a la server action
`procesarPendientes` en loop, y se corta apenas se cierra o cambia esa pestaña. No hay nada corriendo
en background — "stale" o "procesando" dependen literalmente de si alguien tiene esa pantalla abierta
en ese momento, y no hay ninguna señal en la UI que lo diga.

**Medido contra prod** (`app.transcripciones`, 09/09 23:44 UTC): la tanda pegada a las 23:22 (99
videos) tenía 51 pendientes, con el último `procesado_en` de hace 10 segundos — avanzaba porque
alguien tenía la pestaña abierta en ese momento, pura coincidencia de timing.

**Propuesta, sin decidir:** mover el drenado a servidor (cron de Vercel repitiendo
`procesarPendientes`, o delegarlo al motor de n8n, que ya tiene pool + presupuesto para Supadata) para
que no dependa de una pestaña abierta. No es un one-liner: hay que resolver el reclamo doble sobre
`procesado_en` si dos triggers corren a la vez (hoy el reclamo asume una sola pasada a la vez). Si se
decide, termina en ADR.

**2026-08-31 (cierre 129) — El Gate bajó 5.8x con más carga, y las cuatro entregaron completo por primera vez (Claude, con Mani).**

**Qué se hizo:** se empujó el cierre 128, se subió *Resultados por cuenta de referente* de **50 a 150**
y se corrió la corrida de fuego (**ejecución 156**, 29m20s, `ok`). Después, dos arreglos que salieron
de mirar sus números: la métrica que yo mismo había roto y el contador que faltaba para poder subir la
concurrencia. También se mergeó a `main` la sesión del worktree (`f6e2065`, ADR-053 §Enmienda 2).

**📏 El resultado, medido:**

| | ejecución 150 | ejecución 156 |
|---|---|---|
| **Gate** | **492.7 s** en 26 chunks | **85.6 s** en **36** |
| por chunk | 18.95 s | **2.38 s** ⇒ **7.97×** = la concurrencia exacta |
| colectados | 520 | **1.088** |
| entregados | 74/80 | **80/80, las 4 con `razon_faltante: null`** |
| `gate_sin_presupuesto` · `pretrim_sin_juicio` · `avisos` | — | **0 · 0 · vacío** |

**🩸 Y quedó probado que el pre-trim viejo estaba roto, con dos corridas del mismo día y el mismo
input:** la de las 13:00 (código viejo) descartó **0 de 1.773**; la de las 14:10 (chunks) descartó
**666 de 1.773 (38%)**, con 0 chunks fallidos. *Los "dos proyectos que descartaron 0 sobre 465 videos"
no eran temas limpios: era la llamada rompiéndose y el `catch` tragándosela.*

**Dos arreglos posteriores:**
1. **`haiku_lotes_pretrim` informaba 4 llamadas y la corrida hizo ~38** — el contador decía *"un lote
   por proyecto"*, cierto hasta que se chunkeó. *Un cambio de forma que no arrastra su métrica deja un
   número que sigue pareciendo correcto.*
2. **`concurrencia_transcribir` 8 → 12, pero midiendo primero.** ADR-030 §Enmienda ya decía *"subila
   midiendo los 429"*, y al ir a hacerlo apareció que **ese número no existía**. Lo que sí se pudo
   medir: las 24 vacías de la 156 fueron **24 sin-voz definitivos, cero perdidas por límite** (se
   separan gracias al `_tx_resuelta` de ADR-084). 🔑 **Pero *"0 perdidos"* no es *"0 rate limiting"*:
   un 429 que el backoff recupera sale con guion y no aparece en ningún número.** Ahora se cuenta
   (`_tx_429` → `metricas.rechazos_supadata`), distinguiendo un 429 de un timeout de red.

**🐛 Bug destapado, pre-existente:** una corrida que legítimamente no encuentra nada nuevo **no cierra
y termina registrada como `fallo`**. `Heat-score v1` devuelve 0 ⇒ `Resumen del run` y `Cerrar run`
nunca corren ⇒ el barredor la marca a los 60 min, mientras en n8n figura `success`. Le pasó a la
ejecución 155. En el tablero.

**🩸 Y subir a 12 así nomás habría sido un 429 auto-infligido — lo cazó Mani preguntando.** El pool
hacía `Promise.all(Array.from({length: N}, _worker))`: **los N workers arrancan en el mismo tick**, o
sea N pedidos en el mismo milisegundo, contra un plan de **10 req/s**. A 8 la ráfaga inicial entraba
(8 < 10); a 12 no. *La concurrencia estaba topada por el ARRANQUE, no por el trabajo* — en régimen
son 0,62 req/s a 12 en vuelo. Con `arranque_transcribir_ms` (120 ms entre workers) **la concurrencia
queda desacoplada del rate limit**, que era el techo real que nadie había nombrado.

**✅ Empujado y verificado en el live** (Mani, 31/08): `concurrencia_transcribir` 12,
`arranque_transcribir_ms` 120, el contador de 429 y la métrica corregida, leídos directo de la API.
`n8n:diff` verde en los 5.

**Qué sigue:** correr una vez a concurrencia 12 y **leer `rechazos_supadata` antes de tocar el
volumen otra vez** — si sale 0 hay aire para seguir subiendo, si sale distinto de 0 ése es el techo. El
margen está en 3%: 288 videos en 695,5 s ⇒ el presupuesto de 870 s da para ~360 contra un cap de 350,
y **el presupuesto no puede subir porque 870 s ya roza el watchdog de 900**.

**2026-08-31 (cierre 129) — El diff dejaba pasar un cambio sin empujar en el mismo balde que el ruido de n8n (Claude, con Mani).**

**Qué se hizo:** el punto ciego que el cierre 128 dejó anotado, cerrado como
[ADR-053 §Enmienda 2](../adr/ADR-053-el-repo-es-la-forma-el-live-es-el-estado.md). El balde benigno de
`n8n:diff` se llamaba *"defaults de n8n, **o cambios sin empujar**"* y esa `o` era el bug: la regla
era **estructural** (`live ⊆ repo`), así que cualquier campo que el repo agregara y nadie empujara
salía junto a `method`, con el comando cerrando en verde. Ahora lo benigno se decide por **clave +
VALOR** contra una lista cerrada de 6 pares (`DEFAULTS_N8N`), **lo que no está en ella grita**, y cae
en un balde propio y accionable: `sin-empujar`.

**🩸 El diagnóstico del 128 se quedó corto: el balde tenía DOS puertas, y la segunda era la de la
paginación.** Además del campo ausente en el live, `clasificar` tenía `subconjunto(enLive, enRepo)` —
el repo declara *más* **dentro del mismo campo**, que es exactamente `options: {timeout, pagination}`
contra `options: {timeout}`. 📏 Medida sobre los 5 workflows: esa rama clasificaba **0 campos**. No
callaba ruido; esperaba a un campo anidado para callarlo. *Una regla que hoy no silencia nada no está
inactiva: está sin estrenar.*

**🔑 Por qué clave + VALOR y no una lista de nombres**, que era la opción obvia y más corta: los
nombres reproducen el mismo fallo un escalón abajo. Un `method: 'POST'` sin empujar, contra un live
sin `method` (o sea corriendo GET), sería *"benigno"* por llamarse `method`. El par cuesta lo mismo.

**📏 Un dato medido que no era obvio y ordena la tabla:** que un default sobreviva en el live **no
depende de su semántica sino de cómo se guardó el nodo por última vez** — un `PUT` escribe exacto lo
que le mandamos, un save del editor poda. Por eso `Leer feed vivo` (empujado) **sí** tiene
`method: GET` en el live y `Leer señal selección` (editado a mano) no, siendo los dos `httpRequest`.

**Descartado, con su porqué:** (a) **recursión en las subclaves de `options`** — no cambia **ni un
veredicto**, con la tabla un `options` con contenido ya sale accionable; solo afinaba el mensaje, y
para eso alcanzó pegarle la frase. (b) **ensanchar `drift`** — el remedio es el mismo `push`, pero
`drift` está *definido* en tres docs como *"los dos lados tienen valor y difieren"*, y agregar una
palabra sale más barato que redefinir una que otros citan.

**Verificación (dos señales, no una):** `n8n:diff` y `-- --todo` contra los 5 reales salen
**idénticos campo por campo** a antes del cambio (24 benignos, 0 accionables, verde) ⇒ **cero falsas
alarmas nuevas**. Y el bug **reproducido contra el motor real en solo lectura**, corriendo los dos
clasificadores sobre el mismo input mutado (`options.pagination` agregada en el repo a
`Leer señal selección`, que el live no tiene): el **viejo** cerró en `✓ motor corre lo que dice el
repo` con el contador pasando de 10 a 11 benignos —ahí se escondía—; el **nuevo** lo saca en rojo.
`n8n:test` **42 ok · 0 fallidos** (38 + 4 nuevos, que cubren las dos puertas *y* el ruido en la misma
pasada). Validador 2533/0.

**Gotchas para el próximo:**
- ⚠️ **Un test que busque `sin-empujar` suelto da falso rojo:** el pie de ayuda del propio `diff` la
  nombra siempre (*"Las de [drift] y [sin-empujar] se aplican con push"*). Se busca por el campo, no
  por la palabra. Me lo comí escribiéndolo y quedó anotado en el test.
- 🩸 **Este cierre se perdió entero una vez:** el worktree se recicló con el trabajo sin commitear.
  Se pudo replayear porque los cambios se habían hecho con scripts de parcheo en `/tmp` y no a mano.
  *En un worktree, commitear temprano es la red — el árbol de trabajo no es almacenamiento.*
- 📌 **Deuda de doc que NO toqué** (pre-existente, no la creó este cierre): `CLAUDE.md` y el índice
  dicen **"ADRs 001–083"** y ya existe la **084**. Un renglón, pero es el índice.

**Toca:** `core/scripts/n8n-sync.mjs` (solo `diff`; **sigue siendo solo lectura**), su test,
ADR-053, ADR-029, `CLAUDE.md`, índice de ADRs. Sin migración, sin cambios en los `workflow.json`,
sin tocar el live. De paso se corrigió el renglón de ADR-053 en el índice, que seguía diciendo *"el
re-import completo sigue siendo el camino para cambios de topología"* — falso desde su §Enmienda del
30/08.

**Qué sigue:** sin cambios respecto del 128 — (1) la corrida de fuego que mide si el Gate bajó, (2)
deployar el dashboard (cierres 123/126/127 sin pushear). Para la próxima sesión: `/tdd` si se
retoma construcción, `/diagnose` si la corrida de fuego sale rara.


**2026-08-31 (cierre 128) — Los dos pasos que faltaban para subir volumen, y los dos fallaban callados (Claude, con Mani).**

**Qué se hizo:** los pasos 3 y 4 del plan del cierre 127 —
[ADR-044 §Enmienda](../adr/ADR-044-todo-nodo-caro-tiene-presupuesto.md) (el pre-trim) y
[ADR-029 §Enmienda 2](../adr/ADR-029-dedup-blindado-fail-closed-y-feed.md) (`Leer feed vivo` pagina)—.
**152 checks** de `test-nodos.mjs`, auditor sin hallazgos, validador verde. ⚠️ **En el repo, todavía
sin empujar** (el push del 127 fue antes de esto).

**📏 El pre-trim, medido contando los items reales de la ejecución 150** (no estimado): mandaba UNA
llamada por proyecto con TODOS sus captions — **465 videos = ~40k tokens de prompt** — y tenía
`max_tokens: 1000` para la lista de ids a descartar, de los que **el peor proyecto ya usaba el 47%**.
A 2× está en 94%, a 4× trunca, a 5× el prompt se pasa de la ventana. Ahora va en chunks de 100 con
pool cross-proyecto y `max_tokens` 2.000.

**🩸 Y el hallazgo salió de mirar los números, no el código: en esa misma ejecución DOS proyectos de
465 videos descartaron CERO.** No había manera de saber si el tema estaba limpio o si la llamada se
había roto — el código trataba *"no había nada off-topic"* y *"no pude mirar"* exactamente igual, los
dos hacían nada. Un JSON truncado tampoco falla: no matchea el regex, el `catch` se lo traga y el
nodo deja de filtrar en silencio. **Un fail-open sin contador es un fail-open invisible**, y ahora
los dos tienen el suyo: `metricas.pretrim_sin_juicio` y `metricas.gate_sin_presupuesto`, cada uno con
aviso.

**🔑 El feed vivo pagina, y el guard convive con su fail-open porque son dos eventos distintos:** un
servicio **caído** devuelve 0 filas o revienta ⇒ fail-open, la corrida sigue (que es lo que ADR-029
eligió); una **paginación rota** devuelve exactamente 1.000 = una página ⇒ aborta, porque ahí el
motor está ciego y no lo sabe. Por eso el `try/catch` envuelve solo la lectura y el guard va afuera:
adentro, el `throw` habría caído en el propio `catch` que lo tenía que dejar pasar.

**🩸 Y una corrección a Mani que vale anotar: subir `cap_resultados_referente` a 500 NO subió el
volumen.** Preguntó *"ya no es 50 por cuenta, lo subimos a 500 no?"* y la respuesta es no: 500 es el
**techo** en `Config`, y el **pedido** es el ajuste *"Resultados por cuenta de referente"*, que sigue
en **50** (medido contra prod). Antes los dos eran 50, o sea pegado al techo sin poder pasarlo; ahora
el techo está lejos y el pedido no se movió. *Un límite repartido entre dos dueños confunde también a
quien lo mueve, no solo al que lo lee.*

**⚠️ Punto ciego nuevo, y es del tooling:** `n8n:diff` clasificó `"Leer feed vivo" · options` —donde
vive la paginación que acabo de agregar— en el balde **benigno**, junto a `method` y `resource`. O
sea que **un nodo HTTP puede quedarse sin paginación con el diff en verde**. Que este cambio sí llega
se verificó por el precedente, leyendo el live: `Leer procesados` tiene su `pagination` desde el
cierre 125, empujada por el mismo mecanismo. El balde merece su propia sesión (hay chip).
✅ **Cerrado en el cierre 129, el mismo día** — ADR-053 §Enmienda 2. Y el diagnóstico de arriba se
quedó corto en una cosa: el balde tenía **dos** puertas, no una, y la segunda era justo la de la
paginación.

**Qué sigue, en orden:** (1) empujar el cierre 128 al live —`Config`, `Pre-trim relevancia`, `Leer
feed vivo`, `Heat-score v1`, `Resumen del run`, solo `--nodos`, sin topología—; (2) la corrida de
fuego con sus tres números (el Gate de 492.7 s ⇒ ~60, `gate_sin_presupuesto` en 0, `processed_items`
creciendo menos); (3) recién ahí el clic de Mani en Ajustes, **un escalón por vez**.

**Skills para la próxima:** `/diagnose` si la corrida de fuego no baja el Gate.

**2026-08-31 (cierre 127) — Transcribir dejó de ser el que descarta, y el Gate dejó de ser el que mata la corrida (Claude, con Mani).**

**Qué se hizo:** los pasos 0, 1 y 2 del plan que salió de una pregunta de Mani —*"¿hay un cap de
videos por corrida? ¿les decimos a los de redes que separen los proyectos en dos tandas?"*—.
[ADR-084](../adr/ADR-084-la-memoria-guarda-lo-resuelto-no-lo-intentado.md) nueva, más §Enmienda en
[ADR-016](../adr/ADR-016-knobs-de-ejecucion-globales-y-tope-de-costo.md) y
[ADR-044](../adr/ADR-044-todo-nodo-caro-tiene-presupuesto.md). **Empujado al live y verificado ahí**
(`n8n:diff` verde en los 5, más una lectura directa de la API que confirma topología, los 8
marcadores del código y el Config). **Sin migración, sin schema, sin `core/`** salvo una línea de
`n8n-sync.mjs`. 134 checks de `test-nodos.mjs`, auditor sin hallazgos, 2.533 del validador, 38 de
`n8n:test`.

**📏 La respuesta a la pregunta de Mani es NO, y la dan dos corridas reales de la misma semana:** con
**10 proyectos** prendidos (30/08 22:50) colectó 524 y entregó **18 de 100**; con **4** (31/08 00:56)
colectó 520 y entregó **74 de 80**. Los 10 comparten las mismas ~11 cuentas, y **la colecta es por
cuenta de referente, no por proyecto** ⇒ prender más proyectos no trae un video más, parte los mismos
en más pedazos y encarece el pre-trim. Separar en dos tandas es peor: la segunda re-scrapea las mismas
cuentas (Apify completo de nuevo) y encuentra casi todo ya quemado. **La regla para redes es una
frase: prender un proyecto que no trae cuentas propias no suma videos, reparte los que ya hay.**

**🩸 Y el tope que sí importaba no era ninguno de los que Mani sospechaba.** `cap_top_n` (350) **nunca
mordió** —las últimas 5 corridas transcribieron 90, 164, 27, 51 y 250—. Lo que estaba a punto de
matar todo era el **Gate**: leídos los tiempos por nodo de la ejecución 150 por la API de n8n, fue el
**nodo más lento de la corrida con 492.7 s** (Apify 456.8, Transcribir 239.0), serial y sin
presupuesto, contra un watchdog de 900 s ⇒ **1.8× de margen**. *La intuición apuntaba a transcribir
porque es el que se paga; el que se muere es el que nadie cronometró.*

**Los tres cambios:**
1. **El tope de resultados por cuenta avisa** (ADR-016 §Enmienda). Era mudo: escribir 200 en la
   pantalla guardaba 200 y el motor usaba 50, sin un log. Medido: el ajuste vivo estaba en **50** y el
   tope en **50**, o sea el equipo apoyado contra el techo sin saberlo. `cap_resultados_referente` pasa
   de 50 a **500** — de techo de operación a red contra un 5000 de dedo (~USD 137 de Apify).
2. **`processed_items` guarda lo resuelto, no lo intentado** (ADR-084). El POST corría **antes** de
   `Transcribir`: marcaba "ya visto" lo que nadie había mirado. La del 26/08 perdió así **144 de 250
   (58%)**. Ahora `_tx_resuelta` separa "Supadata contestó" de "no llegué a preguntar" y **el
   presupuesto posterga en vez de quemar**.
3. **Pool + presupuesto en el Gate** (ADR-044 §Enmienda), cross-proyecto, sin el `sleep(1000)`.

**🔒 Dos redes ajenas atajaron errores míos, y las dos valen más que el código que escribí.**
`auditar-workflows.mjs` rechazó la primera versión —el registro colgado como **rama hermana** dejaba a
`$('POST processed_items')` sin ser ancestro de `Resumen del run`, o sea la verificación de la memoria
leyendo un nodo que puede no haber corrido, *la misma clase de bug que dejó el dedup de ADR-029 sin
efecto 3 corridas*—; se rehízo en cadena. Y el `--borrar` de `n8n:push` frenó el push hasta que se
nombraron los 3 nodos que cambian su cableado de salida.

**🩸 `n8n:diff` cerraba diciendo *"[topologia] NO va por push: re-import (ADR-053)"*, y es falso desde
el 30/08** (ADR-053 §Enmienda le dio topología al push). *La herramienta mandaba al ritual que ella
misma había matado.* Corregido. **Un obstáculo escrito se re-mide, y el peor lugar donde envejece es
en la salida del comando que lo desmiente.**

**Además:** los dos botones de Operar se renombraron a *▶ Buscar contenido* y *▶ Buscar referentes*
(con `WORKFLOW_LEGIBLE` y el aviso de Sugeridos alineados, que citaban los nombres viejos). 484 tests
del dashboard verdes. ⚠️ **Sin deployar**, se suma a lo que ya esperaba del cierre 126.

**Qué sigue:** **una corrida de fuego, y mirar tres números antes de subir nada** — el Gate (492.7 s
⇒ debería caer a ~60), `metricas.gate_sin_presupuesto` (tiene que dar **0**) y que `processed_items`
crezca **menos** por corrida (esa es la señal de que ADR-084 anda; la contracara es que algunos
videos vuelvan, y eso es lo buscado, no un dedup roto). Recién con eso, subir *Resultados por cuenta
de referente* **un escalón por vez**. Después quedan los pasos 3 y 4 del plan, los dos silenciosos:
**chunkear el pre-trim** (hoy es 1 llamada por proyecto con TODOS sus captions y `max_tokens: 1000`
para la respuesta ⇒ a más volumen la lista de ids no entra, el JSON sale truncado y el fail-open no
descarta nada) y **paginar `Leer feed vivo`** (sin paginación contra el `max-rows` de 1.000 de
PostgREST — la advertencia que ADR-029 §Enmienda dejó escrita, hoy en 274 filas).

**Skills para la próxima:** `/diagnose` si la corrida de fuego no baja el Gate; `/tdd` para los pasos
3 y 4 (los dos tienen su harness ya montado en `test-nodos.mjs`).

**2026-08-31 (cierre 126) — Las corridas dejan de ser una línea, y el feed se puede leer por corrida (Claude, con Mani).**

**Qué se hizo:** [ADR-083](../adr/ADR-083-una-corrida-cuenta-lo-que-anoto-no-lo-que-hizo.md) — la
pantalla `operar/corridas` con 4 tabs, master/detail y lenguaje del equipo — y la
[enmienda de ADR-081](../adr/ADR-081-el-candidato-sabe-de-que-corrida-salio.md#enmienda-2026-08-31--filtrar-por-corrida-no-es-agruparlas-van-las-dos)
— el toggle *Agrupar por corrida* en el Feed. **Cero migraciones, cero n8n, cero `core/`.** 484 tests
verdes, `tsc` y `build` limpios, y las dos features vistas andar en el navegador contra la base de
producción.

**🩸 El hallazgo que reencuadra el pedido: una corrida `ok` ya registra muchísimo y una `fallo` no
registra NADA.** Mani pidió la pantalla porque *"si falló no te dice en qué nodo"*. Medido contra
prod: **las 12 corridas fallidas tienen `metricas` en NULL, las 12** — `Resumen del run` es el
último nodo del motor, así que morir antes es no anotar ni un contador. Al mismo tiempo, la corrida
`ok` del 31/08 traía el embudo completo, `por_proyecto` con el diagnóstico ya calculado y
`por_referente` handle por handle, **y la card dibujaba un solo número** (`outputs`). O sea: para
las que salen bien el problema era la pantalla; para las que fallan, el registro. *La pantalla no
puede mostrar lo que nadie guardó.*

**🔑 Y la razón por la que el embudo "se veía de dev" no era el vocabulario: eran las unidades.**
`colectados` cuenta **videos** y `pretrim`/`gate` cuentan **video × proyecto**, por eso `1.682` sale
de `520` sin que nadie haya bajado más videos. Eso no se arregla con mejores palabras: se arregla
poniendo primero el **por-proyecto** —la única vista dedupeada por `external_id`, o sea donde los
números se pueden restar sin mentir— y dejando el embudo global abajo **diciendo la unidad de cada
paso**. La primera versión del diseño no lo veía; salió de que Mani dijera *"no es fácil que los de
redes entiendan"*.

**🩸 Una carta del boceto tenía números inventados, y la encontró la medición y no la relectura.**
El mockup del fallo mostraba un bloque *"alcanzó a hacer: bajó 520, escuchó 112"*. Esos números **no
existen** — es el mismo `metricas` NULL de arriba. Lo que queda en la pantalla real es contar las
filas que la corrida sí escribió (`candidatos.run_id`, ADR-081), que dice *"quedan N de esa
corrida"* y no *"entregó N"*, porque un candidato archivado se borra (ADR-036).

**🩸 Instalé `@anthropic-ai/sdk` y hubo que revertirlo: el repo ya tenía la convención escrita.**
`lib/limpiar.ts` la declara como invariante — *"fetch a mano sin SDK, los 7 call-sites del sistema
arman el suyo"*. El SDK habría dejado dos formas de llamar a la misma API en el mismo repo, más una
dependencia en el deploy. `lib/ia.ts` quedó con `fetch` + `x-api-key` + `anthropic-version`, igual
que `limpiar` y `traducir`. *El modelo sí es distinto a propósito (`claude-opus-5` contra
`claude-haiku-4-5`): aquéllos transforman un texto ya escrito, esto lee un embudo y lo cruza contra
tres corridas.* **Verificado con una llamada real antes de escribir el código**, no asumido: 97
tokens de entrada, 331 de salida ⇒ **~US$ 0,009 por corrida**, una sola vez en su vida.

**🟢 El veredicto de la IA se generó, se guardó y se releyó sin pisar el embudo.** Es el riesgo real
del diseño (guardar en `metricas.veredicto_ia` es un read-modify-write sobre el jsonb que escribe
n8n), así que se verificó contra prod: después de guardar, `outputs 32`, `colectados 520` y los 4
proyectos siguen ahí. Por eso además **solo se le pide veredicto a una corrida cerrada**: con la
corrida viva hay otro escritor.

**🔒 El link a n8n se gatea por rol, no se borra.** Mani: *"los de redes no tienen acceso"*. Va
detrás de `veCostos` (`dev`) y **el gate vive en el servidor**: decidirlo en el JSX habría mandado la
URL al browser de todo el equipo igual. ⚠️ Para una corrida `ok` necesita `N8N_BASE_URL` +
`N8N_WF_<MÁQUINA>` en Vercel (hoy solo están en el `.env` de la raíz), así que **en prod arranca
apagado**; el del fallo funciona sin configurar nada porque el error handler lo escribe pegado al
mensaje.

**🩸 Tres cosas que solo se vieron con datos reales, no en el diseño:** *"1 guiones"*, *"1 enlaces"*
y que el transcriptor decía **"manual (n8n)"** cuando no corre en n8n (corre en el cockpit, ADR-062).
Las tres arregladas y clavadas en tests. *`DISPARO_LEGIBLE` nació cuando toda corrida era de n8n; la
pantalla nueva fue la primera en mostrarlo al lado de una máquina que no lo es.*

**📌 Del feed: el toggle nace correcto y casi vacío, y está medido.** 242 de 274 candidatos vivos
(88%) no tienen `run_id` porque ADR-081 entró sin backfill, así que hoy el modo muestra un grupo real
y un cajón *Sin corrida* enorme. Se dibuja igual —esconderlo dejaría el feed pareciendo vacío sin
decir por qué— y el barrido de 20 días lo cura solo. **Y obligó a mandar el ISO además de la
etiqueta**: ordenar grupos por `"31 ago, 04:30"` pone *"1 sep"* antes de *"31 ago"*, y el feed queda
mezclado sin que nada falle.

**Qué sigue (la tanda 2, decidida con Mani y aplazada a propósito):** que las corridas registren más
— `descartes.run_id` con su migración y su ADR, checkpoints parciales en el motor para que un fallo
deje rastro, y los `Cerrar run` de archivado y descubrimiento enriquecidos. **Va después y no antes
por una razón concreta:** sin esta pantalla, la única forma de comprobar que un checkpoint escribe
bien es entrar a n8n a mirar la ejecución a mano, que es justo lo que esto elimina.




---

*Los cierres 70 a 144, el log anterior al 2026-08-31 y las secciones de la era Airtable están en
[handoff-archivo-2026-06_09.md](./handoff-archivo-2026-06_09.md). Nada se borró.*
