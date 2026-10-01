# Parte 7 · El refactor: Virlo como buscador, en tickets y en dos carriles

> 🔴 **PRIORIDAD MÁXIMA del repo desde el 2026-10-01** (Mani). Es el refactor que toca hacer ya.
> Decisiones: [00 §3](./00-plan.md) (D-1 a D-11) y [ADR-102](../adr/ADR-102-la-busqueda-pasa-a-virlo-por-tematica.md).
> Este doc es el dueño de **qué se construye, en qué orden y quién puede ir en paralelo**. El estado
> de cada ticket se marca acá (`⬜` → `🔨` → `✅`) y la sesión que lo mueve lo anota en el handoff.

## 🧭 El norte de este refactor (no se pierde)

> **Virlo es el nuevo buscador de contenido.** El equipo de media crea temáticas, Virlo trae los
> videos, Claude los asigna a los proyectos, y el Feed los recibe como hoy.

Cada ticket tiene que acercar esa frase. Si un ticket no la acerca, no va en la Etapa 1.

**Lo que NO se hace en la Etapa 1:**
- No se toca el motor de n8n: sigue con Apify, **sin un cambio**, como sombra y rollback.
- No se aplica la `046` vieja (la de Alejo): se reescribe en T0.
- No se construye nada del HUB ni del tracker (Etapa 2) antes de que el piloto diga "sigue".
- No se borra nada de Apify, Supadata ni n8n hasta el corte (V-12).

## Las dos etapas

| Etapa | Qué es | Cuándo |
|---|---|---|
| **1 · Virlo busca** | Los tickets de abajo: agentes por temática, ingesta, asignación, gasto, piloto, corte. | **Ya.** |
| **2 · El cockpit opera la media** | Lo de PreWave y el HUB: tracker con lo que Virlo trae gratis, producción, publicación (§Etapa 2). | Cuando el piloto (V-11) diga "sigue". |

---

## Etapa 1 · Los tickets

Somos dos. El trabajo se parte en **dos carriles que no se pisan** y un **tronco común** que se hace
primero. *Sugerencia, no asignación:* el **Carril A** le calza a quien ya escribió la sonda y el
normalizador (Alejo); el **Carril B**, a quien lleve el cockpit con el equipo de media.

Tamaños: **S** ≤ medio día · **M** 1-2 días · **L** 3+ días. Lo no trivial se implementa con
`/delegate` (Codex) y se revisa contra su "hecho cuando".

### Tronco común (bloquea a los dos carriles; día 1)

| ID | Ticket | Depende de | Hecho cuando | Tam. |
|---|---|---|---|---|
| ✅ **T0** | **Migración `046` reescrita** (la vieja se borra del repo antes de aplicar nada): `app.agentes` (temática, intención, keywords, excluidas, idiomas, modo `mezclar`/`separar`, cadencia, autopilot, `min_views`, activo) · `app.agentes_virlo` (los `agent_id` de Virlo de cada agente, uno por idioma si se separa) · `app.agentes_proyectos` (asociación con proyectos **de cualquier voz**, prendida/apagada) · `app.proyectos.plataformas` (las que acepta, D-8) · `alter type app.plataforma add value 'youtube'` · `candidatos.origen` (`apify`/`virlo`) + `candidatos.agente_id` · de dónde salió el transcript (`virlo_platform`/`virlo_transcribed`/`supadata`) · `app.virlo_corridas` (corrida de Virlo, costo, saldo después: el libro de D-10). RLS por tenant como el resto. | ADR-102 ✅ | Aplicada a mano en el SQL Editor y **medida por su efecto** (PostgREST + catálogo), `npm run validate` verde, y el estado de la migración anotado en AGENTS.md (§Contratos del núcleo), como las anteriores. | M |
| ⬜ **T1** | **Contrato de tipos compartido** en `apps/dashboard/domain/virlo.ts`: las formas de Virlo (video, corrida, webhook) y las del Agente, sacadas de los fixtures. Es la frontera entre los dos carriles: A la produce, B la consume. | — | `npm run typecheck` verde; los tipos cubren `fixtures/virlo/playground/`. | S |

### Carril A · Motor Virlo (backend): traer, filtrar, asignar, escribir

