# ADR-098 — El proveedor no es el problema, la cadencia sí

- **Estado:** aceptada — 2026-09-12. **No toca `core/`**: no hay migración, ni código, ni cambio de
  proveedor. Es el veredicto de una evaluación, registrado para que no se vuelva a hacer.
- **Alcance deliberadamente chico.** Esta ADR decide **una sola cosa: Apify se queda.** Lo que la
  evaluación proponía *además* —bajar `min_views` a 100.000 y multiplicar el roster de 26 a ~300—
  **queda explícitamente fuera y sigue abierto**, porque depende de una conversación que no decide
  un dev (§Lo que esta ADR NO decide).
- **Material completo:** [docs/archivo/evaluacion-proveedores-scraping.md](../archivo/evaluacion-proveedores-scraping.md)
  (554 líneas, 5 actores de Apify y 7 alternativas externas con precio de primera mano). Los números
  monetarios viven en [costos.md](../costos.md).

## Contexto

Encargo de Mani, 2026-09-12: *"evaluar alternativas al actor de Apify que hoy usa el motor y traer
una recomendación argumentada con números, sin implementar nada"*.

El disparador era una factura: **23,83 USD el 2026-09-10**, la mitad del cupo mensual de 50 USD
consumida en 21 horas. La hipótesis de trabajo era que el actor `apify/instagram-scraper` era caro y
había que cambiarlo.

## La decisión

**Apify se queda. El esfuerzo se mueve de "cambiar de proveedor" a "arreglar la cadencia".**

## Por qué — los cinco hechos que la sostienen

Todos medidos el 2026-09-12 contra datos ya pagados, ninguno citado de un doc.

1. 🩸 **Los 23,83 USD no los causó el proveedor: los causó apretar el botón 5 veces en un día.**
   La exec 183, con la config de entonces y **sin** ninguna mejora, a cadencia semanal cuesta
   **4,45 USD/mes — el 9 % del cupo.** El 74 % de re-compra medido en el cierre 149 es re-compra
   **intradía**: dos tandas separadas por 52 minutos trajeron cero videos nuevos.
2. 🟢 **Apify bien usado cuesta 0,84 a 2,41 USD/mes** (marca de agua por referente + una corrida por
   semana), contra un cupo de 50. A ese régimen el cupo aguanta **580 a 2.149 referentes**; hoy hay
   26.
3. ⛔ **Ningún proveedor evaluado ahorra más de ~29 USD/año, y el remapeo de 23 campos cuesta más
   que eso.** Se miraron 5 actores de Apify y 7 alternativas externas (Meta Graph API, HikerAPI,
   ScrapeCreators, EnsembleData, Bright Data, instaloader/instagrapi, Agent-Reach).
4. 🔓 **Dos precios que se creían no consultables sí están en la API de Apify, y cierran sus
   preguntas:** el add-on de transcript cuesta **26× Supadata**, y el actor "13 % más barato" sale
   **+5 % más caro** en el régimen que se proponía, por su cobro de arranque.
5. 🟡 **Ninguna alternativa puede ser proveedor único.** Meta Graph API, la única fuente *oficial*
   posible, cubre **25-50 % del roster** (medido sobre `metaData.isBusinessAccount` de los reels ya
   pagados): sirve como segundo carril, nunca como reemplazo.

### 🔑 El hallazgo ordenador

**La pregunta "¿nos cambiamos de proveedor?" estaba mal formulada, y la evaluación lo probó
contradiciendo su propio título.** El costo no es una propiedad del proveedor sino del **régimen de
uso**: el mismo actor, con los mismos referentes y la misma ventana, cuesta 23,83 USD o 4,45 USD/mes
según cuántas veces al día se dispare. *Un proveedor no se evalúa por su precio de lista sino por lo
que le pedimos, y eso no se arregla cambiándolo.*

