# Plan — Refactor del motor: traer bien y medir bien

> **Estado: brainstorm consolidado, CERO código aplicado.** Escrito el 2026-09-12 a pedido de Mani
> como **punto de partida único** del refactor. Consolida las sesiones del 10, 11 y 12 de septiembre
> y lo que ya estaba medido en [plan-costo-apify.md](./plan-costo-apify.md),
> [costos.md](../costos.md), [plan-cascada-de-entrega.md](./plan-cascada-de-entrega.md) y los
> cierres 145–149 del [handoff](./handoff.md).
>
> **Cómo leerlo.** §1 son los hechos con su fuerza de evidencia (leelo aunque conozcas el repo: hay
> una corrección que invalida una conclusión que tres documentos daban por buena). §2 es el
> diagnóstico. §3 es el diseño propuesto. §4 son las decisiones que NO se re-litigan. **§5 son las
> preguntas abiertas, y es la sección que más importa**, porque casi todas las contesta el equipo de
> medios y no un dev. §8 es el resumen sin jerga.
>
> ⚠️ **LEÉ ESTO ANTES DE CONSTRUIR NADA DE ACÁ.** Al cerrar la sesión del 12/09 Mani dijo que
> **sospecha que esta solución está sobre-diseñada** y abrió una sesión aparte para re-pensarla más
> simple. Y dejó un **criterio de aceptación del diseño, no de la documentación**:
>
> > *"Para el equipo de redes es muy importante que se pueda explicar en un paso a paso de 3, 4,
> > máximo 5 pasos, y que se sepa qué pasa en cada uno."*
>
> **Si el diseño no cabe en 5 pasos explicables, el diseño está mal.** Nada de este documento es
> definitivo por estar escrito acá. Ver §5bis C1 y C2.

> ⛔ **El botón ▶ del cockpit está bloqueado a propósito** desde el 2026-09-12 (commit `e4c1133`,
> flag en `apps/dashboard/app/[cliente]/[pipeline]/(zonas)/operar/bloqueo.ts`). Correr hoy paga
> Apify para entregar casi nada. Desbloquear = poner `MOTOR_BLOQUEADO` en `false`.

---

## §0 · El hallazgo ordenador

> **El motor no tiene un problema de filtros. Tiene un problema de vara.**

Todo lo que sigue se deriva de una sola cosa: el sistema juzga cada video contra **un número
absoluto de vistas** (`min_views = 500.000`, global para todos los proyectos). Esa vara arrastra
tres sesgos que nadie eligió:

1. **Sesgo de edad.** Un reel de 2 días no tuvo tiempo de juntar vistas. Se lo compara contra uno de
   60 días como si fueran comparables.
2. **Sesgo de tamaño de cuenta.** 500.000 vistas es mediocre para una cuenta de 5 M seguidores y una
   explosión para una de 20 k.
3. **Sesgo de nicho.** El pool de trading de Vieira tiene mediana **22.394** vistas; el resto,
   **256.556**. Un solo número global gobierna los dos mundos.

Y de esa vara salen los dos síntomas que se veían como problemas separados:

- **Costo:** para pasar una vara alta hay que comprar videos viejos y profundos, que es exactamente
  lo que hace re-comprar lo mismo corrida tras corrida.
- **Accuracy:** los que pasan la vara no son los que el equipo aprueba (correlación medida:
  **+0,044**), y los que no pasan se descartan sin que nadie los mire.

**Son el mismo bug visto desde dos lados.**

### 🩸 El dato que cambia la naturaleza del cambio: **el 500.000 es una INSTRUCCIÓN, no un default**

**Mani, 12/09, al cierre de la sesión:** *"mi jefe le pide a los de redes mínimo videos de 500k
explícitamente. Para él eso es accuracy."*

**Todo este documento venía tratando el `min_views = 500.000` como una mala configuración técnica.
No lo es: es una directiva de negocio.** Y eso cambia tres cosas:

1. **El refactor no es un arreglo, es una renegociación de qué significa "accuracy".** Hoy hay dos
   definiciones en conflicto y nadie las ha puesto en la misma mesa: para el jefe, accuracy = vistas
   absolutas altas; para el norte escrito del repo (ADR-089), accuracy = `aprobados / N pedido`.
   **Un video de 500k que el equipo no aprueba sube la primera métrica y baja la segunda.**
2. **No alcanza con cambiar el código.** Se puede construir la medida relativa entera y el pedido
   seguirá siendo "mínimo 500k", porque viene de arriba.
3. **El argumento tiene que ser medido, no estético**, y ya lo está: en trading la mediana del pool
   es **22.394** vistas y sólo el **2,4 %** llega a 500k, así que para llenar `N = 70` el material
   que califica son **5 videos**. En psicología/comunicación la mediana es **256.556** y pasa el
   **33,5 %**. *Es el mismo umbral haciendo dos cosas opuestas según el nicho.*

⭐ **Y hay un argumento a favor que estaba escrito en el propio ROADMAP desde el principio, sin que
nadie lo conectara.** `ROADMAP.md §1` registra el visto bueno del jefe así: *"flag viral confirmado
como concepto (~700K marca **high-end**, **no excluye**)"*. O sea que **su posición registrada sobre
viralidad es exactamente D3: marca, no excluye.**
⚠️ **Con una precisión que hay que hacer para no exagerarlo:** ese ~700K es `umbral_viral`, que mide
**seguidores**, no `min_views`, que mide **vistas**. **Son dos perillas distintas.** Lo que se
transfiere es el principio, no el número.

⚠️ **Queda ABIERTO y no lo decide un dev:** quién y cómo tiene esa conversación con Daniel. No se
asume que se dará, ni que saldrá bien. **Mientras no se dé, la medida relativa puede convivir con el
piso de 500k como orden y no como filtro, pero el pedido de negocio no cambia solo.**

### 🔴 Y hay una SEGUNDA raíz, descubierta el 12/09 por la sesión de proveedores (cierre 151)

> **El roster de referentes es físicamente demasiado chico para lo que el equipo pide.**

El equipo pide ~150 videos por semana. ✅ **Y el 12/09 se cerró de dónde sale ese número, que estaba
anotado como pregunta abierta: Mani — *"lo piden porque tienen sesiones de grabación con clientes que
los necesitan para sus redes"*.** O sea **demanda derivada de compromisos ya tomados**, no una
aspiración. Eso refuerza D1 (el N es piso duro) y quita del mapa la salida fácil de "bajémosle el N".

El techo del roster actual, **comprando todo y sin ningún filtro**, es de **59 a 218 reels crudos por
semana**, que después de `min_views` y del 39 % de
aprobación humana quedan en **0,6 a 45 aprobados**. Para llegar a 150 harían falta **301 a 1.115
referentes** (con `min_views` en 100.000). Con el piso en 500.000 harían falta 1.656-6.132 y **no
cabe en el cupo a ningún precio**.

**Las dos raíces interactúan, y en sentidos opuestos:**

- Arreglar la vara (§3.1-§3.2) hace que pase más material del que ya se compra.
- Arreglar la cadencia con marca de agua (§3.4) **abarata comprando menos**, que es **hostil al
  supply**.

🔑 **Lo que las reconcilia: la marca de agua no es un ahorro, es el PERMISO para multiplicar los
referentes por 12-40 dentro del mismo cupo.** Esa es la tesis de
[evaluacion-proveedores-scraping.md](./evaluacion-proveedores-scraping.md) y es lo que convierte dos
arreglos que parecían pelearse en un solo movimiento.

---

## §1 · Los hechos, y qué prueba cada uno

### §1.1 · Tabla de evidencia

Cada fila dice **qué se midió**, **con qué** y —la columna que faltaba en los otros documentos—
**qué NO prueba**.