| ID | Ticket | Depende de | Hecho cuando | Tam. |
|---|---|---|---|---|
| ⬜ **A1** | **Cliente de Virlo** `lib/virlo.ts` (bearer desde `.env`, paginación hasta página vacía, `X-Cost`, errores) + **normalizador en TypeScript** `domain/virlo.ts` (portar `normalizar-virlo.mjs` y sumar la **regla de `external_id` de YouTube**, `/shorts/<id>`). | T1 | Tests `node:test` contra los fixtures del playground y los reales de A2; la forma interna es la misma que hoy entra al Feed. | M |
| ⬜ **A2** | **Fase 0 (la sonda)**: API key al `.env` y al gestor, saldo con `GET /account/balance`, correr las temáticas de B0 (una repetida mezclando y separando idiomas), guardar **fixtures reales**, incluido **un reel de Instagram**, en `Workflows/workflow-short-form-content/fixtures/virlo/`. | API key (Mani), B0 | La tabla de predicciones de [00 §4](./00-plan.md) llena con números medidos en [04 §3](./04-operacion-y-costos.md) y el veredicto **sigue / no sigue**. **Si "no sigue", se para todo lo demás.** | M |
| ⬜ **A3** | **El asignador** (D-4): `domain/asignacion.ts` puro (proyectos elegibles por plataforma, cupo en proporción al N, faltante, parseo de la respuesta) + `lib/asignar.ts` (una llamada a Claude por video con los proyectos elegibles y sus criterios → proyecto o "ninguno" con razón). | A1 | Tests del dominio verdes. Corrido sobre los videos de A2: el equipo califica a ciegas, y se escribe cuánto coincide con lo que aprobó. | L |
| ⬜ **A4** | **Ingesta por webhook**: `/api/virlo/webhook` (secreto en header, idempotencia por corrida) → leer videos con el `min_views` del agente e `include_transcript=true` → dedup contra `processed_items` y el Feed → descartar `intent_match: false` (D-4b) → transcript de Virlo, Supadata de respaldo (D-2, reusa `lib/transcribir.ts`) → traducir (reusa `traducir`) → asignar (A3) → escribir `candidatos` (origen oculto, D-6) + `descartes` + `runs` + la fila del libro. ⚠️ `maxDuration` es 60 s: va con **ejecución durable** (Vercel Workflow o cola), no en el handler. | T0, A1, A3 | Test end-to-end con un webhook de prueba (`Send test event` de Virlo) contra fixtures; una corrida real de un agente de una sola vez deja candidatos en el Feed y una fila en el libro. | L |
| ⬜ **A5** | **Relectura de lo pendiente**: a las ~6 h se releen los videos con `intelligence_status: pending` o transcript `null` (D-2), una sola vez. Cron de Vercel. | A4 | Test del dominio; en producción, el contador de pendientes baja después de la relectura. | S |

### Carril B · Cockpit de media (producto): crear, operar, ver, pagar

| ID | Ticket | Depende de | Hecho cuando | Tam. |
|---|---|---|---|---|
| ✅ **B0** | **2-3 temáticas para la Fase 0** (una de psicología, una de trading), con la intención en el formato de Virlo. ✏️ **Las escribimos nosotros desde los proyectos live** (Mani, 01/10: *para no demorarnos preguntando*), no Majo: la prueba de que media sabe operar un agente pasa a B1 y al piloto (V-11). | — | Las temáticas escritas abajo, en §B0. | S |
| ⬜ **B1** | **Pantalla de Agentes** (dentro de la zona de ajustes, o zona propia si el sistema visual lo pide): lista, crear, editar. La **guía del formato de Virlo visible** (*[objetivo] [tipo de contenido] sobre [nicho], no [exclusión]*, sacada del Intent cookbook) y botón **sugerir keywords**. Asociar proyectos **de cualquier voz** y prenderlos/apagarlos; plataformas que acepta cada proyecto (D-8); idiomas con **mezclar / separar** y el aviso de que **cada idioma separado gasta su corrida** (D-5); autopilot (D-9); umbral (D-11). Arranca con datos falsos sobre T1 y se conecta cuando está T0. | T1 (para empezar), T0 (para guardar) | Typecheck + tests del dominio; el flujo entero hecho en el navegador con un agente de prueba. Antes de construir: leer [sistema-visual.md](../design/sistema-visual.md). | L |
| ⬜ **B2** | **Sincronizar el agente con Virlo** (`lib/agentes.ts`): crear, actualizar, activar, pausar; `separar` = un agente de Virlo por idioma con las keywords de ese idioma; registrar el webhook. Cada acción va a `app.eventos` con quién la hizo (D-10). | A1, T0, B1 | Crear un agente desde la pantalla lo deja creado en Virlo (se ve en su API) y deja su evento. | M |
| ⬜ **B3** | **Libro de gasto y saldo** (D-10): costo de cada corrida, saldo leído después de cada corrida, historial por agente y total; **aviso de agente pausado por saldo** con botón para reactivar. Prender la **recarga automática** en Virlo (paso manual de Mani, anotado). | T0, A4 (para el costo real de las corridas) | La pantalla muestra el gasto de las corridas de A4 y el saldo coincide con el de Virlo. | M |
| ⬜ **B4** | **Feed y descartes con Virlo**: el **Virality Score** al lado de las vistas (D-11); el origen guardado y **no mostrado** durante el piloto (D-6); las razones nuevas de descarte ("fuera de la intención (Virlo)", "ninguno: …"); el **faltante contra el N** por proyecto (D-1b). | T0 | Typecheck + tests; un candidato de Virlo y uno de Apify se ven iguales en la tarjeta. | M |
| ⬜ **B5** | **Lo que hizo autopilot**: en el agente, las keywords que agregó y su razón (`activity`), para que nadie vea keywords que no escribió sin saber de dónde salieron (D-9). | B2 | Después de una corrida recurrente se ven sus cambios en la pantalla. | S |

