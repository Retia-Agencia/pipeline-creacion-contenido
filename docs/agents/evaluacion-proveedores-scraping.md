# Evaluación de proveedores de scraping — ¿hay que sacar a Apify?

> **Qué es esto.** El inventario completo de alternativas al actor `apify/instagram-scraper` que usa
> el motor de reels, con precios de primera mano, y el contrafáctico de cuánto costaría Apify bien
> usado. **Fecha: 2026-09-12.** No es un ADR y no decide nada todavía: es el material para decidir.
>
> 🔑 **Regla heredada de [costos.md](../costos.md): un costo no se cita, se mide.** Cada número de
> acá tiene al lado el comando que lo reproduce, o el pool sobre el que se midió. Lo que no se pudo
> medir está marcado ⚠️ y dice por qué y qué experimento lo cerraría.

**Docs hermanos.** El mapa monetario es [costos.md](../costos.md); el diagnóstico del gasto es
[plan-costo-apify.md](./plan-costo-apify.md). Este doc es el tercero: **el proveedor**. El norte del
producto está en [ROADMAP §1](../../ROADMAP.md) y la métrica única en
[ADR-089](../adr/ADR-089-una-sola-metrica-aprobados-contra-lo-pedido.md).

---

## 0. El resumen, para no leer 300 líneas

Cinco hallazgos, en orden de cuánto cambian la decisión.

1. 🔴 **El cuello de botella no es el proveedor ni la plata: son 25 referentes.** El equipo pide
   ~150 videos/semana y el techo físico del roster, con todo comprado y ningún filtro, es **59 a
   218 reels crudos/semana**, que dan **0,6 a 45 aprobados**. Para 150 hacen falta **300 a 1.100
   referentes** con `min_views` en 100.000 (§3).
2. 🟢 **Apify bien usado cuesta 0,84 a 2,41 USD/mes** con marca de agua por referente y cadencia
   semanal, contra un cupo de 50 (§2). **Y eso es lo que habilita el punto 1**: a ese precio caben
   300-1.100 cuentas dentro del cupo. La marca de agua no es la mejora, es el permiso.
3. ⛔ **Ningún proveedor evaluado —5 actores de Apify y 7 externos— tiene cota superior de fecha**
   (§4). La que falta se vuelve innecesaria con marca de agua: el piso de esta corrida es el techo
   de la anterior.
4. 🔓 **Dos precios que Apify "no expone" sí están en su API** y cierran dos preguntas abiertas: el
   add-on de transcript cuesta **26× Supadata** (§4.2), y el actor "13 % más barato" sale **+5 %
   más caro** en el régimen que proponemos, por su cobro de arranque (§4.3).
5. 🟡 **Meta Graph API cubre entre el 25 % y el 50 % del roster** — medido sobre
   `metaData.isBusinessAccount` de los reels ya pagados (§5.1). Nunca puede ser proveedor único,
   pero es la única fuente **oficial** posible y por eso vale como segundo carril.

**Recomendación en una línea:** Apify se queda, se arregla la cadencia, y el esfuerzo se mueve de
"cambiar de proveedor" a **"multiplicar referentes"**, que es donde está el accuracy.

---

## 1. De dónde salió este doc — las preguntas que lo dispararon

Se anotan textuales porque el doc contesta estas y no otras, y porque dos de ellas corrigieron un
análisis que ya estaba escrito.

**Encargo inicial (Mani, 12/09):** *"evaluar alternativas al actor de Apify que hoy usa el motor y
traer una recomendación argumentada con números, sin implementar nada"*, con cuatro entregables:
inventario de opciones reales, costo/paginación/infraestructura/riesgo de cada una, el contrafáctico
honesto de Apify con marca de agua, y una recomendación en formato ADR.

**Durante la sesión, Mani agregó:**

- *"Mira esta open source por ejemplo: https://github.com/Panniantong/Agent-Reach. Tocaría hacer
  análisis profundo de que no sea un virus o algo. Pero vainas así necesito porque creo que Apify
  tiene limitaciones."* → §6.
- *"Mi jefe había quedado pendiente de mandarnos el código de una herramienta que hizo la empresa
  que se llama PreWave, que creo que tiene un componente de búsqueda de referentes y videos."* → §7.