| # | Hecho | Cómo se midió | Qué prueba | Qué NO prueba |
|---|---|---|---|---|
| 1 | `min_views` mata el 74-83 % del pool | 3 corridas del 10/09, `runs.metricas.filtrados_por_motivo` | Que el piso es el filtro dominante, con 3 señales independientes | Que el piso esté mal puesto (eso depende de qué quiere el equipo) |
| 2 | `cap_top_n = 250` **nunca muerde** | Mismas 3 corridas: sobreviven 15 / 14 / 6 | Que subirlo no cambia nada hoy | Que no vaya a morder cuando el piso baje |
| 3 | La velocidad de vistas se desploma con la edad | 1.741 reels pagados 2× con 52 min de diferencia (`costos.md §3.6`) | Que la tasa cae ~38× entre el día 0 y el día 6 | **Que llegue a cero.** Ver §1.2 |
| 4 | 74 % del gasto de un día es re-compra | 10/09: 10.351 reels pagados para 2.679 distintos, 17,63 de 23,83 USD | Que el solape es masivo y medido id por id | Que toda re-compra sea desperdicio (ver §3.4) |
| 5 | Ningún actor de Apify permite pedir "los más viejos" | Input schema de los 3 actores oficiales | Que el cursor siempre arranca del más nuevo | Que no exista otro proveedor que sí pueda |
| 6 | No hay costo fijo por corrida ni por cuenta | `usageTotalUsd / 0,0023` = el número exacto de reels | Que el costo es lineal en reels colectados: **0,0023 USD c/u** | Aplica al actor actual; `instagram-reel-scraper` **sí** cobra `actor-start` |
| 7 | Lo que el motor calcula no predice lo que el equipo aprueba | n=136 calificados con score | `heat_score ↔ aprobado` = **+0,044**; `relevancia_score ↔ aprobado` = **+0,041** | Que los scores sean inútiles: con n=136 tampoco se puede probar lo contrario |
| 8 | No hay evidencia de que una cuenta sea mejor que otra | 137 calificaciones, χ² = 15,9 sobre 11 gl ⇒ p ≈ 0,15 | Que hoy **no se puede** rankear cuentas por aprobación | Que las cuentas sean iguales: es falta de datos, no empate |
| 9 | El relleno NO se aprueba menos que lo que pasa el gate | Septiembre, mismo mes: gate 36,1 % (13/36), relleno **41,2 %** (28/68) | Que el relleno no es basura | Que el relleno sea igual de bueno (n chico) |
| 10 | El 65 % de los candidatos nunca se calificó | 249 de 386 | Que el cuello de botella es el termómetro, no el gate | — |
| 11 | Se paga por 529 reels por cada video entregado | `plan-costo-apify.md` | Que colecta y entrega están desacopladas | — |
| 12 | 5 cuentas = 24 % del gasto y 0 útiles | `costos.md §4.3` | Que podarlas baja USD/útil de 0,0155 a 0,0117 | — |
| 13 | 11 de 63 corridas están marcadas `fallo` y terminaron bien | Cierre 149 §1 | Que el norte de ADR-089 se calcula sobre un universo sucio | — |
| 14 | 🔴 **El roster no puede dar 150 videos/semana** | Techo físico del pool × tasas medidas (cierre 151) | Que faltan **301-1.115 referentes**, no presupuesto | El rango es 4× de ancho: depende del ritmo de publicación, que no está medido (ver #19) |
| 15 | **Apify bien usado cuesta 0,84-2,41 USD/mes** | Modelado sobre los datasets ya pagados de la exec 183 | Que el cupo de 50 USD aguanta **580-2.149 referentes** con marca de agua + cadencia semanal | — |
| 16 | 🩸 **Los 23,83 USD del 10/09 los causó disparar 5 tandas en un día**, no la ventana ni el actor | La exec 183 con la config actual **sin** marca de agua, a cadencia semanal, cuesta **4,45 USD/mes** (9 % del cupo) | Que el 74 % de re-compra del cierre 149 es re-compra **intradía** | — |
| 17 | ⛔ El add-on `transcript` de Apify cuesta **0,041 USD/minuto por reel** | `pricingInfos` de la API de Apify, tier BRONZE verificado contra el 0,0023 medido | Que es **26× más caro** que Supadata `auto` (0,001567) ⇒ la idea de sacar a Supadata del pipeline queda **cerrada con número** | — |
| 18 | Cambiar de proveedor de Apify no ahorra | `instagram-api-scraper` sale **+5,1 % más caro** al régimen real; `apidojo` ahorraría ~1,4 USD/mes | Que migrar cuesta remapear 23 campos y días de trabajo para ahorrar ≤29 USD/año | — |
| 19 | ⚠️ **El ledger de cuentas ve 3-6 referentes de los que se compran** | `runs.metricas.por_referente` de las 4 corridas del 10/09 | Que el agujero de §3.3 es real y grande: se compran ~59 cuentas y el ledger registra 3-6 | — |

### §1.2 · 🩸 La corrección del 2026-09-12: **las vistas no se congelan**

**Tres documentos daban por bueno que las vistas de un reel se congelan (a los 2 días en
`costos.md §3.6`, a los 7 en el handoff y en la propuesta de `madurez()`). El dato no lo soporta, y
Mani lo cazó preguntando de dónde salía.**

La medición es esta:

| edad al colectar | n | crecimiento en **52 min** |
|---|---|---|
| < 24 h | 19 | 2,29 % |
| 1-2 d | 16 | 0,38 % |
| 2-3 d | 21 | 0,19 % |
| 3-5 d | 36 | 0,12 % |
| 5-7 d | 45 | 0,06 % |
| > 7 d | 1.603 | **0,00 %** |

El `0,00 %` está **redondeado a dos decimales**, o sea que el crecimiento real está en `[0 ; 0,005 %)`
por cada 52 minutos. Llevado a escalas útiles:

```
0,005 % / 52 min  →  0,00577 %/hora  →  0,139 %/día  →  ~4,2 %/mes  →  ~66 %/año
```

**Un video que crece 66 % al año mide "0,00 %" en esta tabla.**

Y había una razón física para que ese bucket diera cero pasara lo que pasara: sus 1.603 reels tienen
mediana de **21.881 vistas**, así que creciendo 0,139 %/día ganarían **del orden de UNA vista** en 52
minutos. **La medición no tiene resolución para ver crecimiento lento.** Era una regla de
centímetros concluyendo que no existen los milímetros.

**Lo que la tabla sí prueba, y es sólido:** la velocidad se divide por ~38 entre el día 0 y el día 6.
Eso está muy por encima del ruido.

### §1.3 · 🟢 La medición que sí sirve, hecha el 12/09 — y salió GRATIS

**Mani, 12/09:** *"no deberíamos basarnos solamente en una ventana de 52 minutos. Medir el
crecimiento en un día, en una semana, en un mes. Y de varios videos, con los que ya tenemos
guardados, para no tener que pagar otra vez."*

🔑 **La salida estaba escondida en el desperdicio.** Las corridas re-compraron los mismos reels una y
otra vez (74 % del gasto de un día). Eso significa que **el mismo reel ya está medido en varias
fechas distintas**, dentro de datasets que ya se pagaron. Apify conserva runs desde el **2026-08-17**:
26 días de historia, miles de reels, **costo cero** (leer datasets no cobra).

> **La re-compra que veníamos contando como pérdida es, para esta pregunta, el activo.**

Resultado, cruzando datasets día contra día (mismo `shortCode`, dos fechas):

| de | a | días | reels en común | crecimiento mediano | subieron |
|---|---|---|---|---|---|
| 17/08 | 21/08 | 4 | 200 | +0,89 % | 198/200 |
| 17/08 | 24/08 | 7 | 193 | +1,19 % | 191/193 |
| 17/08 | 02/09 | 16 | 120 | +1,61 % | **120/120** |
| 17/08 | 07/09 | 21 | 122 | +1,92 % | **122/122** |
| 21/08 | 07/09 | 17 | 317 | +3,08 % | 316/317 |
| 24/08 | 07/09 | 14 | 331 | +2,79 % | 325/331 |
| 30/08 | 31/08 | 1 | 480 | +0,08 % | 475/480 |
| 31/08 | 01/09 | 1 | 1.081 | +0,02 % | 1.013/1.081 |
| 02/09 | 07/09 | 5 | 1.051 | +0,15 % | 921/1.051 |

**Tres lecturas:**

1. 🔴 **Los videos NO dejan de crecer nunca.** En cada ventana de varios días creció prácticamente
   **el 100 %** de los reels: 122 de 122, 120 de 120, 316 de 317. Y son reels que **ya eran viejos el
   17/08** (venían de una ventana de 200 días), o sea justamente los que se daban por congelados.
   **Segunda señal independiente, y esta sí tiene resolución para verlo.**
2. **Para un reel maduro la tasa es de 0,02 % a 0,10 % por día** (~1-3 % al mes). Cae **dentro** de la
   cota que §1.2 había calculado a mano (≤ 0,139 %/día, ~4,2 %/mes), así que las dos mediciones son
   consistentes: la de 52 minutos no estaba mal, estaba **ciega**.
3. ✅ **Y eso vuelve el problema manejable:** tratar como definitivas las vistas de un reel maduro
   mete un error de ~2-3 % sobre varias semanas. Es despreciable frente a lo que queremos distinguir
   (un video que hizo 3× lo normal de su cuenta).

⚠️ **Lo que esta medición NO contesta, y es la mitad que importa: la curva del reel JOVEN.**
Los pares de arriba son casi todos reels que **ya eran viejos en la primera medición**, así que
describen la cola, no el arranque. El tramo día 0 → día 7 sigue sin medirse, y es donde el
crecimiento es grande (2,29 % en 52 min para los de menos de 24 h).
**Se saca de los MISMOS datos, sin pagar:** los items de Apify traen `timestamp` de publicación, así
que basta filtrar los pares por *edad en la primera medición* y quedarse con los que eran nuevos.
Es una pasada más sobre lo ya descargado. **Tiene fecha de vencimiento: lo más viejo se cae un día
por día, y el 11/10 no queda nada.**

📏 *Nota de método: el conteo de "reels distintos por día" es una muestra (se leyeron hasta 14
datasets por día), no un censo. Los porcentajes de crecimiento sí son exactos: se calculan reel por
reel sobre los que aparecen en ambas fechas.*

### 🔁 Reproducible, y el dato está guardado

**El script:** [`docs/experimentos/crecimiento-historico-apify.mjs`](../experimentos/crecimiento-historico-apify.mjs)
— node pelado, solo lee, cuesta 0. `set -a && source .env && set +a && node docs/experimentos/crecimiento-historico-apify.mjs`

**El dato crudo:** [`docs/experimentos/2026-09-12-crecimiento-historico.json`](../experimentos/2026-09-12-crecimiento-historico.json)
— **434 runs conservados, del 2026-08-17 al 2026-09-11, 15 pares de fechas, 5.706 reels comparados,
de los cuales subieron 5.468 = 95,8 %.**

🩸 **Esto casi no se guarda.** La medición se hizo, se citó en prosa, y el script y la salida
quedaban en un scratchpad que se borra — **con datos que Apify elimina el 11/10**. Lo cazó Mani
preguntando *"¿el reporte del histórico de Apify lo incluiste?"*. *Un número medido y no guardado es
un número que hay que volver a medir, y acá volver a medirlo va a ser imposible.*

**Lo que se cae:** el concepto de *"vistas finales"*. Sin un techo, `vistas / madurez(edad)` no se
puede calcular, porque no hay a qué normalizar.

**Lo que lo reemplaza:** una **edad de referencia `D`**. En vez de proyectar al infinito, se
normaliza a *"cuántas vistas tendría este video a los D días"*. Los más nuevos que `D` se inflan;
los más viejos se desinflan un poco. Funciona exista o no exista el congelamiento.

🩸 **Y una segunda corrección, también de Mani (12/09): la curva NO se asume, se lee.** La primera
propuesta de `madurez()` traía adentro una forma inventada —*sube hasta el día 7 y ahí se queda
plana*— que es **un escalón**, y ninguna curva de vistas real se cae de un acantilado. *Eso era yo
imponiéndole una forma al modelo en vez de medirla.* La regla ahora: `avance(edad)` **no tiene
fórmula a priori**; es una tabla empírica que sale de §1.3, con la forma que tenga.

🔑 **Y `D` no es un parámetro técnico: es la pregunta *"¿cuánto tiempo le damos a un video para
demostrar que sirve?"*, que la contesta el equipo de medios.** Ver §5.1 Q1.

---

## §2 · El diagnóstico

```
        ┌─ vara absoluta (min_views global) ─┐
        │                                    │
   sesgo de edad                     sesgo de tamaño/nicho
        │                                    │
        ▼                                    ▼
 "los videos nuevos                  "un solo número para
  parecen malos"                      dos mundos distintos"
        │                                    │
        ├──────────────┬─────────────────────┤
        ▼              ▼                     ▼
  hay que comprar   el 83% muere        trading no entrega
  viejo y profundo  antes del gate      nunca (2,4% ≥ 500k)
        │              │
        ▼              ▼
  74% de re-compra   se paga 529 reels
  (17,63 USD/día)    por cada entrega
```

Todo cuelga de la misma raíz. Por eso el refactor no es una lista de parches: es **cambiar la vara**
y dejar que los síntomas se caigan solos.

---

## §3 · El diseño propuesto

Cinco piezas. Ninguna aplicada. Cada una dice de qué depende.

### §3.1 · `avance(edad)` — el corrector de edad *(interno, invisible al equipo)*

**Qué es.** Qué fracción de las vistas que tendrá a los `D` días ya tiene un video de edad `edad`.

```
vistas_normalizadas = vistas_hoy / avance(edad)
```

| variable | qué es | de dónde sale |
|---|---|---|
| `vistas_hoy` | vistas al momento de colectar | Apify, ya viene |
| `edad` | hoy menos fecha de publicación, en días | Apify, ya viene (`timestamp`) |
| `D` | edad de referencia | ❓ **decisión del equipo de medios** (§5.1 Q1) |
| `avance(edad)` | fracción en `(0 ; ~1]`, = 1,0 exactamente en `edad = D` | ❓ **no existe: la produce la medición de §5.2 M1** |

**Nombre.** Se descartó `madurez` (Mani: no le gusta y describe mal la cosa) y `crecimiento` (es la
*derivada*: qué tan rápido sube, no cuánto lleva acumulado). `avance` = *cuánto de la película ya se
reprodujo*.

**Es plomería.** El equipo de medios nunca lo ve.

### §3.2 · `viralidad` — la métrica del VIDEO

```
base_cuenta = mediana de vistas_normalizadas de los últimos ~30 reels de esa cuenta
viralidad   = vistas_normalizadas / base_cuenta
```

Es un **multiplicador**, no un número de vistas:

- `1,0` = un video normal para esa cuenta
- `3,0` = hizo 3× lo que esa cuenta suele hacer
- `10` = explotó

🔑 **Por qué un cociente y no un piso de vistas: un cociente no tiene escala, así que UN solo número
sirve para todos los proyectos.** Hoy el problema "`min_views` es global y no tiene `proyecto_id`"
exige una columna nueva, una pantalla nueva y un número que alguien calibre por cada cliente. Con
"al menos 3× lo normal de su cuenta", el 3 significa lo mismo en Vieira (mediana 22 k) que en
psicología (mediana 257 k). **El problema no se resuelve: desaparece.** Eso es lo que lo hace
sostenible cuando entre el cliente número 5.

⚠️ **Y `viralidad` ORDENA, no filtra** (decisión de Mani, §4 D3).

### §3.3 · Salud del referente — la métrica de la CUENTA

Dos números que **no se suman**, porque no hay con qué calibrar pesos (§4 D5):

**(a) ¿Vale la pena comprarle?** `mediana(vistas_normalizadas) / seguidores`.
Mide si su audiencia de verdad la ve. **No necesita una sola calificación humana**: se calcula hoy,
retroactivo, sobre todo el pool. Ordena a quién se le compra y qué tan profundo.

> ⚠️ **Tiene que anclarse a seguidores y no a la cuenta misma.** Si se ancla al propio promedio, toda
> cuenta da 1,0 por construcción y dejan de ser comparables entre sí. Es el mismo cociente que
> §3.2 pero con otro denominador, y ese detalle es todo el diseño.

**(b) ¿Nos gusta lo que trae?** `tasa_aprobacion`, como **veto** y no como puntaje, y solo con
muestra suficiente. *"Trajo 20 y no aprobaron ninguno, sácala"* es honesto con 20 datos; *"esta
cuenta vale 0,73"* no lo es. **Hoy (b) está bloqueado**: 137 calificaciones, p ≈ 0,15.

**Lo que ya existe y lo que le falta.** `app.v_salud_referentes` (migración `009`+`015`) devuelve 59
filas con `handle, videos_evaluados, tasa_gate, tasa_aprobacion, seguidores`. Tres agujeros:

1. **Solo mira 7 días** (`where r.inicio >= now() - interval '7 days'`). No acumula histórico.
2. **Le falta la mitad de arriba del embudo.** `evaluados` arranca *después* de `min_views` y de
   transcribir, así que **una cuenta que se compró entera y dio 0 útiles es invisible en la vista que
   existe para juzgar cuentas**. El arreglo son dos contadores (`comprados`, `paso_min_views`) en un
   nodo que ya existe.
   📏 **Medido el 12/09, y es peor de lo que la prosa sugería:** `runs.metricas.por_referente` de las
   4 corridas del 10/09 registra **3, 4, 3 y 6 referentes**. Se le compra a ~59. **El ledger ve entre
   el 5 % y el 10 % de las cuentas que se pagan.**
3. `tasa_aprobacion` está estadísticamente muerta (hecho #8).

### §3.4 · Marca de agua por referente — la ventana sin solape

**Cómo funciona hoy.** Por cada cuenta:
`{ directUrls, resultsType: 'reels', resultsLimit: <resultados_referente>, onlyPostsNewerThan: '<dias_recencia> days' }`.
El cursor arranca en el post **más nuevo** y baja; `resultsLimit` corta desde arriba.

> **Consecuencia que ningún documento había escrito: `dias_recencia` es casi inerte.** Con
> `resultsLimit = 25` y ventana de 50 días, el que corta primero es el 25. Los 50 días solo actúan en
> una cuenta que publica menos de 25 veces en 50 días. Para una cuenta activa, se pide "los 25 más
> nuevos" y punto. **Por eso dos corridas separadas por 52 minutos trajeron cero videos nuevos.**

**El cambio.** `onlyPostsNewerThan = fecha del video más nuevo que ya se compró de esa cuenta`.
Ahí el que corta es el **freno de fecha**, no el límite.

🔑 **Y con eso, ensanchar la ventana deja de costar.** Se paga por lo que vuelve, no por lo que se
pide. Si la cuenta publicó 5 reels desde la última corrida, se piden 25 y **se cobran 5**. El costo
pasa a ser `ritmo de publicación × tiempo desde la última corrida`, y nada más.

**Corrección a la intuición de Mani:** *"para buscar más tengo que aumentar ventana Y resultados"* es
cierto para el **backfill** (traer historia vieja, una vez por cuenta) y falso para el **régimen**.

**La cadencia.** Como el material nuevo tarda ~1 semana en existir, la cadencia natural es semanal.

🩸 **Y acá el cierre 151 corrigió el diagnóstico de costo entero:** *esta sección decía antes que el
régimen serían ~0,70 USD/semana, marcado como estimación mía. La medición real es mejor y dice algo
más incómodo.* La exec 183 **con la config actual y SIN marca de agua**, a cadencia semanal, cuesta
**4,45 USD/mes: el 9 % del cupo**. Con marca de agua baja a **0,84-2,41 USD/mes**.

> **Los 23,83 USD del 10/09 no los causó la ventana, ni el actor, ni la falta de
> `onlyPostsOlderThan`. Los causó disparar 5 tandas en un día.** El 74 % de re-compra del cierre 149
> es re-compra **intradía**. El proveedor nunca fue el problema; la cadencia sí, y es gratis.

⚠️ **Corolario que cambia la prioridad:** si el costo ya cabe sin marca de agua, entonces **la marca
de agua no se construye para ahorrar**. Se construye para poder pasar de 59 referentes a cientos
dentro del mismo cupo (§0, segunda raíz).

**La regla que cierra la re-compra:**

> **Solo se re-compra lo que todavía crece.**

Un video viejo casi no cambia, así que re-comprarlo es pagar por un número que ya se sabe. Y como la
marca de agua ya impide traer lo viejo, el único conjunto que se re-compra es *"lo publicado desde la
última corrida"*, que viene en la misma bolsa que lo nuevo: **la segunda oportunidad sale gratis**.

### §3.5 · `app.pool_crudo` — la tabla que falta

**Hoy `processed_items` guarda lo que se ENTREGÓ, no lo que se PAGÓ** (ADR-087). Medido: 1.952 filas,
pero solo 866 videos llegaron alguna vez al Feed ⇒ **1.401 (71,8 %) se pagaron, se quemaron y nadie
los vio**.

Sin una tabla de pool crudo (cuenta, `external_id`, fecha de publicación, vistas al comprar, corrida)
no hay:

1. marca de agua por referente (§3.4)
2. la mitad de arriba del ledger de cuentas (§3.3)
3. `ritmo_publicacion` para dimensionar `resultsLimit`
4. base de la cuenta para el cociente de §3.2
5. dónde guardar la cohorte de maduración

**Tamaño:** ~450 filas por corrida. Semanal son ~23 k filas al año. **No necesita expiración**, y no
se la pondría hasta que un número diga que hace falta.

🔴 **Tiene plazo: Apify (plan STARTER) borra sus datasets a los 31 días.** Todo lo que no se copie
antes del **2026-10-11** se pierde para siempre.

### §3.6 · Lo que se elimina o se degrada

| pieza | qué le pasa | por qué |
|---|---|---|
| `min_views = 500.000` | baja a **piso de basura** (~1.000) | Deja de seleccionar y pasa a barrer bots y videos rotos. Se mantiene un piso mínimo porque un video con 40 vistas divide feo en un cociente, y una cuenta nueva sin base necesita algo |
| `cap_top_n` | se queda como está | Es freno de gasto, no cupo de entrega. Hoy sobra (hecho #2). **Revisar cuando el piso baje**, ahí sí puede morder |
| `dias_recencia` | lo reemplaza la marca de agua | Es casi inerte (§3.4) |
| `resultados_referente` plano en 25 | pasa a `ceil(ritmo × días × 1,3)` | La profundidad deja de ser una decisión de calibrar |
| `heat_score` | sigue como desempate | ADR-090/092 ya lo decidieron. Correlación con aprobado: +0,044 |

---

## §3bis · 🧭 El reencuadre del 12/09: el motor no mata, ASIGNA · ORDENA · MIDE

**Mani, 12/09:** *"el workflow no es tanto de matar videos, sino de asignar, ordenar y medir.
Entonces tal vez el gate de relevancia no debe ser el embudo, sino el que asigna de la mejor manera.
Y esa relevancia hoy es full lenguaje natural: tal vez un formato estructurado."*

**Esto cierra el círculo con D3.** Si la métrica ordena (D3) y la relevancia asigna, **el motor deja
de tener filtros y pasa a ser un router con ranking.** Lo único que corta es el presupuesto, y eso es
honesto: *"alcanza para transcribir N, hago los mejores N"* es una frase distinta de *"estos son
malos"*.

### §3bis.1 · 🔑 El obstáculo real: hoy el gate NO PUEDE asignar

El fan-out arma pares (video × proyecto) y le pide al modelo **un puntaje independiente por par**,
usando la prosa de ese proyecto. **15 proyectos activos = 15 rúbricas y 15 escalas distintas.**
Entonces *"saca 0,7 en Trading y 0,6 en Storytelling ⇒ va a Trading"* compara números que **no son
comparables**.

> 🩸 **Es el MISMO bug que `min_views`, por segunda vez.** `min_views` compara videos de edades y
> cuentas distintas con un número absoluto. `relevancia_score` compara proyectos con puntajes
> absolutos producidos por rúbricas distintas. Los dos fallan por lo mismo: **un número absoluto
> usado como si fuera comparable.** Y el arreglo tiene la misma forma: **volverlo relativo.**

Para asignar: **una sola llamada que ve el video y los proyectos candidatos y los ordena entre sí**,
en vez de N llamadas independientes que emiten un puntaje cada una. Es una pregunta comparativa (lo
que los modelos hacen bien) en vez de N calibraciones absolutas (lo que hacen mal).

📏 **Y sale más barato**, medido en las corridas del 10/09: **2.516 videos colectados generan 4.734
pares** (1,88 proyectos por video). Pasar de puntuar por par a asignar por video **corta las llamadas
casi a la mitad**.

### §3bis.2 · 📏 Los criterios ya piden estructura: medido sobre los 15 proyectos activos

`criterios_relevancia` es prosa libre, mediana **879 caracteres** (min 367, max 1.343). 8 de 15
tienen además `criterios_aprendidos`. Adentro de esa prosa conviven **al menos seis tipos de regla
distintos**, y cada proyecto inventó su propio formato:

| proyecto | qué hay metido en el mismo campo |
|---|---|
| Comunicación para líderes | 🔑 **inventó un esquema a mano**: `RELEVANTE: … NO RELEVANTE: …` |
| Autoestima · Emociones | lista de temas en prosa (*"prioriza contenido que aborde X, Y, Z"*) |
| Trading fast tips | tema **+ formato** (*"corto/medianamente corto"*) **+ regla de cumplimiento** (*"no recomendaciones explícitas de inversión"*) |
| Marketing | 🔴 **criterios de CUENTA, no de video**: *"trae referentes que hagan…"*, *"cuentas con trayectoria o portafolio verificable"* |

**Tres hallazgos, y ninguno es estético:**

1. **El equipo ya intentó estructurar y el campo no lo dejó.** Ese `RELEVANTE / NO RELEVANTE` escrito
   a mano es alguien pidiendo un esquema. Como no existe, cada proyecto inventó el suyo.
2. **El campo está sobrecargado.** En Marketing hay criterios de *referente* donde van los de
   *video*, y el motor sólo aplica ese texto a videos: **esa mitad no la usa nadie.**
3. **Hay reglas que no son de relevancia sino de CUMPLIMIENTO.** *"No recomendaciones explícitas de
   inversión"* no es "fuera de tema", es "esto no se publica nunca". Hoy viven revueltas, así que una
   se puede perder cuando alguien reescribe la otra. **Deberían vivir aparte y por encima de los
   proyectos.**

⚠️ **Todo §3bis está ABIERTO: es un reencuadre, no un diseño.** No hay esquema propuesto, no hay
prompt escrito, no hay medición de si asignar comparativamente funciona mejor. El esquema, si se
hace, **sale de lo que el equipo ya escribió** (la tabla de arriba es su borrador) y de la Q3 del
mensaje, no de la cabeza de un dev.

---

## §4 · Decisiones ya tomadas — no re-litigar

| # | Decisión | Quién / cuándo | Fundamento |
|---|---|---|---|
| D1 | El N que pide el equipo es **piso duro**, no objetivo. El equipo descarta. | Mani, 11/09 | Respaldado por dato: el relleno aprueba 41,2 % contra 36,1 % del gate (hecho #9) |
| D2 | El relleno **se queda**, y es hoy la única fuente de contra-ejemplos del sistema | Mani, 11/09 | Si solo se entrega lo que el gate aprueba, el gate nunca ve lo que descartó |
| D3 | **La viralidad ORDENA, no filtra.** La herramienta trae y mide; el veto estricto lo hace el equipo de redes | Mani, 12/09 | Un filtro duro le da poder de veto a un número cuya correlación con lo aprobado es +0,044. Coherente con ADR-090 ("la métrica no rankea, desempata") |
| D4 | `p_a` **no** puede ser solo `tasa_aprobacion` | Mani, 12/09 | Bloqueada por muestra (hecho #8) |
| D5 | **No** se construye un puntaje ponderado (`0,6 × a + 0,4 × b`) | 12/09 | No hay con qué calibrar los pesos. Un número inventado con dos decimales se ve más confiable que uno honesto. Es el error que ya cometió `heat_score` |
| D6 | La concurrencia del motor queda como está | Mani, 10/09 | Prefiere corridas rápidas y medir |
| D7 | El botón ▶ queda bloqueado mientras dure el refactor | Mani, 12/09 | Commit `e4c1133` |

---

## §5 · Preguntas abiertas

**Partidas por quién las contesta.** Esta separación es el pedido explícito de Mani del 12/09:
*"decisiones de métricas para evaluar referentes y videos las define el equipo de medios, no yo; no
quiero asumir."*

### 🎯 El entregable NO son seis respuestas: es un protocolo de medición de éxito

Mani, 12/09, y esto reordena toda la sección:

> *"Lo que falta es que con el equipo de redes se defina un protocolo de medición de éxito de un
> video o de una cuenta bien establecido. Porque ahorita es, para cualquier cuenta que agreguemos y
> para cualquier video, 500.000 views. Y entonces toca scrapear demasiados videos para pescar los
> pocos que pasan ese umbral."*

**Ese encadenamiento es la tesis corta de todo este plan, y es mejor que la de §0.** §0 habla de "dos
raíces"; esto dice que es **una sola con dos salidas**: *umbral fijo para todo ⇒ pasan poquísimos ⇒
hay que comprar muchísimo para pescar esos pocos.* **La métrica mala no solo entrega mal: es la que
CAUSA el costo.**

Entonces el entregable de la conversación con el equipo es **un documento**, no un cuestionario. Tiene
que definir tres cosas, y hoy las tres están representadas por un `500000` en una casilla:

| # | Qué define | Preguntas que lo alimentan |
|---|---|---|
| **P1** | **Cuándo un video es medible** — cuánto tiempo se le da antes de juzgarlo (la `D` de §3.1) | Q1 |
| **P2** | **Qué hace exitoso a un VIDEO** — absoluto o relativo a su cuenta, y con qué número | Q2, Q6, bonus |
| **P3** | **Qué hace exitosa a una CUENTA** — con qué señal y con qué muestra mínima, para no juzgar con 3 datos | Q3, Q4, Q5 |

Después se vuelve ADR y el código lo implementa. **Sin P1-P3 escritos, cualquier número que se
ponga en el motor lo puso un dev por su cuenta, que es exactamente lo que pasó con el 500.000.**

### §5.1 · Las que decide el EQUIPO DE MEDIOS (Majo, Jero, el grupo del cockpit)

| id | Pregunta | Por qué bloquea | Estado |
|---|---|---|---|
| **Q1** | ¿Cuántos días le damos a un video para demostrar que sirve? (la `D` de §3.1) | Sin `D` no hay a qué normalizar y `avance()` no se puede definir | ⬜ sin preguntar |
| **Q2** | ¿"Buen video" es *muchas vistas*, o *más vistas de lo normal para esa cuenta*? | Decide si la métrica es absoluta o cociente. Todo §3.2 asume lo segundo | ⬜ sin preguntar |
| **Q3** | Al mirar una cuenta nueva, ¿qué miras primero y qué la descarta de una? | Define qué columnas van en el dashboard de referentes | ⬜ sin preguntar |
| **Q4** | Cuando llega un video que no sirve, ¿qué suele estar mal: el tema, la cuenta, o ese video? | Decide dónde poner el esfuerzo: gate, ledger de cuentas, o métrica del video | ⬜ sin preguntar |
| **Q5** | Si pudieras ver **una sola columna** al lado de cada cuenta para decidir si se queda, ¿cuál? | Define la pantalla de referentes. **Ni Mani ni un agente pueden inventarla** | ⬜ sin preguntar |
| **Q6** | 🆕 **Abierta:** ¿cómo es su proceso mental cuando salen a buscar videos? Qué miran, en qué orden, qué las hace parar en uno y seguir de largo en otro | Las otras 5 son cerradas y sirven para **decidir**; esta es abierta y sirve para **descubrir lo que no se me ocurrió preguntar**. Pedida por Mani el 12/09 | ⬜ sin preguntar |
| **Q7** | ¿El umbral de viralidad debería poder ser distinto por proyecto, o uno solo para todos? | Un cociente permite uno solo (§3.2). Confirmar que eso les sirve | ⬜ va como "bonus" en el mensaje |

### §5.2 · Las que decide una MEDICIÓN

| id | Pregunta | Cómo se contesta | Costo | Estado |
|---|---|---|---|---|
| ~~M1~~ | ~~¿Qué forma tiene `avance(edad)`? Re-medir la cohorte congelada~~ | ✅ **SUPERADA el 12/09 por un método mejor y gratis.** No hace falta comprar nada: la re-compra dejó el mismo reel medido en varias fechas dentro de datasets ya pagados (§1.3). 26 días de historia, miles de reels, **0 USD** |
| **M1-bis** | 🔴 **La curva del reel JOVEN (día 0 → día 7)**, que es la que falta | Misma fuente de §1.3, una pasada más: filtrar los pares por `timestamp` de publicación y quedarse con los que eran **nuevos en la primera medición** | **0 USD** | ⬜ **el número que desbloquea todo, y vence el 11/10** |
| **M2** | ¿Cuál es el `ritmo_publicacion` real de cada referente? | Del pool crudo (§3.5). 🆕 **O ya: una corrida con `resultsLimit = 100` y ventana de 14 d sobre el roster** — el rango actual es 59-218 reels/semana (4× de ancho) porque **14 de 26 cuentas topearon en `resultsLimit = 25`** y su historia está truncada | ~1,50 USD | ⬜ **es el número que cierra el cálculo de supply de §0** |
| **M5** | 🆕 ¿Cuántos reels trae una página de `user/medias/chunk` de HikerAPI? Cobra por PÁGINA: con 12+ sale **más barato que Apify**; con 1, 8,7× peor | Su trial de 100 requests | **0 USD** | ⬜ *el único número que podría dar vuelta un veredicto de proveedor* |
| **M3** | ¿La duración colisiona entre videos distintos del mismo creador? (ADR-086) | Las 3 consultas ya escritas en el handoff, después de la primera corrida de redes | 0 | ⛔ bloqueado por el ⛔ del botón |
| **M4** | ¿`cap_top_n` muerde cuando el piso baje? | Re-leer `filtrados` después del cambio de vara | 0 | ⬜ posterior |

> ✅ **El dilema "esperar vs cohorte sintética" que esta sección planteaba QUEDÓ RESUELTO, y por un
> tercer camino que no estaba sobre la mesa.** Decía que había que elegir entre esperar al 17/09 por
> pares longitudinales reales, o aceptar los supuestos de una cohorte sintética hoy. **No hace falta
> ninguno de los dos: los pares longitudinales reales YA EXISTEN**, dentro de los datasets que la
> re-compra pagó (§1.3). Cubren 26 días hacia atrás, no hay que esperar, y no cuestan nada.
> *Salió de que Mani rechazara basar la decisión en una ventana de 52 minutos.*

### §5.3 · Las que decide un DEV

| id | Pregunta | Estado |
|---|---|---|
| **T1** | ¿La marca de agua se guarda por `(referente)` o por `(referente, proyecto)`? Un referente puede alimentar varios proyectos (ADR-032, n-a-n) | ⬜ |
| **T2** | ¿`app.pool_crudo` es tabla nueva o una columna `entregado` en `processed_items`? | ⬜ |
| **T3** | ¿La `base_cuenta` de §3.2 se recalcula en cada corrida o se materializa? | ⬜ |
| ~~T4~~ | ~~¿Vale la pena el add-on `includeTranscript`?~~ | ✅ **CONTESTADA el 12/09 (cierre 151): NO.** Cuesta 0,041 USD/minuto por reel, **26× Supadata**. *El precio SÍ estaba en la API (`pricingInfos`); el handoff decía que no y era falso* |
| **T7** | 🆕 `skipPinnedPosts` (solo en `instagram-reel-scraper`): la fuga de posts fijados es 5,8 % hoy, pero pasa a **31 % de la factura** cuando la marca de agua baje el denominador | ⬜ **crece justo cuando se arregla la cadencia** |
| **T8** | 🆕 ¿Cuántos referentes activos hay realmente? `app.referentes` dice **59 activos**; el cierre 151 midió sobre **26 cuentas**. El cálculo de supply de §0 escala con ese número | ⬜ **sin resolver — no se eligió uno para no inventar** |
| **T5** | El arreglo del run que no cierra con cero entregas (cierre 149 §1) está diagnosticado y **no aplicado** | ⬜ |
| **T6** | La tarifa de Supadata en `app.tarifas` está mal por **5,7×** (dice 0,009 USD/video; es por crédito: `auto` = 1 crédito = 0,00157 USD, `generate` = 2 créditos/minuto) | ⬜ solo corregido en el doc |

---

## §5bis · 🚧 Restricciones de construcción — huecos que NO son preguntas para el equipo

Salieron del repaso del 12/09. **No bloquean, pero cualquier diseño que las ignore nace roto.**

| # | Restricción | Estado |
|---|---|---|
| **C1** | 🔴 **La herramienta tiene que poder explicarse en 3 a 5 pasos.** Pedido explícito de Mani (12/09): *"para el equipo de redes es muy importante que se pueda explicar en un paso a paso de 3, 4, máximo 5 pasos, y que se sepa qué pasa en cada uno."* **Es un criterio de aceptación del diseño, no un requisito de documentación.** Si el diseño no cabe en 5 pasos explicables, el diseño está mal. | ⬜ **abierta** |
| **C2** | ⚠️ **Sospecha de over-engineering, de Mani.** Va a abrir una sesión aparte a re-diseñar esto más simple. **Nada de este plan es definitivo por estar escrito acá.** | ⬜ sesión aparte |
| **C3** | **Arranque en frío de la fórmula.** `viralidad` necesita la base de la cuenta, y una cuenta recién agregada no tiene historia. Y vamos a agregar cientos (§0). **Sin diseñar.** | ⬜ **abierta** |
| **C4** | **`seguidores` es un denominador flojo** para juzgar cuentas (§3.3.a): se compran, y en Instagram hoy el alcance viene mucho del explore. Una cuenta de 5k puede hacer 500k sistemáticamente. **Es la parte más débil de todo lo propuesto**; debería salir de Q4/Q5 y no de un dev. | ⬜ **abierta** |
| **C5** | 🔴 **TikTok está muerto y ningún doc lo decía.** Los **59 referentes activos son TODOS de Instagram** (medido contra prod el 12/09) y las corridas traen `apify_tt: 1`. El eje de TikTok está prendido y no trae nada. **O se apaga, o se explica.** | ⬜ **abierta** |
| **C6** | **El protocolo de éxito necesita fecha de revisión.** Escrito una vez y nunca revisado, en seis meses es el 500.000 otra vez con mejor prosa. | ⬜ **abierta** |
| **C7** | **Nadie ha definido qué significa "aprobado".** El norte es `aprobados / N pedido`, pero aprobar es un clic humano sin criterio escrito. **Si el equipo aprueba de forma inconsistente, ninguna métrica puede correlacionar con eso.** Candidato a ser un P4 del protocolo. | ⬜ **abierta** |
| **C8** | **No vamos a poder saber si el cambio funcionó.** 65 % de los candidatos nunca se calificó, así que no hay con qué comparar la vara nueva contra la vieja. *Mani decidió sacar esto del mensaje al equipo y pedirlo aparte, otro día, como favor concreto.* | ⬜ **abierta** |

---

## §6 · Lo que NO vamos a hacer, y por qué

| Idea | Por qué no |
|---|---|
| Subir `cap_top_n` | No muerde. Sobreviven 14 de 250 de cupo (hecho #2). *Era el ítem #1 de la lista original de Mani* |
| Colectar "de viejo a nuevo" para tener vistas consolidadas | El actor no tiene `onlyPostsOlderThan`. Traer el rango entero y tirar lo nuevo **cuesta más** |
| Cambiar de proveedor por precio | ✅ **Cerrado con números el 12/09 (cierre 151).** Apify bien usado son 0,84-2,41 USD/mes. El "13 % más barato" de `instagram-api-scraper` sale **+5,1 % más caro** al régimen real (cobra por arranque y el motor arranca una corrida por cuenta). Migrar = remapear 23 campos de `Normalizar IG` + reescribir el pre-flight de cupo de ADR-094, para ahorrar ≤29 USD/año |
| Scrapear nosotros (instaloader, instagrapi, Agent-Reach) | El costo no es el código: son proxies, cuentas quemables y el ban cayendo sobre cuentas propias, para ahorrar ~29 USD/año. **Agent-Reach además no puede correr en el servidor de n8n**: su módulo de IG delega en OpenCLI, que maneja un Chrome real logueado y es desktop-only |
| Traer el transcript con el reel | 26× más caro que Supadata (hecho #17) |
| Calibrar el gate o el ranking ahora | 137 calificaciones. Detectar una mejora de 10 puntos sobre una base de ~40 % pide 300-400 |
| Ponerle expiración al pool crudo | ~23 k filas/año. YAGNI |
| Un puntaje ponderado de calidad de cuenta | D5 |

---

## §7 · Orden de ataque propuesto

**Nada de esto arranca hasta que §5.1 esté contestado.** Ese es el punto del plan.

| # | Paso | Depende de | Costo | Reversible |
|---|---|---|---|---|
| 0 | 🔴 **Sacar la curva del reel joven de los datasets ya pagados** (M1-bis) | — | **0 USD** | sí, y **vence el 11/10** |
| 1 | **Preguntarle al equipo de medios** (§5.1, los dos mensajes de §9) y con eso escribir el **protocolo de éxito P1-P3** | — | 0 | sí |
| 2 | Crear `app.pool_crudo` y empezar a llenarla | T1, T2 | 0 | sí |
| 3 | Copiar los datasets de Apify **antes del 2026-10-11** | paso 2 | 0 | ⛔ **no: lo que no se copie se pierde** |
| 4 | Correr M1 y construir `avance(edad)` | Q1, método de M1 | 0,35 USD | sí |
| 5 | Marca de agua + cadencia semanal | paso 2 | 0 | sí |
| 6 | Cambiar la vara: `min_views` a piso de basura, `viralidad` como orden | Q1, Q2, Q6, paso 4 | 0 | sí |
| 7 | Ledger de cuentas completo (2 contadores nuevos) + pantalla | Q3, Q5 | 0 | sí |
| 8 | Podar las 5 cuentas de 0 útiles | paso 7 | 0 | sí |
| 9 | 🔴 **Multiplicar el roster de referentes** (de ~59 a varios cientos) | pasos 5 y 7 | 0,84-2,41 USD/mes | sí |

**El paso 3 es el único con fecha de vencimiento dura.**

⚠️ **El paso 9 NO puede ir antes que el 6 y el 7, y esa es la advertencia más importante del plan.**
Lo dejó escrito el cierre 151: *multiplicar los referentes por 12 sin arreglar la vara multiplica por
12 el material que se juzga con algo que no mide* (correlación +0,044), y *sumar 300 cuentas sin el
ledger son 300 suscripciones que nadie cancela* — hoy ya hay 5 corriendo que se llevan el 24 % del
gasto y devuelven cero.

---

## §8 · Resumen sin jerga

**El problema.** La herramienta le pide a cada video que tenga al menos 500.000 reproducciones para
considerarlo. Ese número es el mismo para todos los clientes y para videos de cualquier edad. Eso
tiene tres defectos: castiga a los videos recién publicados (todavía no les dio tiempo), castiga a
las cuentas chicas (500 mil es imposible para ellas y fácil para una cuenta gigante), y no distingue
entre nichos (en trading, un video bueno tiene 22 mil reproducciones; en psicología, 257 mil).

**Lo que provoca.** Como la vara está alta, la herramienta sale a comprar videos viejos y a revisar
muy profundo en cada cuenta. De cada 100 videos que entran al filtro, 83 mueren ahí, antes de que
nadie los mire.

**El segundo problema, y probablemente el más grande.** Aunque arreglemos la vara, **no hay de dónde
sacar 150 videos por semana**. Hoy seguimos a unas 59 cuentas. Entre todas publican, como mucho,
entre 59 y 218 reels por semana, y de ahí sobreviven al filtro y a la aprobación del equipo entre 1 y
45. Para llegar a 150 harían falta **varios cientos de cuentas**. No es un problema de dinero: la
plata alcanza de sobra. Es que el conjunto de cuentas que seguimos es demasiado chico.

**Sobre el gasto, una corrección.** Se creía que la herramienta era cara. No lo es: usada bien cuesta
entre 1 y 3 dólares al mes, y el tope disponible es 50. Los 24 dólares que se gastaron en un solo día
se explican por haberla disparado **5 veces ese día**, no por cómo está construida. Corriéndola una
vez por semana el problema desaparece sin cambiar una línea de código.

**La propuesta.** Cambiar la vara. En vez de *"¿tiene más de 500 mil reproducciones?"*, preguntar
*"¿le fue mejor de lo que normalmente le va a esta cuenta?"*. Es una comparación relativa, así que un
mismo número sirve para todos los clientes sin tener que configurar nada por cliente. Y además la
herramienta **no descarta** por ese número: solo lo usa para ordenar y mostrar los mejores primero.
Quien decide qué sirve sigue siendo el equipo de redes.

Y con la plata sobrando, lo que la marca de agua habilita no es ahorrar: es **poder seguir a cientos
de cuentas en vez de 59, dentro del mismo tope**.

**Lo que hace falta antes de construir.** Dos cosas.

La primera: **un protocolo de medición de éxito, acordado con el equipo de redes.** Hoy el criterio
es un solo número (500.000 reproducciones) que aplica igual a toda cuenta y a todo video, y de ahí
sale todo lo demás: como pasan poquísimos, hay que comprar muchísimo para pescar esos pocos. Hace
falta escribir tres cosas: cuánto tiempo se le da a un video antes de juzgarlo, qué hace bueno a un
video, y qué hace buena a una cuenta. Eso no lo puede inventar un programador. Está en §5.1 y hay
dos mensajes listos en §9.

La segunda: **una medición que cuesta 0,35 dólares** y todavía no se corrió. Sirve para saber cuánto
crece un video según su edad, que es lo que permite comparar uno de 2 días con uno de 2 meses.

**Una corrección importante de esta sesión, en dos tiempos.** Tres documentos del repo decían que un
video deja de sumar reproducciones a los 2 o a los 7 días. Mani preguntó de dónde salía eso y
resultó que la medición se había hecho con **52 minutos** de diferencia: con esa ventana, un video
que crece 66 % al año igual aparece como "0,00 %".

Después Mani puso el dedo en el problema de fondo: *una ventana de 52 minutos solo puede ver lo que
cambia en 52 minutos; había que medir en días, semanas y meses, y con los videos que ya teníamos
guardados para no pagar otra vez*. **Se hizo, y salió gratis.** Como la herramienta venía comprando
los mismos videos una y otra vez, resulta que ya teníamos cada video medido en varias fechas. 26
días de historia, miles de videos, cero pesos.

**El resultado: los videos no dejan de crecer nunca.** En cada ventana de varias semanas creció
prácticamente el 100 % de ellos (122 de 122 en una, 120 de 120 en otra), incluso los que ya eran
viejos. Crecen poco, entre 1 % y 3 % al mes, pero nunca se detienen. *Lo que sobraba en la
herramienta resultó ser justo lo que hacía falta para contestar esto.* Está en §1.3.

**Lo que todavía falta medir** es cuánto crece un video en sus **primeros días**, que es cuando más
se mueve. Sale de los mismos datos y tampoco cuesta, pero hay que hacerlo antes del 11 de octubre:
lo más viejo se borra un día por día.

**Un riesgo de orden, para no equivocarse.** Es tentador salir a sumar cuentas ya, porque es lo que
más falta. Sería un error: hoy la herramienta no sabe distinguir un video bueno de uno malo (se
midió: lo que calcula casi no tiene relación con lo que el equipo termina aprobando), y tampoco sabe
decir qué cuentas sirven y cuáles no. Sumar 300 cuentas antes de arreglar esas dos cosas es
multiplicar por 300 un problema en vez de resolverlo. Primero la vara y el tablero de cuentas,
después el crecimiento.

**Estado.** El botón de "buscar contenido" está desactivado a propósito mientras esto se arregla, y
dice "Bajo construcción por dev". No se perdió nada: los datos están, y lo único con fecha de
vencimiento es copiar de Apify lo ya pagado antes del 11 de octubre.

---

## §9 · Los dos mensajes para el equipo de medios

> Versión final del 2026-09-12. **Revisados por Mani y NO ENVIADOS** (decidió cerrar la sesión antes
> de mandarlos). Grupo: *Cockpit - Pipeline de Contenido*, `120363431388941740@g.us`. Van en
> **singular** y sin jerga. Mensaje 1 = las preguntas; mensaje 2 = el contexto, se manda después.
>
> 🚩 **Lo que Mani decidió SACAR, anotado para que nadie lo "recupere" creyendo que fue olvido:**
> (1) el marco de *"encontré tres cosas rotas"*, porque el mensaje no es una confesión; (2) que la
> herramienta no está aprendiendo (65 % sin calificar) — se pide aparte, como favor concreto;
> (3) que el costo no era el problema; (4) **la promesa de cadencia semanal** — se quitó al final,
> así que **cuando el botón vuelva con menos frecuencia el equipo no va a estar avisado**;
> (5) la pregunta por el origen del N, contestada por Mani (§0).

### Mensaje 1 — las preguntas

```
Qué más team? Estoy reconstruyendo la parte del buscador de reels que decide qué videos
les llegan. Hay unas decisiones ahí que son de criterio de ustedes, no mías, y no quiero
tomarlas yo desde el código. Son 8 preguntas, contesten como les salga:

1. Un video "bueno" para ustedes, ¿es el que tiene muchas vistas en general, o el que
   tiene más vistas de lo normal para esa cuenta? Ejemplo: uno de 80 mil vistas en una
   cuenta que suele hacer 20 mil, contra uno de 300 mil en una cuenta que suele hacer 2
   millones. ¿Cuál les sirve más?

2. Cuando un reel se acaba de publicar todavía no juntó sus vistas. ¿Cuántos días hay que
   esperar para saber si le fue bien? ¿2, 7, 30?

3. Si tuvieran que explicarle a alguien nuevo qué videos sirven para un proyecto y cuáles
   no, ¿cómo se lo explicarían? Y aparte: ¿hay cosas que nunca sirven, para ningún
   proyecto, pase lo que pase?

4. Cuando miran una cuenta nueva para decidir si la agregan como referente, ¿qué es lo
   primero que miran? ¿Y qué las hace descartarla de una?

5. Si pudieran ver UNA sola columna al lado de cada cuenta para decidir si la dejan o la
   sacan, ¿cuál sería?

6. Cuando el buscador les trae un video que no sirve, ¿qué suele estar mal: el tema, la
   cuenta de donde salió, o ese video en particular?

7. Y una más suelta: quiero saber cuál es su proceso para sacar videos.

8. ¿Preferirían poder pedir un mínimo de "qué tan viral" tiene que ser un video antes de
   que les llegue, o prefieren que les muestre todo ordenado de mejor a peor y ustedes
   descartan?

Mientras tanto el botón de "Buscar contenido" va a estar desactivado unos días, dice
"Bajo construcción por dev". Les aviso cuando vuelva.
```

### Mensaje 2 — el contexto (va después del 1)

```
Les cuento cómo funciona la herramienta hoy y hacia dónde la estoy llevando, para que las
preguntas tengan sentido.

*Cómo funciona hoy.* Cada corrida hace cuatro cosas seguidas: (1) va a las cuentas de
referentes que tenemos cargadas y se baja los reels nuevos, (2) se queda solo con los que
pasan cierto número de vistas, (3) le saca el texto hablado a los que quedaron, y (4) una
IA lee ese texto y decide si el tema le sirve al proyecto. Lo que sobrevive los cuatro
pasos es lo que les aparece en el Feed.

*El reality check, y por eso escribo.* Hoy el paso 2 usa un número fijo de vistas, el
mismo para toda cuenta y todo proyecto. Estos son los números reales de lo que eso
produce: en los proyectos de trading, la mediana de vistas de los reels que traemos es de
unas 22 mil, y solo el 2% de ellos pasa el medio millón. En psicología y comunicación la
mediana es de 256 mil y pasa un tercio. Es el mismo umbral haciendo dos cosas opuestas
según el nicho. En la práctica, en trading eso significa que para llenar un pedido de 70
videos el material que califica son unos 5.

*Lo que propongo.* Que el número de vistas deje de ser un requisito y pase a ser un
*medidor de viralidad*: en vez de "¿pasó el medio millón?", medir "¿le fue mejor de lo
normal para esa cuenta?".

Así quedaría en concreto. Una cuenta que normalmente hace 20 mil vistas por reel saca uno
de 60 mil: eso es 3 veces lo normal de ella, y ese número se los muestro al lado del
video. Otra que normalmente hace 2 millones saca uno de 900 mil: le fue por debajo de lo
suyo, así que aparece más abajo aunque el número absoluto sea mucho mayor. ¿Les cuadra que
funcione así, o se les ocurre algún caso donde esto les dé vuelta algo que ustedes sí
querrían ver? Esa es la pregunta que más me sirve, porque es la que puede romper la idea
antes de que la construya.

Como es una comparación y no un número, el mismo criterio sirve para todos los proyectos,
sin configurar un umbral distinto para trading, para psicología y para lo que venga.

*Y acá está el cambio de fondo, que es más importante que la fórmula.* Si el filtro de
vistas deja de ser el que decide, el peso pasa entero a la calidad de los referentes. Un
buen referente da buenos videos casi solo; uno malo no lo salva ningún filtro, y hoy los
estamos juzgando con muy poca información. Quiero que la pestaña de Referentes se vuelva
un tablero de verdad, donde se vea cuáles están rindiendo y cuáles no, y que la lista
crezca bastante.

*Por eso pregunto lo de los días.* Para comparar un reel de ayer con uno de hace un mes
hay que tener en cuenta que el de ayer todavía no terminó de juntar vistas. Ya estoy
midiendo cuánto crece un reel con el tiempo para corregir eso. Pero cuánto tiempo le damos
antes de juzgarlo es decisión de ustedes.

Las preguntas 4, 5 y 7 son las que más me sirven: yo puedo construir el tablero, pero el
criterio de qué hace buena a una cuenta es de ustedes.
```

### ⚠️ Lo que queda ABIERTO sobre estos mensajes

- **No están enviados.** Falta luz verde de Mani.
- 🔴 **El párrafo del reality check nombra el medio millón con números, y el medio millón es un
  pedido del jefe (§0).** Va dirigido a Majo y Jero, que son quienes lo reciben, pero puede llegarle
  a Daniel de rebote y dicho por Mani. **Se le planteó la alternativa —sacarlo del mensaje y dar esa
  conversación directo, con los mismos números— y no eligió.** Sin decidir.
- El mensaje 2 describe el paso 4 como *"decide si el tema le sirve"*. Con §3bis eso pasaría a
  **asignar** en vez de descartar, pero no está construido ni decidido, así que **se dejó la
  descripción vieja a propósito.**

### Lo que el mensaje 2 promete, y hay que cumplir

| promesa | dónde vive |
|---|---|
| el número de vistas pasa a ser un medidor, no un requisito | §3.2 |
| mostrarles el múltiplo al lado del video | §3.2 — **no está construido en el cockpit** |
| un solo criterio para todos los proyectos | §3.2 (un cociente no tiene escala) |
| "ya estoy midiendo cuánto crece un reel" | §1.3 (hecho) + M1-bis (falta el tramo joven) |
| el peso pasa a la calidad de los referentes | §3.3 y §0, depende de Q4/Q5 |
| tablero de referentes de verdad | §3.3 |
| que la lista de cuentas crezca | §0, paso 9 de §7 |

**No se prometió ninguna fecha, a propósito.**

---

## §10 · Auditoría de `docs/` — qué sobra, qué falta y qué duele

> Pedido de Mani el 12/09: *"la carpeta de docs está llena de vainas viejas, revisá qué podemos
> borrar para que esto quede como el punto de partida."*
>
> ✅ **EJECUTADO el 2026-09-12, con su visto bueno.** `handoff.md` pasó de **8.334 a ~1.300 líneas**
> y los 4 planes ejecutados están en [`docs/archivo/`](../archivo/). **Cero borrados.** Se
> re-apuntaron **~90 links** en 24 archivos y se verificó con un chequeo de links repo-wide: **0
> rotos causados por el movimiento** (quedan 5 previos, listados en §10.5).

### §10.1 · El problema real no son los planes viejos: es el handoff

| archivo | líneas |
|---|---|
| **`docs/agents/handoff.md`** | **8.215** |
| `docs/agents/plan-multi-tenant.md` | 1.638 |
| `docs/archivo/plan-orden-y-filtro.md` | 1.305 |
| `docs/verificaciones-humanas.md` | 1.117 |
| `docs/agents/plan-transcript-completo.md` | 1.051 |
| *(los otros 100+ archivos)* | < 1.000 c/u |

El handoff es **el doble del segundo más grande de todo el repo**, y es justamente el que dice
"leelo al empezar la sesión". Nadie lee 8.215 líneas, así que en la práctica se lee el encabezado y
el resto es peso muerto que igual entra al contexto de cada agente.

Y tiene un síntoma estructural visible: **cuatro secciones "ARRANCÁ POR ACÁ" apiladas** (líneas 23,
142, 300, y una marcada 🪦 SUPERSEDED en la 6987). Cuatro puertas de entrada es ninguna.

**Propuesta:** rotar. Dejar el protocolo + el ARRANCÁ vigente + los últimos ~6 cierres, y mover el
resto a `docs/agents/handoff-archivo-2026-06_08.md`. Queda en ~800 líneas y no se pierde nada (el
archivo sigue en el repo, y git tiene todo igual).

### §10.2 · Planes ya ejecutados — candidatos a archivar

| archivo | líneas | estado | evidencia |
|---|---|---|---|
| `plan-orden-y-filtro.md` | 1.305 | ✅ ejecutado y live | *"✅ EJECUTADO Y LIVE — 2026-08-26, las 7 tareas cerradas y desplegadas"* |
| `mapa-campos.md` | 637 | 🪦 obsoleto | Mapea Airtable, purgado el 2026-08-03. Ya tiene su aviso de vigencia |
| `plan-cockpit-propio.md` | 577 | ✅ construido | El cockpit está en producción con 17 pantallas |
| `plan-rescate-huerfanos.md` | 396 | ✅ ejecutado | *"✅ RESULTADO — corrida 2026-08-31 04:30, cerrada ok en 13 min"* |

**2.915 líneas.** Recomiendo **mover a `docs/archivo/`, no borrar**: git conserva el contenido igual,
pero borrar pierde la capacidad de encontrarlo cuando alguien pregunte *"¿por qué esta pantalla
ordena así?"*. Mover cuesta lo mismo y no tiene downside.

### §10.3 · Vivos — no tocar

`plan-cascada-de-entrega` (pendiente vivo) · `plan-costo-apify` (base de este refactor) ·
`evaluacion-proveedores-scraping` (nuevo, 12/09) · `plan-transcript-completo` (tareas 8-11 abiertas) ·
`plan-modo-seleccion` (acordado, sin construir) · `plan-motor-linkedin` (⛔ producto) ·
`plan-multi-tenant` (Fase 5 pendiente) · `refactor-voces-proyectos` (tablero activo) ·
`verificaciones-humanas` (4 abiertas) · `context` · `dev-doc` · `costos` · los runbooks.

### §10.4 · Los 97 ADRs NO se tocan

Son el registro permanente de por qué el sistema es como es, una decisión por archivo, y varios
siguen gobernando código vivo. Un ADR viejo no es un ADR obsoleto: es historia que se cita. El índice
(`docs/adr/README.md`) ya los ordena.

### §10.5 · 🩸 Lo que la auditoría encontró de paso

- **`plan-modo-seleccion.md §Fase 4` dice "A revisar el 2026-09-04"** para los cinco canarios de
  adopción. Hoy es el **12/09**: nadie los miró. Es exactamente el patrón que el `CLAUDE.md` global
  de Mani ya tiene documentado con sangre: *el trabajo con fecha que nadie agenda se ve idéntico al
  que no tiene fecha.*
- **El `CLAUDE.md` del repo dice "ADRs 001-097 (97 archivos)" y en disco hay 97.** Por una vez
  coincide. *Ese mismo renglón ya estuvo mal dos veces (dijo 083 con 84, y 094 con 97), y por eso el
  propio doc aclara que el número sale de `ls docs/adr`.*
- **Este documento hay que registrarlo** en el mapa de docs del `CLAUDE.md` del repo, o nace
  invisible para el próximo agente. Pendiente.

---

## §11 · Estado al cerrar la sesión del 2026-09-12

> Este plan nació y creció en una sola sesión de brainstorm. **Cero código del motor tocado, cero
> corridas, cero migraciones.** Lo único que se aplicó al producto fue **bloquear el botón ▶**
> (commit `e4c1133`). Todo lo demás es diagnóstico y diseño propuesto.

### Lo que se hizo

| | |
|---|---|
| **Bloqueado** | el ▶ del cockpit, botón + server action, flag único en `operar/bloqueo.ts` |
| **Medido contra prod** | `cap_top_n` nunca muerde (15/14/6 de 250) · `min_views` mata 74-83 % · el ledger ve 3-6 de ~59 cuentas · 59 referentes activos, **todos Instagram** · 15 proyectos activos piden N=320 · criterios: mediana 879 chars de prosa libre · 2.516 videos → 4.734 pares |
| **Medido gratis, longitudinal** | 26 días de historia de datasets ya pagados: **las vistas no se congelan**, creció ~100 % en cada ventana de semanas (§1.3) |
| **Ordenado** | `docs/` auditado, handoff rotado 8.334 → ~1.300, 4 planes archivados (§10) |
| **Escrito** | los dos mensajes para el equipo (§9), sin enviar |

### Lo que quedó DECIDIDO (§4 + esta sesión)

D1 el N es piso duro · D2 el relleno se queda · D3 **la viralidad ordena, no filtra** · D4 `p_a` no
es sólo `tasa_aprobacion` · D5 nada de puntajes ponderados sin con qué calibrar · D6 la concurrencia
queda igual · D7 el ▶ bloqueado · **D8 (12/09): el motor no mata, asigna · ordena · mide** (§3bis) ·
**D9 (12/09): la curva de crecimiento no se asume, se lee** (§1.3).

### 🔴 Lo que quedó ABIERTO — nada de esto se decidió, y no hay que asumirlo

| # | Abierto | Quién lo cierra |
|---|---|---|
| 1 | **Mandar o no los dos mensajes**, y si el párrafo del reality check va adentro o se lo dice Mani directo a Daniel | Mani |
| 2 | **P1 · P2 · P3**, el protocolo de medición de éxito | equipo de redes (§5.1) |
| 3 | **La conversación con Daniel sobre qué significa accuracy.** Hay dos definiciones en conflicto y el 500k es instrucción suya (§0) | Mani, sin fecha |
| 4 | **M1-bis**, la curva del reel joven. Gratis, y **vence el 2026-10-11** | un dev, 0 USD |
| 5 | **Todo §3bis**: esquema estructurado de criterios, prompt comparativo, y si asignar funciona mejor. **Es un reencuadre, no un diseño** | sesión aparte |
| 6 | **C1-C8** (§5bis): explicable en 5 pasos · sospecha de over-engineering · arranque en frío · `seguidores` como denominador flojo · **TikTok muerto** · revisión del protocolo · qué significa "aprobado" · no hay con qué validar el cambio | varios |
| 7 | **T1 · T2 · T3 · T5 · T6 · T7 · T8** (§5.3), incluida la discrepancia **26 vs 59 referentes** | un dev |
| 8 | Copiar los datasets de Apify **antes del 2026-10-11** | un dev |

### 🩸 Las cuatro correcciones que esta sesión le hizo a sus propias conclusiones

Van escritas porque el patrón se repitió, y es el mismo: **un número o una forma que nadie verificó,
citado como si estuviera medido.**

1. **`cap_top_n` no era el techo.** El handoff lo llamaba "techo estructural"; nunca muerde.
2. **Las vistas no se congelan.** Tres docs lo daban por bueno sobre 52 minutos de medición.
3. **La curva no tiene escalón.** `madurez()` traía una forma inventada adentro.
4. **El proveedor nunca fue el problema.** Era la cadencia, y es gratis.

*Las cuatro las disparó Mani preguntando de dónde salía el número, no un agente revisando su trabajo.*

---

## §12 · 🗂️ La sesión de consolidación de docs — dedicada, y se descarta al terminar

> Decidido por Mani el 2026-09-12 al cierre: **esto va en su propia sesión, literal solo para esto, y
> después se descarta.** No se ejecutó nada.

### El diagnóstico: el problema NO es cuántos docs hay

La regla que lo arreglaría **ya está escrita** en el `CLAUDE.md` del repo —*"Docs lean: un hecho, un
dueño"*— y todo lo que se rompió esta sesión fue una violación de ella, no falta de regla:

- *"las vistas se congelan"* vivía en **3 docs con dos números distintos** (48 horas y 7 días) para
  la misma tabla
- el conteo de referentes en 2 lugares con dos cifras (**26** y **59**)
- *"374 eventos, volvieron dos"* estaba en **3 copias que vencieron el mismo día**
- 🩸 `costos.md §4.3.2` **ya había medido la métrica relativa** y nadie la citó, así que esta sesión
  la volvió a descubrir desde cero

> **Mergear 22 docs en 4 sin cambiar eso deja 4 docs que se contradicen ADENTRO.** El conteo baja y
> el problema no.

**Pero sí sobran docs, y la causa es estructural:** cada `plan-*.md` mezcla **cuatro cosas que
envejecen a velocidades distintas** — estado (días), decisiones (permanentes), mediciones (datos) y
diseño (temporal). *Mezcladas en un archivo, el conjunto se pudre a la velocidad de la parte más
rápida.*

### La estructura propuesta: 4 tipos, cada uno contesta UNA pregunta

| pregunta | dónde | por qué |
|---|---|---|
| **¿Por qué es así?** | `docs/adr/` | **El único tipo que no se pudrió en 4 meses.** Un archivo, una decisión, siempre enlazado. No tocar |
| **¿Qué queremos?** | `ROADMAP.md` | Uno, y ya manda sobre los demás |
| **¿Cómo está hoy?** | `docs/agents/handoff.md` | Uno, recién rotado |
| **¿Cómo funciona / se opera?** | `dev-doc` · `context` · `runbooks` · `onboarding` | Referencia, cambia despacio |

**Y los `plan-*.md` no son un quinto tipo: son temporales por definición.** La regla propuesta:
cuando un plan se ejecuta **se desarma en los cuatro** (decisiones → ADR · mediciones →
`docs/experimentos/` · estado → handoff · el archivo → `docs/archivo/`) y deja de existir. *Se hizo
a mano con 4 de ellos el 12/09; la idea es que sea la regla y no una limpieza excepcional.*

### Los merges concretos, medidos

**22 docs vivos, ~13.000 líneas. Los `plan-*.md` son 5.100 en 7 archivos.**

| doc | líneas | propuesta |
|---|---|---|
| `plan-costo-apify.md` | 350 | **mergear en `costos.md`**. Su tesis murió el 12/09; lo que sobrevive es mecánica que pertenece al mapa monetario. Así *"cuánto cuesta"* tiene **una sola puerta** |
| `evaluacion-proveedores-scraping.md` | 554 | su veredicto son **5 hechos**: un ADR (*"el proveedor no es el problema, la cadencia sí"*) + los números a `costos.md`, el resto al archivo |
| `refactor-voces-proyectos.md` | 467 | el handoff lo llama *"tablero activo"* pero es de **julio**, era Airtable, y sus componentes D y E están ✅. ⚠️ **Verificar si sigue vivo ANTES de archivarlo** |
| `plan-modo-seleccion.md` | 291 | *"acordado sin construir"* desde el 21/08. O se construye, o su decisión es un ADR + una tarea y el plan se va |
| `PLAN.md §3.1` | — | es una **tabla-resumen de ADRs**: duplicado literal de `docs/adr/README.md`. Se reemplaza por un link |

**≈1.600 líneas menos y dos docs menos donde el costo puede contradecirse a sí mismo.**

### El script, y por qué va con advertencia

`CLAUDE.md` son **563 líneas escritas a mano que se desincronizan solas**: dijo *"083 ADRs"* con 84
en disco, y *"094"* con 97. El 12/09 se rompieron **~90 links** moviendo archivos y se encontraron
porque a alguien se le ocurrió chequear, **no porque algo avisara**.

Propuesta: ~40 líneas en `core/scripts`, al lado de `validate`, que falle si (a) hay links `.md`
rotos, (b) un doc vivo no está en el mapa del `CLAUDE.md`, o (c) el mapa apunta a algo archivado.
*El chequeador de links ya se escribió inline el 12/09; sería formalizarlo.*

⚠️ **Advertencia que va con la propuesta:** es **una pieza nueva que mantener**, y Mani viene
sospechando de over-engineering (§5bis C2). **Si suena a eso, la regla sola (un hecho, un dueño) más
los merges de arriba ya son el 80 %.**

### ⚠️ Antes de ejecutar

**Verificar que el diagnóstico siga vigente.** Entre esta nota y esa sesión va la **sesión de
simplificar el motor** (§5bis C2), que puede matar `plan-refactor-motor.md` entero y cambiar la
lista. *Un plan de limpieza que no se re-mide antes de correr limpia el mapa de ayer.*