#### §B0 · Las temáticas de la Fase 0 (01/10)

🧪 **Son de prueba y NO salen a producción.** Sirven solo para la sonda (A2) y para el prototipo del
asignador (A3); ningún agente de estos se crea en el cockpit ni queda corriendo. 🔴 **Media todavía no
sabe crear temáticas** (Mani, 01/10): las escribimos nosotros para no frenar la Fase 0, así que la
pregunta *"¿media sabe operar un agente?"* sigue **abierta** y la contestan B1 (la pantalla, con la
guía del formato de Virlo) y el piloto (V-11), con temáticas escritas por media.

Salen de los **proyectos activos del cockpit** (leídos de `app.proyectos` el 01/10, con sus
criterios). Las keywords son **un borrador**: A2 las pasa por `suggest-keywords` (gratis) y se
queda con la lista que devuelva Virlo, sumando las nuestras que falten. La intención va en inglés
(D-5) con el molde *[objetivo] [tipo de contenido] about [nicho], not [exclusión]*.

⚠️ **Las voces de estos proyectos están casi todas inactivas** (`app.voces.activo`: solo María José
Sánchez está en `true`). No importa para la Fase 0, que corre fuera del sistema y la califica el
equipo, pero sí para el piloto: un proyecto de una voz apagada no debería recibir videos.

| # | Temática | Intención (Virlo) | Keywords (borrador) | Excluidas | Proyectos que alimentaría |
|---|---|---|---|---|---|
| **1** | Regulación e inteligencia emocional | *Find short educational videos by psychologists and therapists about emotional regulation and emotional intelligence, not motivational quotes, comedy skits or personal vlogs.* | emotional regulation · emotional intelligence · managing emotions · emotional triggers · anger management · distress tolerance · impulse control · emotional awareness · self-regulation · nervous system regulation | motivational quotes · comedy · prank · vlog | María José: **Inteligencia emocional** (N 20), **Psicología** (N 20) |
| **2** | Psicología del trading | *Find short educational videos where experienced traders explain trading psychology, discipline and mindset, not chart-only screen recordings, signals or get-rich-quick promises.* | trading psychology · trader mindset · trading discipline · fear and greed trading · revenge trading · emotional trading · risk management mindset · trading journal · overtrading · patience in trading | signals · copy trading · get rich quick · forex giveaway | Vieira: **Trading Psychology** (N 30), **Trading fast tips** (N 40) |
| **3** | Comunicación en el trabajo | *Find short educational videos with practical scripts for communicating at work: difficult conversations, giving feedback, talking to your boss and leading a team, not relationship advice, comedy or generic productivity tips.* | difficult conversations at work · how to give feedback · talking to your boss · workplace communication · leadership communication · how to say no at work · conflict at work · one on one meetings · assertive communication at work · managing up | dating · couples · comedy · productivity hacks | Francisco: **Comunicación laboral**, **Conversaciones difíciles**, **Liderazgo** · Milena: **Comunicación en empresas** · Rosario: **Comunicación para lideres** · Nicolás: **Comunicación para líderes** |