- **P1.** *"¿Si Apify no es caro para la cantidad de videos que pide el equipo de redes (como 150
  semanales por ejemplo), dices que arreglar la cadencia es suficiente?"* → §3. **La respuesta es
  NO, y esta pregunta corrigió el doc.**
- **P2.** *"Si hay un actor con esquema idéntico pero 13 % más barato, propongo pasar el workflow a
  usar ese."* → §4.3. **La respuesta es que hoy saldría más caro.**
- **P3.** *"Apify sigue siendo un cuello de botella porque es la única herramienta de scrapeo que
  usamos. El de Meta Graph API, que es oficial, lo podríamos revisar porque sería muy muy buena.
  HikerAPI la podemos proponer, aunque sea tratarla con el trial para ver cómo se compara."* → §5.
- **El norte que Mani puso sobre todo lo demás:** *"la idea es siempre aumentar el accuracy, que el
  accuracy es: pido tantos videos de tanta calidad de esos referentes y me los da."* Es
  [ADR-089](../adr/ADR-089-una-sola-metrica-aprobados-contra-lo-pedido.md) dicho con otras palabras,
  y es por lo que §3 quedó arriba de §2.

---

## 2. El contrafáctico: cuánto cuesta Apify bien usado

### 2.1 Método

Se midió el **ritmo real de publicación** de las 26 cuentas del roster, reel por reel, desde los
datasets ya pagados de la exec 183 (10/09 21:43 UTC, ventana 50 días, cap 25, 24 corridas de actor,
1,035 USD). **Leer datasets de Apify no cuesta nada.** Reproducción:

```bash
set -a && source .env && set +a
curl -s -H "Authorization: Bearer $APIFY_TOKEN" \
  "https://api.apify.com/v2/actor-runs?desc=1&limit=300" \
  | python3 -c "import json,sys; rs=json.load(sys.stdin)['data']['items']; \
print([ (r['defaultDatasetId']) for r in rs if r.get('actId')=='shu8hvrXbJbY3Eb9W' \
and '2026-09-10T21:43' <= r['startedAt'][:16] <= '2026-09-10T21:56' ])"
# luego, por cada datasetId:
# curl -s -H "Authorization: Bearer $APIFY_TOKEN" \
#   "https://api.apify.com/v2/datasets/<ID>/items?clean=true&limit=1000"
```

Verificación de que el pool es el correcto: **24 corridas, 1,035 USD**, que es exactamente lo que
[costos.md §3.3](../costos.md) registra para la exec 183. 450 items recuperados.

### 2.2 Lo medido

| | |
|---|---|
| reels dentro de la ventana de 50 d | **420** |
| reels **fuera** de la ventana (posts fijados que se saltan el filtro de fecha) | **26 = 5,8 %** |
| cuentas del roster | 26 (25 con reels, 1 vacía) |
| cuentas que topearon en 25 dentro de la ventana | **14** |

📌 El 5,8 % de fijados es una **medición independiente** del 6,5 % que ya trae
[costos.md §4.3.5](../costos.md). Dos pasadas distintas, mismo orden de magnitud.

**El ritmo de publicación, y por qué va como rango y no como número:**

| estimador | reels/semana | por qué |
|---|---|---|
| **piso** — `n / 50 días` | **59** | censurado: 14 cuentas topearon en 25, su historia dentro de la ventana está truncada |
| **insesgado** — `(n−1) / span observado` | **218** | usa el período realmente cubierto; es el estimador correcto para un proceso de llegadas |
| techo — `n / span` | 232 | sesgado hacia arriba por construcción |

⚠️ **Los dos primeros difieren 4× y este pool no puede cerrarlos.** Se reportan los dos. *Elegir uno
sería inventar precisión: el cap de 25 destruyó la información que haría falta.* **Lo que cierra el
rango:** una sola corrida con `resultsLimit` alto (100+) y ventana de 14 días sobre el roster actual
— cuesta ~1,5 USD y deja el ritmo medido sin censura.

### 2.3 El resultado

**Con marca de agua por referente (`onlyPostsNewerThan` = fecha del reel más nuevo ya comprado de
esa cuenta) y una corrida por semana:**

| | reels/corrida | USD/corrida | USD/mes (×4,3) | % del cupo de 50 |
|---|---|---|---|---|
| piso | 85 | **0,20** | **0,84** | 1,7 % |
| insesgado | 244 | **0,56** | **2,41** | 4,8 % |

