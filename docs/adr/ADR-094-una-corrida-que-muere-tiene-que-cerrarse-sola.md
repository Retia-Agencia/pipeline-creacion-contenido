# ADR-094 — Una corrida que se queda sin créditos tiene que cerrarse sola y decir por qué

- **Estado:** aceptada — 2026-09-09 (pedido de Mani).
  **No toca `core/`**: sin migración, sin contrato nuevo. Es el motor y `Config`.
  **Reusa** el error handler de [ADR-054](./ADR-054-cada-run-lleva-su-execution-id.md)
  en vez de construir un cierre nuevo.

## Contexto

Mani: *"hay tres corridas que murieron… corre zombie y tenemos que conseguir una manera de que las
corridas, cuando se mueren por créditos de Supadata o créditos de Apify, igual se registren como una
corrida fallida, se cierren y que indique que fue porque ya no hay más créditos, porque ya ha pasado
varias veces"*.

### Lo que pasó el 2026-09-09, medido

Tres corridas del motor (exec **169** 13:16, **170** 16:29, **171** 19:54 UTC) duraron **22 segundos
cada una**, colectaron 0 videos y quedaron `en_curso`. n8n reportó las tres como **`success`**.

| señal | resultado |
|---|---|
| `/v2/users/me/limits` de Apify | **50,019 USD sobre un tope de 50**, ciclo `2026-08-10 → 2026-09-09 23:59 UTC` |
| salida del nodo `Apify — IG Reels` | **15 de 15** respuestas `{"error":"Forbidden"}` (403); TikTok igual |
| actor-runs de Apify después de las 11:09 UTC | **cero**, con tres corridas disparadas a las 13:16, 16:29 y 19:54 |
| el token | **válido** — con ese mismo token esta sesión leyó límites y runs |

⇒ tope agotado, no credenciales. Y **no se perdió ni se pagó ningún video**: `processed_items`,
`app.candidatos` y las transcripciones `origen=motor` dan **0 para las tres**, contra 65 y 68 en las
corridas sanas de referencia. Es [ADR-087](./ADR-087-la-memoria-recuerda-lo-que-se-entrego-no-lo-que-se-evaluo.md)
funcionando: desde que la memoria del dedup cuelga de lo *entregado*, un fallo temprano cuesta una
corrida, no videos.

**El costo no fue plata: fueron 6,5 horas de equipo apretando un botón que no decía nada**, y el
guard single-flight bloqueando 60 minutos por vez.

### 🔑 Por qué la corrida no se cierra, y por qué el error handler que ya existe no se enteró

Son dos causas encadenadas, y la segunda es la que sorprende:

1. **El cierre cuelga del carril de datos.** `Cerrar run en el registro` está río abajo de `Armar
   candidato`, y `Cerrar run (sin novedades)` río abajo de `Merge scrapes`. **Con 0 items n8n no
   ejecuta el nodo**, así que ningún camino de cierre corre — incluido el `IF — hay videos nuevos`,
   que existe exactamente para esto y quedó detrás del vacío que debería detectar.