Y hay un corolario que reordena el norte: **la marca de agua no es la mejora, es el permiso.** Baja
el costo de un referente lo suficiente para que multiplicar el roster por 12-40 quepa en el mismo
cupo de 50 USD.

## Lo que esta ADR NO decide

Va escrito porque la evaluación lo proponía y **no se adopta acá**:

- **`min_views` a 100.000.** Es gratis (filtra después de pagar) y es condición aritmética para que
  el roster crezca, pero **el 500.000 es una instrucción explícita del jefe, no un default de dev** —
  *"para él eso es accuracy"*. Cambiarlo no es mover un knob: es renegociar qué significa accuracy,
  y hay dos definiciones en conflicto. Queda abierto, y lo cierra Mani con Daniel.
- **Multiplicar el roster de 26 a ~300 referentes.** Su prerrequisito no es negociable y no existe:
  el **ledger por cuenta**. Con 137 calificaciones en toda la historia, chi² = 15,9 sobre 11 g.l.
  (p ≈ 0,15) ⇒ **no se puede distinguir una cuenta buena de una mala**, y 5 cuentas ya se llevan el
  24 % del gasto devolviendo cero útiles. *Sumar 300 referentes sin criterio de poda es comprar 300
  suscripciones que nadie cancela.*
- **El actor `apidojo/instagram-scraper`** (4,7× más barato): se anota y no se adopta; se reabre
  pasados los ~400 referentes.
- **`instagram-reel-scraper`**: se evaluará por `skipPinnedPosts`, no por precio (cuesta lo mismo).
  La fuga de posts fijados pasa de 5,8 % a ~31 % de la factura cuando se arregla la cadencia.

## Consecuencias

- (+) Se cierra una línea de trabajo entera: **no hay migración de proveedor**, y no hay que
  re-litigarla cada vez que llegue una factura alta.
- (+) El arreglo que sí importa es **gratis y sin código**: disparar una vez por semana.
- (−) La marca de agua por referente, que es lo que habilita todo lo demás, **está bloqueada**: el
  repo no sabe qué pagó, porque `processed_items` se escribe *después* de `min_views`. Hace falta
  una tabla de pool crudo comprado.
- 🔴 **Y esa deuda tiene fecha de vencimiento: Apify borra los datasets a los 31 días.** Los de la
  exec 183 mueren el **2026-10-11**. Después de esa fecha el material para reconstruir el pool ya no
  existe.
- ⚠️ **Lo que esta evaluación NO toca y sigue siendo el frente más grande: el termómetro roto.**
  `relevancia_score ↔ aprobado` = **+0,041** y `heat_score ↔ aprobado` = **+0,044** sobre 136
  calificados. Ninguno de los dos números que el motor calcula para decidir qué entregar predice lo
  que el equipo aprueba. *Multiplicar los referentes por 12 sin arreglar eso multiplica por 12 el
  material que se juzga con una vara que no mide.* El estado vivo de ese frente es
  [plan-refactor-motor.md](../agents/plan-refactor-motor.md).

## Alternativas consideradas

| opción | por qué no |
|---|---|
| Migrar a `apidojo/instagram-scraper` (4,7× más barato) | El ahorro absoluto es ~29 USD/año sobre una factura bien usada de 0,84-2,41 USD/mes, y el remapeo de 23 campos cuesta más. Se reabre pasados los ~400 referentes |
| Migrar a Meta Graph API | Estructuralmente parcial: cubre 25-50 % del roster (sólo cuentas business). Queda como **segundo carril**, no reemplazo |
| HikerAPI | El precio de vitrina es real y es inalcanzable al volumen del pipeline |
| Open source auto-hospedado (instaloader / instagrapi) | El costo no es el código: es la infraestructura, los bloqueos y el mantenimiento |
| Agent-Reach | **Código limpio, verificado: no es un virus.** Descartado por arquitectura — es desktop-only sobre un Chrome logueado, no corre en un servidor |
| Add-on de transcript de Apify | **26× Supadata**, medido por su API |