*(incluye los 26 fijados que se re-cobran en cada corrida; el actor de hoy no los puede evitar)*

**Cuántos referentes aguanta el cupo de 50 USD/mes a ese régimen: 580 (ritmo insesgado) a 2.149
(ritmo piso).** Hoy hay 26.

### 2.4 🩸 El dato incómodo que reordena el diagnóstico

La exec 183 con la config actual (**sin** marca de agua, ventana 50 d) costó 1,035 USD. **A cadencia
semanal eso son 4,45 USD/mes: el 9 % del cupo.**

Los 23,83 USD del 10/09 no los causó la ventana, ni el actor, ni la falta de `onlyPostsOlderThan`.
**Los causó disparar 5 tandas en un día.** El 74 % de re-compra medido en el cierre 149 es re-compra
**intradía**: dos tandas separadas por 52 minutos trajeron cero videos nuevos.

⇒ **El proveedor nunca fue el problema.** La ventana tampoco, casi. El problema es **cuántas veces
al día se aprieta el botón**, y eso no se arregla cambiando de proveedor.

---

## 3. 🔴 La pregunta que corrigió el doc: ¿alcanza para 150 videos por semana?

**No.** Y la marca de agua, que arregla el costo, **empeora esto**, porque baja el costo comprando
menos. Es la tensión central de todo el análisis y hay que ponerla por delante del ahorro.

### 3.1 El techo físico

Con marca de agua semanal, el pool crudo son **59 a 218 reels/semana**. Ese es todo el material que
las 25 cuentas producen. Lo que sobrevive, medido sobre las 450 filas del pool real de la 183:

| `min_views` | % del pool que pasa | aprobados/sem (pool 59) | aprobados/sem (pool 218) |
|---|---|---|---|
| **500.000 (hoy)** | **2,7 %** | **0,6** | 2,3 |
| 250.000 | 6,7 % | 1,5 | 5,7 |
| **100.000** | **14,7 %** | 3,4 | 12,5 |
| 50.000 | 25,6 % | 5,9 | 21,7 |
| 20.000 | 53,1 % | 12,2 | **45,1** |

*(× 39 % de aprobación humana, promedio de lo medido en el handoff: gate 36,1 %, relleno 41,2 %)*

**Se piden 150 y el techo del roster es 45**, con el umbral en 20.000, que es tan bajo que deja de
filtrar. **Ningún ajuste de umbral, presupuesto o proveedor cierra esa brecha.** El material no
existe.

### 3.2 Cuántos referentes harían falta

| `min_views` | referentes necesarios | USD/mes de Apify | ¿cabe en el cupo? |
|---|---|---|---|
| 500.000 | 1.656 a 6.132 | **142,6** | ❌ no |
| **100.000** | **301 a 1.115** | **25,9** | ✅ sí |
| 50.000 | 173 a 640 | 14,9 | ✅ sí |

🔑 **Lo que esto hace obvio, y es la tesis del doc:** el costo de Apify escala con lo que las cuentas
**publican**, no con cuántas cuentas hay en la lista. Por eso 300 referentes con marca de agua
cuestan 26 USD/mes y hoy 300 referentes a ventana de 50 días costarían ~30 USD **por corrida**.

⇒ **La marca de agua no es la mejora. Es el permiso para multiplicar los referentes por 12-40.**

### 3.3 Lo que este cálculo NO dice

⚠️ Supone que 300 cuentas nuevas rinden como las 25 de hoy. **No hay evidencia de eso**, y el
handoff ya midió por qué: con **137 calificaciones en toda la historia del sistema**, chi² = 15,9
sobre 11 grados de libertad (p ≈ 0,15) ⇒ **no se puede distinguir una cuenta buena de una mala**. El
rango de rendimiento medido va de 60 % a 0 % de útiles, y 5 cuentas se llevan el 24 % del gasto
devolviendo cero.

**Sumar 300 referentes sin un criterio de poda es comprar 300 suscripciones que nadie cancela.** El
ledger por cuenta ([handoff §2.a](./handoff.md), `app.v_salud_referentes` + dos contadores que
faltan) es prerrequisito de esto, no un extra.

---

## 4. Inventario: actores de Apify

### 4.1 Precios de primera mano