2. **Los nodos de Apify están configurados como sumidero** (`onError: continueRegularOutput`, por el
   invariante #1). Eso convierte un 403 en *"no había nada"*. La ejecución termina en `success`, y
   [ADR-054](./ADR-054-cada-run-lleva-su-execution-id.md) sólo se dispara con
   ejecuciones fallidas.

**El invariante #1 es correcto para el registro y equivocado para la compra.** Un nodo que *reporta*
tiene que ser sumidero; un nodo que *adquiere* no, porque tragarse su fallo borra la única evidencia
de que la corrida no tiene insumos. Esta ADR no levanta el invariante: lo acota.

## Decisión

**La máquina de cerrar corridas fallidas con su causa YA EXISTE (ADR-054). Lo que falta es que el
motor grite lo bastante fuerte para dispararla.** Tres capas, de más específica a más general.

### Capa 1 — `Cupo Apify (pre-flight)`: preguntar antes de gastar

Un code node entre `Abrir run en el registro` y `Leer plan (fachada)` hace un GET a
`/v2/users/me/limits`. Si `tope − usado < margen_cupo_apify_usd`, tira error.

- **Va en la cabeza del workflow a propósito**: ahí siempre hay exactamente un item. El carril de
  datos no sirve para esto, porque con 0 items no ejecuta nada — que es el modo de falla mismo.
- **Es un code node y no un HTTP node** por el precedente de `Transcribir (Supadata)`: los code nodes
  no pueden usar credenciales, así que el token entra como placeholder `<APIFY_TOKEN>`, que
  [ADR-077](./ADR-077-el-env-es-la-segunda-fuente-de-los-placeholders.md) resuelve desde el `.env`. Un solo
  nodo hace la lectura y el veredicto.
- **FAIL-OPEN**: si Apify no contesta, o contesta algo que no entendemos, **no frena**. Sólo se frena
  con evidencia positiva de que no alcanza. *Un chequeo que bloquea cuando no sabe es peor que no
  tener chequeo.*
- **El margen, no el cero.** `margen_cupo_apify_usd = 2,5` porque una corrida completa costó **2,27**
  medidos (corrida 167, 1.407 reels). Arrancar con 2 USD libres es comprar a medias y morir en la
  mitad cara del pipeline.

### Capa 2 — `Normalizar IG` / `Normalizar TT` pasan a lote y distinguen rechazo de vacío

En modo por-item estos nodos no pueden diferenciar *"el proveedor no devolvió nada"* de *"el
proveedor nos rechazó"*: las dos cosas salen 0. Por lote sí, y la regla es observable:

- `{error: ...}` ⇒ **el proveedor nos rechazó**.
- `{}` o un item sin `id`/`url` ⇒ **dataset vacío**, o un item que no sirve (foto, carrusel).

**Sólo el primero grita, y sólo si son TODOS** — una cuenta caída cuesta una cuenta, no la corrida.
El grito es un `throw`: la ejecución queda en `error` y ADR-054 cierra el run con el mensaje adentro.

🔇 **`Normalizar TT` NO grita, y es una decisión.** `Normalizar IG` corre antes y ya tiró el error si
Instagram fue rechazado, así que lo único que llega hasta TikTok con rechazo es **Instagram sano**:
matar ahí sería tirar una entrega buena por el carril secundario. Y averiguar si Instagram trajo algo
exigiría leer `$('Normalizar IG')`, que es una **rama hermana y no un ancestro** — la clase exacta de
bug que dejó el dedup de [ADR-029](./ADR-029-dedup-blindado-fail-closed-y-feed.md) sin efecto durante 3
corridas. El rechazo de TikTok no se pierde: queda en el log del nodo.

### Capa 3 — `metricas.etapa`: la miga de pan

El run nace con `{etapa: 'abierta'}` y cinco nodos sumidero lo van marcando: `colecta` · `seleccion`
· `transcripcion` · `gate` · `entrega`. Son **ramas muertas en paralelo**, no tocan el carril de
datos, y `Barrer runs zombie` deja de decir sólo *"no cerró"* para apuntar a dónde mirar.

Es la única capa que cubre el **otro** zombie: el de la corrida 166, donde los proveedores sí
contestaron y todo murió en un filtro. **No enumera causas de muerte, registra avance**, así que las
causas futuras salen gratis. Y las etapas están cortadas donde están porque cada una es un proveedor
distinto que puede quedarse sin crédito: `colecta` = Apify, `transcripcion` = Supadata, `gate` = Claude.

⚠️ **La miga NO depende de correr antes que su hermana.** Son ramas paralelas: se escribe igual si la
hermana termina en 0 items. Lo único que se la lleva es que la hermana **tire** un error, y ahí el
mensaje de ADR-054 dice más que cualquier etiqueta de etapa.

## 🩸 El bug que sólo apareció al verificarlo en producción

El primer intento llegó a la fila del run así:

```
[Workflow - Shortform Content] no se pago ni se perdio ningun video. [line 52] · nodo: Cupo Apify (pre-flight)
```

**La causa había desaparecido.** n8n parte el mensaje de un Code node por el **último `:`** y guarda
sólo lo de después; lo anterior se va a `description`, que el error handler no lee. El mensaje
original empezaba con *"Sin cupo de Apify: 50,02 de 50 USD…"* y esa mitad se perdió entera.

⇒ **ningún mensaje de error de este repo puede llevar `:`.** Guiones en vez de dos puntos, la fecha
como `23h59 UTC`, las URLs sin `https`, y el texto del proveedor con los `:` reemplazados antes de
citarlo (es texto de ellos, puede traer uno cualquier día). Hay dos tests que lo fijan, porque esto
se vuelve a pisar solo.

*Un cambio "verificado" con tests y con `n8n:diff` verde igual mentía en la única superficie que el
equipo lee. Sólo lo destapó dispararlo de verdad.*

## Alternativas descartadas

- **Poner `onError: stopWorkflow` en los nodos de Apify.** Cero código y reusa ADR-054. Descartada:
  el nodo corre las 15 cuentas juntas, así que un referente flaky mataría la corrida entera. Hoy
  cuesta un referente.
- **Que `Barrer runs zombie` diagnostique consultando la API de n8n.** Da el nodo exacto y el error
  real, sin instrumentar etapas. Descartada por dos cosas medidas en el propio grafo: para leer los
  zombies hay que cambiar el `Prefer: return=minimal` del barrido, y con 0 zombies el nodo devolvería
  0 items ⇒ **se corta la cadena hacia `Leer corridas vivas` y el workflow entero muere**; y con 2
  zombies emitiría 2 items ⇒ **el guard se ejecutaría dos veces y podría abrir dos runs**. Además
  llega con hasta 60 minutos de retraso, y sólo si alguien vuelve a correr.
- **`alwaysOutputData` para que el vacío fluya hasta el `IF`.** Descartada: el item centinela tendría
  que atravesar seis nodos y cada uno se vuelve un lugar donde un item falso se cuela entre los datos
  reales.
- **Pre-flight de cupo para Supadata.** No existe: se re-midieron `v1/account`, `v1/usage`,
  `v1/limits` y `v1/account/usage` el 09/09 y **los cuatro dan 404**, confirmando el cierre 142. Para
  Supadata sólo queda la detección reactiva (capa 2 y la etapa `transcripcion`).

## Cómo se verificó

Con el cupo **todavía agotado**, o sea en la condición real y a costo cero (la corrida se detiene
antes del primer nodo que gasta):

| qué | resultado |
|---|---|
| `test-nodos.mjs` | **276 checks**, verde (antes 251) |
| `auditar-workflows.mjs` | sin hallazgos — incluido el chequeo de `$('X')` no-ancestro |
| `npm run validate` | 2.659 checks, sin secretos |
| `npm run n8n:diff` | **los 5 workflows corren lo que dice el repo** |
| corrida real, exec **174** | abrió con `metricas.etapa = "abierta"`, tiró el error, y **ADR-054 la cerró en `fallo` en 1 segundo** con `Sin cupo de Apify — 50.02 de 50 USD usados, quedan -0.02 y una corrida cuesta ~2.5. El ciclo reinicia el 2026-09-09 23h59 UTC…` |
| `processed_items` y `app.candidatos` de esa corrida | **0 y 0** — no gastó nada |
| corridas `en_curso` al cerrar | **ninguna** |

## Hecho cuando

1. ✅ Una corrida sin cupo de Apify se cierra sola en `fallo` con el número adentro (exec 174).
2. ⏳ Una corrida rechazada **a mitad de camino** (capa 2) cierra igual. No se pudo montar sin romper
   algo a propósito; el pre-flight tapa el caso de arranque, que es el que se repitió 3 veces.
3. ⏳ `metricas.etapa` sobrevive a una corrida completa y queda en `entrega` o la pisa el cierre.
   Se lee en la próxima corrida real del equipo.
4. ⏳ Que la pantalla Corridas del cockpit muestre `metricas.etapa` cuando el run no cerró. Hoy el
   dato está en la fila y no lo renderiza nadie.

## Lo que esta ADR NO arregla

**El cupo de Apify lo comparten el motor y las sesiones de agente.** El 09/09 dos corridas con
`origin: MCP` (11:03 y 11:09 UTC) gastaron **USD 12,30** — exploración con agente, no el pipeline,
que ese día gastó ~1,68. Eso es lo que reventó el tope y dejó al equipo sin corridas. El pre-flight
ahora lo **avisa**; no lo **separa**. La separación real (token o cuenta propia para el motor) queda
como decisión aparte de Mani.