**Por qué estas tres:**
- **La 1 y la 2** son las que pide la Fase 0 (psicología y trading) y salen de las dos voces con más N.
  Cada una alimenta **dos proyectos de la misma voz**, así que prueban la asignación dentro de un
  tema: la 2 tiene que separar *mindset* (Trading Psychology) de *tip técnico* (Trading fast tips).
- **La 3 es la prueba de D-1**: un mismo tema alimenta **seis proyectos de cuatro voces**. Es la que
  más le exige al asignador (Comunicación en empresas contra Comunicación laboral se pisan a
  propósito: sus criterios ya se reparten "líderes" vs "empleado"). **Es la que se repite mezclando
  y separando idiomas** (EN + PT + FR, D-5): la comunicación laboral tiene volumen en los tres.
- **Quedó fuera Francisco entero en un tema propio** (7 proyectos, el caso que motivó D-1): la 3 ya
  cubre tres de ellos.

### Juntos (cierran la Etapa 1)

| ID | Ticket | Depende de | Hecho cuando | Tam. |
|---|---|---|---|---|
| ⬜ **V-11** | **Piloto** (Fase 3): 1-2 temáticas reales, recurrentes, **una con autopilot y otra sin**, 2-3 semanas, al lado del motor de Apify. | A4, A5, B1-B4 | La comparación de [ADR-089](../adr/ADR-089-una-sola-metrica-aprobados-contra-lo-pedido.md) (aprobados / N pedido) Virlo contra Apify, escrita con números. | — |
| ⬜ **V-12** | **Corte** (Fase 5): Apify sale de la búsqueda, queda para Colecciones. ADR propia; apagar n8n entero es **otra** ADR. | V-11 | ADR aceptada y el motor de n8n apagado para búsqueda. | M |

### Dependencias, en un dibujo

```
            ┌── T1 ──┬── A1 ──┬── A3 ──┐
ADR-102 ✅ ─┤        │        │        ├── A4 ── A5 ──┐
            └── T0 ──┼────────┼────────┘              │
                     │        └── B2 ── B5            ├── V-11 ── V-12
   B0 ── A2 ─────────┤             (B2 necesita B1)   │
   (API key) ────────┘   B1 (arranca sobre T1) ───────┤
                         B3 (necesita A4) ────────────┤
                         B4 (necesita T0) ────────────┘
```

**Arranque en paralelo, día 1:**
- **Persona A:** T1, después A1 (con los fixtures del playground; no necesita la API key).
- **Persona B:** T0, y en paralelo **B0** (✅ 01/10, escrito por nosotros). Después B1 sobre los tipos de T1.
- **Mani:** pedir la API key y confirmar el crédito (destraba A2).

**Los dos puntos donde se esperan:** A4 necesita T0 (de B), y B3 necesita A4 (de A). Fuera de eso,
cada carril avanza solo. **A2 es la compuerta:** si la Fase 0 dice "no sigue", se para todo.

---

## Etapa 2 · El cockpit opera la media (después del piloto)

No se construye hasta que V-11 diga "sigue". Se planifica con
[decisiones-hub.md](../agents/decisiones-hub.md), que ya tiene las diez decisiones del HUB.
**Virlo ya contesta tres de ellas:** D6 (TikTok como fuente: los agentes buscan en TikTok), D8
(cambiar Apify y Supadata: Virlo, ADR-102) y D10 (con qué buscamos referentes: agentes por temática).

Lo que entra, en el orden probable:

1. **Tracker con lo que Virlo trae gratis en cada corrida** ([02 §7](./02-arquitectura.md),
   [06 §2.5](./06-mapa-doc-virlo.md)): tendencias del agente, hooks, cuentas outlier
   ("autoridades" de PreWave: cuentas de 40-100k con un video de 500k+), el reporte de cada corrida.
2. **Producción**: la pieza por voz (versiones, revisión, quién aprueba). El guion después de
   aprobar, como en PreWave, es la pregunta abierta de [00 §5](./00-plan.md).
3. **Calendario y publicación programada** (D2, D3 del HUB).

🔑 **Lo que la Etapa 1 deja hecho para la 2:** con un video asignado a un solo proyecto (D-1a), el
choque de `grabados` sin voz en la llave ([decisiones-hub](../agents/decisiones-hub.md)) se achica,
pero no desaparece: la pieza por voz sigue siendo trabajo de la Etapa 2.