Salen de `GET /v2/acts/<id>` → `pricingInfos[-1].pricingPerEvent.actorChargeEvents[*].eventTieredPricingUsd`,
**no de blogs**. Nuestro plan **STARTER mapea al tier BRONZE**, verificado: BRONZE de
`instagram-scraper` = 0,0023, que coincide exacto con `usageTotalUsd / reels` medido en 24 corridas.

```bash
curl -s -H "Authorization: Bearer $APIFY_TOKEN" \
  "https://api.apify.com/v2/acts/apify~instagram-reel-scraper" \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; \
print(json.dumps(d['pricingInfos'][-1]['pricingPerEvent'],indent=1))"
```

| actor | USD/reel (BRONZE) | arranque | ¿cota superior de fecha? | usuarios/30d |
|---|---|---|---|---|
| `apify/instagram-scraper` **(hoy)** | 0,0023 | — | ❌ solo `onlyPostsNewerThan` | 42.748 |
| `apify/instagram-api-scraper` | **0,0020** | 0,001 | ❌ schema idéntico al de hoy | 1.042 |
| `apify/instagram-post-scraper` | **0,0015** | — | ⚠️ sin verificar | 11.754 |
| `apify/instagram-reel-scraper` | 0,0023 | 0,001 | ❌ | 12.741 |
| `apidojo/instagram-scraper` | **0,00049** | — | ❌ su campo `until` dice literal *"Returns posts newer than this date"* | 776 |

⛔ **Ninguno de los cinco tiene cota superior de fecha.** Se verificó el input schema de cada uno vía
`GET /v2/acts/<id>/builds/default`. Confirma y extiende el hallazgo del handoff: tampoco la tiene el
actor barato, ni el especializado en reels.

**Escala de precios completa** (por si el plan cambia): FREE 0,0027 · **BRONZE 0,0023** · SILVER
0,0019 · GOLD 0,0015 · PLATINUM y DIAMOND más abajo. Subir de plan es la palanca de precio que nadie
ha mirado, y a este volumen no se justifica.

### 4.2 🔓 El precio del add-on de transcript SÍ está en la API, y lo mata

El handoff decía *"`includeTranscript` como add-on pago. Falta precio del add-on (Apify no lo expone
por API)"*. **Sí lo expone**, en el mismo `eventTieredPricingUsd`:

| | BRONZE (nuestro plan) |
|---|---|
| `transcript` — *"Charged per started minute per reel"* | **0,041 USD / minuto** |
| Supadata `mode=auto` (el camino normal hoy) | **0,001567 USD / video** |
| Supadata `mode=generate` | ~0,0031 USD / minuto |

**Un reel de 60 s: 0,041 contra 0,001567 = 26× más caro.** Y contra `generate`, 13×.

⛔ **El add-on de Apify no saca a Supadata del pipeline: lo reemplaza por algo 26 veces peor.** La
puerta queda cerrada con número y no hay que volver a abrirla. *Los otros dos add-ons del mismo
actor, por si aparecen: `shares-count` 0,006/reel y `video-download` 0,015 por MB empezado.*

### 4.3 P2 — el actor "13 % más barato" sale **+5 % más caro** hoy

`instagram-api-scraper` cobra 0,0020/reel **más 0,001 por arranque de corrida**. El motor arranca
**una corrida de actor por cuenta** (nodo `Split IG referentes`). Punto de equilibrio:

```
0,001 / (0,0023 − 0,0020) = 3,3 reels por corrida de actor
```

Debajo de 3,3 reels por cuenta, el arranque se come el descuento entero.

| escenario | reels/cuenta | hoy | api-scraper | delta real |
|---|---|---|---|---|
| **régimen con marca de agua (piso)** | **2,4** | 0,138 | 0,145 | **+5,1 %** 🔴 |
| régimen con marca de agua (insesgado) | 8,7 | 0,500 | 0,460 | −8,0 % |
| config actual, exec 183 (cap 25) | 18 | 1,035 | 0,925 | −10,6 % |
| config vieja, exec 182 (cap 150) | 87 | 6,003 | 5,250 | −12,5 % |

**El 13 % de vitrina solo existe mandando todos los handles en UNA corrida** (`directUrls` es un
array). Ahí sí: **−12,3 % a −13,0 % en cualquier escenario**, porque el arranque se paga una vez.

🔑 **La condición no es "cambiar de actor". Es "cambiar de actor Y dejar de hacer una corrida por
cuenta".** Y el segundo cambio pelea con la marca de agua por cuenta, porque `onlyPostsNewerThan` es
**global a la corrida**. Con cadencia semanal uniforme las dos marcas coinciden (todas las cuentas se
compraron el mismo día), así que se puede — pero una cuenta nueva necesita su propia corrida de
backfill.

**Ahorro total: 3,76 USD al año.** Cierto, y despreciable frente a §3.

### 4.4 📌 El único actor que compra algo que hoy no se puede comprar

`apify/instagram-reel-scraper` cuesta **lo mismo** (0,0023) y trae **`skipPinnedPosts`**.

| | hoy | con marca de agua |
|---|---|---|
| reels comprados por corrida | 450 | 85 |
| de esos, fijados que se re-cobran siempre | 26 | 26 |
| **% de la factura que son fijados** | **5,8 %** | **31 %** |

🔑 **La fuga de fijados crece de 5,8 % a 31 % justo cuando se arregla la cadencia**, porque el
denominador cae y el numerador no. **Es el único cambio de actor con un argumento que no es el
precio.** Su `actor-start` de 0,001 obliga al mismo dilema de §4.3 y se resuelve igual: una sola
corrida con el array de usernames.

⚠️ **Sin verificar: su output schema.** El nodo `Normalizar IG` lee **23 campos** del item
(`igPlayCount`, `videoPlayCount`, `videoViewCount`, `ownerFollowersCount`, `metaData`, `shortCode`,
`timestamp`, `videoDuration`…). *Input schema idéntico no implica output idéntico.* Se verifica con
una corrida de 1 reel: **0,0033 USD**.

### 4.5 El actor 4,7× más barato

`apidojo/instagram-scraper` a **0,00049/item** es el más barato de la store por un margen enorme, y
acepta URLs de tipo `https://instagram.com/<user>/reels` directamente.

**Se anota y no se adopta**, por tres razones: (1) a este régimen ahorra ~1,4 USD/mes; (2) 776
usuarios/30d contra 42.748 del oficial, o sea mucho menos probado; (3) su output schema tampoco está
verificado. **Se reabre si los referentes pasan de ~400**, donde el ahorro empieza a ser real.

---

## 5. Inventario: fuera de Apify

| opción | costo | ¿paginar hacia atrás? | infraestructura | riesgo de bloqueo |
|---|---|---|---|---|
| **Meta Graph API** (`business_discovery`) | **gratis** | ✅ | app aprobada + cuenta IG Business propia ligada a una Página | **cero, es oficial** |
| **HikerAPI** | 0,02/req con saldo de 20 USD · 0,001 con 100 · 0,00069 con 300 · 0,0006 con 599 | ✅ cursor (`end_cursor`) | ninguna | del proveedor |
| **ScrapeCreators** | ~1,88 USD/1k créditos (plan de 47) | ✅ cursor | ninguna | del proveedor |
| **EnsembleData** | 100 USD/mes, 1.500 unidades/día | ✅ | ninguna | del proveedor |
| **Bright Data** | ~0,001 USD/registro | ✅ | ninguna | del proveedor |
| **instaloader / instagrapi** | código gratis | ✅ | proxies + cuentas quemables + scheduler que sepa cuál está rate-limited | **alto, cae sobre cuentas propias** |
| **Agent-Reach / OpenCLI** | gratis | ✅ | Chrome logueado en un escritorio | alto (§6) |

⚠️ Los precios de ScrapeCreators, EnsembleData y Bright Data vienen de **una sola fuente** cada uno,
y en dos casos esa fuente es el blog del propio proveedor comparándose con la competencia. **No son
del mismo nivel de confianza que los de §4.1**, que salen de la API. No decidir sobre ellos sin
volver a medir.

### 5.1 🟡 Meta Graph API — medido, y es estructuralmente parcial

`business_discovery` devuelve, sobre el media edge de **otra** cuenta: `like_count`,
`comments_count`, `view_count`, `id`. Requiere `instagram_basic` + `instagram_manage_insights` +
`pages_read_engagement`, o sea **App Review con Advanced Access**. No devuelve datos de cuentas
age-gated.

**El requisito que decide todo: la cuenta objetivo tiene que ser Business o Creator.** Eso se puede
medir **hoy, gratis**, porque el campo ya viene en los reels que pagamos:

```bash
# sobre el pool ya descargado de la exec 183
python3 -c "
import json,collections
rows=[json.loads(l) for l in open('pool183.jsonl')]
c={ (r.get('metaData') or {}).get('username'): (r.get('metaData') or {}).get('isBusinessAccount')
    for r in rows if r.get('metaData') }
print(collections.Counter(c.values()))"
```

**Resultado: 5 de 20 cuentas (25 %) tienen `isBusinessAccount = true`.** Otras 5 tienen
`businessCategoryName` poblado ("Public figure" ×3, "Finance", "Gun Store") sin la bandera, lo que
sugiere que son **Creator** y también calificarían.

⇒ **cobertura estimada: 25 % (medido) a 50 % (estimado).** Cero cuentas privadas, así que ese no es
el límite.

**Veredicto:** ⛔ **no puede ser el proveedor único**, ni con voluntad infinita: la mitad del roster
son cuentas personales que `business_discovery` no ve. ✅ **Sí sirve como segundo carril gratis para
la mitad del roster**, y es la única fuente del sistema que **no puede ser bloqueada por scraping**,
porque no es scraping. Eso es exactamente lo que pide P3.

⚠️ **Lo que nadie ha verificado y es el riesgo real:** Meta lleva dos años recortando este endpoint
(`video_views` deprecado, view counts del endpoint de post único removidos en 2026). **Es una
dependencia que puede morir por decisión ajena sin aviso** — el modo de falla opuesto al de un
scraper, pero igual de terminal.

### 5.2 🟡 HikerAPI — el precio de vitrina es real y es inalcanzable

Precios leídos de su propia página, no de un blog:

| tier | USD/request | desbloquea con saldo prepago de |
|---|---|---|
| START | **0,02** | 20 USD |
| STANDARD | 0,001 | 100 USD |
| BUSINESS | 0,00069 | 300 USD |
| ULTRA | 0,0006 | 599 USD |

🩸 **El precio depende del saldo prepago, no del consumo.** Gastando 2,41 USD/mes caes en START:
**0,02 por request, 8,7× más caro que Apify**. Para llegar a 0,001 hay que congelar 100 USD, que a
ese consumo son ~40 meses de runway inmovilizado.

🔑 **Pero cobra por PÁGINA, no por reel.** Su propio ejemplo de código:

```python
medias, end_cursor = session.get(
    "https://api.hikerapi.com/v1/user/medias/chunk",
    params={"user_id": user["pk"]}).json()
```

Si un chunk devuelve 12 reels, el costo por reel en START es **0,00167 — más barato que Apify** sin
prepagar nada. Si devuelve 1, es 8,7× peor.

⚠️ **No se pudo verificar el tamaño de página.** Su doc en readthedocs devolvió 404 y la búsqueda no
lo trae. **Es el único número del doc que podría dar vuelta un veredicto.**

✅ **Y se mide gratis: el trial regala 100 requests** (registro + verificación por Telegram, sin
tarjeta). **Un solo request lo contesta.** Es el experimento más barato de toda la evaluación.

### 5.3 Open source auto-hospedado — el costo no es el código

`instaloader` y `instagrapi` son gratis y no es ahí donde se paga. Lo que cuesta:

- **Cuentas quemables + proxies residenciales.** Ambos proyectos documentan que el login es
  obligatorio para casi todo y que Instagram banea. Instaloader lleva un rate limiter propio y aun
  así su tracker está lleno de reportes de bloqueos y suspensiones.
- **Mantenimiento reactivo.** Cuando Instagram cambia, el pipeline se cae y el arreglo depende de un
  mantenedor voluntario.
- **Orquestación multi-cuenta.** Para el volumen de §3 (300-1.100 referentes) harían falta 10+
  cuentas, 10+ sesiones, 10+ proxies y un scheduler que sepa cuál está en cooldown.

⛔ **El riesgo no es económico: es que el ban cae sobre cuentas propias**, y el sistema se cae en
silencio justo cuando más se usa. **A cambio de ahorrar 29 USD al año.**

---

## 6. Agent-Reach — no es un virus, y aun así no es candidato

Repo: `Panniantong/Agent-Reach`, MIT, Python, 79.695 ⭐. Se clonó y se revisó **estáticamente, sin
ejecutarlo**.

### 6.1 Lo que está limpio (verificado)

```bash
grep -rnE 'eval\(|exec\(|__import__|b64decode|marshal\.loads|pickle\.loads|curl [^|]*\| *(ba)?sh' agent_reach/
grep -rn 'shell *= *True' agent_reach/
grep -rhoE 'https?://[a-zA-Z0-9._:-]+' agent_reach/ | sed -E 's#(https?://[^/]*).*#\1#' | sort | uniq -c
```

- ✅ Cero ejecución dinámica, cero ofuscación, cero `shell=True`, cero `curl | sh`.
- ✅ Todos los hosts a los que habla están nombrados y son plausibles (github, jina, groq, exa, npm).
- ✅ La extracción de cookies del navegador está **acotada por dominio** a x.com, xiaohongshu,
  bilibili y xueqiu. **Instagram no está en esa lista.**
- ✅ El `postinstall` de su dependencia npm **no hace ninguna llamada de red** (se bajó el tarball de
  `@jackwener/opencli@1.8.7` y se leyó: sincroniza hashes locales de 179 adaptadores).

🩸 **Corrección de una sospecha propia:** vi un `postinstall` llamando a `fetch-adapters.js` y asumí
descarga en tiempo de instalación. Leí el script y **no hay red**. Falsa alarma mía, se anota para
que nadie la repita.

### 6.2 Los tres hallazgos que sí importan

🔴 **1. El módulo de Instagram tiene 13 líneas.** No es un scraper. Es un envío a
`opencli instagram ...`, y su propio docstring dice: *"OpenCLI drives the user's real Chrome via a
browser-bridge extension + local daemon, reusing existing login sessions — desktop-only (no
headless)"*. La dependencia real es **OpenCLI** (`github.com/jackwener/opencli`, npm
`@jackwener/opencli`, extensión de Chrome Web Store id `ildkmabpimmkaediidaifkhjpohdnifk`), otro
autor, cuyo manifest **no se puede auditar desde acá** porque vive en la Store.

🔴 **2. Queda descalificado por arquitectura, antes que por seguridad.** El motor corre en n8n, en un
servidor. OpenCLI es **desktop-only** y necesita un Chrome con sesión humana logueada. No hay forma
de meter esto en el pipeline salvo dejando un Mac prendido con Instagram abierto. Y el adaptador
expone `like.js`, `follow.js`, `comment.js`, `unfollow.js`, `save.js`: **la misma herramienta que lee
puede actuar como vos en tu cuenta.**

⚠️ **3. Las estrellas no cuadran, y es la segunda señal contra la primera.**

| repo | ⭐ | watchers | ratio | sano |
|---|---|---|---|---|
| Agent-Reach | 79.695 | **282** | **283 : 1** | 20-60 : 1 |
| OpenCLI | 29.225 | **62** | **471 : 1** | 20-60 : 1 |

Los dos nacieron hace menos de 7 meses. El dueño de Agent-Reach tiene 1.163 seguidores. **No prueba
estrellas compradas**, pero sí significa que **el número de estrellas no es evidencia de que alguien
lo use en serio**, y era la única señal de confianza disponible. *Una señal no es prueba.*

### 6.3 Veredicto

**El código no es malicioso hasta donde se puede ver, y aun así no entra.** No por miedo: por
incompatibilidad. Lo que sí vale de ahí: su adaptador trae `play_count`, `view_count`, `like_count`,
`comments_count`, `taken_at`, o sea que **la cobertura de campos existe**. Sirve como herramienta
local de exploración manual, nunca como pata del motor.

---

## 7. PreWave — casilla abierta

Herramienta interna de la empresa, con un componente de búsqueda de referentes y videos. **El jefe
de Mani la pidió y está pendiente de que se la den.** Sin el código no hay nada que medir y no se
especula.

**Las tres preguntas que la deciden en 20 minutos cuando llegue:**

1. **¿De dónde saca los datos?** Proveedor pago, API privada de Instagram, o cuenta logueada.
2. **¿Corre headless en un servidor?**
3. **¿Devuelve `play_count` y `timestamp` por reel?**

Si (1) es "cuenta logueada" o (2) es "no", queda descartada por las mismas razones que Agent-Reach,
sin importar lo buena que sea en lo demás. Si pasa las tres, entra a la tabla de §5 y se evalúa como
cualquier otra.

---

## 8. Lo que cuesta migrar, para que el cero del ahorro se vea entero

El nodo `Normalizar IG` lee **23 campos** del item de Apify:

```
biography, caption, commentsCount, displayUrl, error, followersCount, hashtags, id,
igPlayCount, likesCount, metaData, ownerBio, ownerFollowersCount, ownerFullName,
ownerUsername, shortCode, shortcode, timestamp, type, url, videoDuration,
videoPlayCount, videoViewCount
```

Cualquier proveedor nuevo obliga a remapear los 23, re-verificar el dedup por `external_id`, y
reescribir el pre-flight de cupo de [ADR-094](../adr/) que hoy lee `/v2/users/me/limits` y no tiene
equivalente en ningún otro proveedor. Son días de trabajo.

**Para ahorrar, como máximo, 29 USD al año.**

---

## 9. Los tres experimentos, en orden de retorno

| # | qué | costo | qué contesta | quién |
|---|---|---|---|---|
| 1 | **Trial de HikerAPI**: 1 request a `user/medias/chunk` | **0 USD** | el tamaño de página, único número que podría dar vuelta un veredicto (§5.2) | agente, 15 min |
| 2 | **Una corrida con `resultsLimit` 100 y ventana 14 d** sobre el roster actual | ~1,50 USD | cierra el rango 59-218 del ritmo de publicación (§2.2) | Mani autoriza, motor |
| 3 | **1 reel con `instagram-reel-scraper`** | **0,0033 USD** | si su output schema cubre los 23 campos (§4.4) | agente |

**Y una verificación que no es experimento:** correr §5.1 de nuevo con el roster completo (hoy son
20 de 26 cuentas con metadata) para fijar la cobertura real de Meta Graph API antes de invertir en
App Review.

---

## 10. Hacia dónde apunta la decisión

**No se escribe como ADR todavía** (pedido explícito de Mani). Es el esqueleto de lo que la ADR
diría si los experimentos no la contradicen.

1. **Apify se queda.** Ningún proveedor evaluado ahorra más de 29 USD/año y el remapeo de 23 campos
   cuesta más que eso. El proveedor nunca fue el problema (§2.4).
2. **Marca de agua por referente + una corrida por semana.** `onlyPostsNewerThan` se calcula por
   cuenta como la fecha del reel más nuevo ya comprado. **Bloqueada por la tabla de pool crudo
   comprado, que no existe** — hoy `processed_items` se escribe después de `min_views`, así que el
   repo no sabe qué pagó. 🔴 **Plazo: Apify borra los datasets a los 31 días, o sea el 2026-10-11.**
3. **`min_views` a 100.000**, global. Es gratis (filtra después de pagar) y es condición aritmética
   de §3.2: con 500.000 ningún número de referentes cabe en el cupo.
4. **El esfuerzo se mueve a multiplicar referentes: de 26 a ~300.** Es el único camino a 150
   videos/semana y cabe en el cupo. **Prerrequisito no negociable: el ledger por cuenta**, o son 300
   suscripciones que nadie cancela (§3.3).
5. **Meta Graph API como segundo carril, no como reemplazo.** Cubre 25-50 % del roster, es gratis y
   es oficial. Resuelve la concentración de proveedor que motivó P3, a medias y a propósito.
6. **`instagram-reel-scraper` se evalúa por `skipPinnedPosts`, no por precio** (cuesta lo mismo): la
   fuga de fijados pasa de 5,8 % a 31 % de la factura cuando se arregla la cadencia.
7. **El add-on de transcript de Apify queda descartado con número**: 26× Supadata (§4.2).
8. **`apidojo/instagram-scraper` (4,7× más barato) se anota y no se adopta**; se reabre pasados los
   ~400 referentes (§4.5).

**Lo que esta evaluación NO toca, y sigue siendo el frente más grande:** el termómetro roto.
`relevancia_score ↔ aprobado` = +0,041 y `heat_score ↔ aprobado` = +0,044 sobre 136 calificados.
**Ninguno de los dos números que el motor calcula para decidir qué entregar predice lo que el equipo
aprueba.** Multiplicar los referentes por 12 sin arreglar eso multiplica por 12 el material que se
juzga con una vara que no mide.
