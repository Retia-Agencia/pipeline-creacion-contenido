# Parte 3 · Revisión de lo que dejó Alejo en `main`

*Escrito el 2026-09-28. Revisa los commits `27101f3` y `7b4a5a1` (Alejo, 28/09, 13:17 y 13:49):
[plan-migracion-virlo.md](../agents/plan-migracion-virlo.md),
[ADR-101](../adr/ADR-101-virlo-entra-en-sombra.md), la migración
[`046`](../../core/schema/046_proveedor_virlo.sql) (sin aplicar), `sonda-virlo.mjs`,
`normalizar-virlo.mjs`, `test-virlo.mjs` (verde al 28/09), `comparar-proveedores.mjs` y el ajuste
nuevo del cockpit. Nada de eso está en producción.*

**Resumen:** el trabajo es cuidadoso y tiene dos hallazgos muy buenos. El problema no es la
ejecución sino **el encuadre**: trata a Virlo como un reemplazo de Apify **para el mismo carril**
(los referentes) y deja los agentes como opcionales. Ese carril es el que, según nuestros propios
números, no puede llenar la demanda con ningún proveedor.

---

## 1. Lo que ya tiene y se adopta tal cual

| Pieza | Por qué se queda |
|---|---|
| **"Al lado, nunca en lugar"** + rollback sin deploy (patrón de ADR-100) | Es el principio correcto para cualquier migración de este sistema. |
| **La sombra no puede mover lo que se compra** (ADR-101 D2, `046` §3) | Hallazgo real y no obvio: si Virlo escribe en `pool_crudo`, corre la marca de agua y Apify deja de comprar reels que nadie entrega. Aplica **si y solo si** Virlo escribe en `pool_crudo`. |
| **`external_id` derivado de la URL** (ADR-101 D3, `shortcodeAExternalId`) | Es la llave de dedup, caché de transcripts y `videos_meta`. El agente devuelve un uuid propio como `id`, así que esto es **obligatorio**, no una precaución. |
| **Supadata no se toca hasta ver texto** (ADR-101 D4) | Correcto, y la doc lo confirma más fuerte todavía (IG casi sin transcripts). |
| **El cockpit sigue con Apify/Supadata para URL suelta** (D5) | Correcto: `video-outlier` cuesta 200× Apify. |
| **Predicciones escritas antes de medir** | Es la disciplina del repo. Se mantienen y se suman las del carril de agentes. |
| **`sonda-virlo.mjs`**: dry-run por defecto, fixtures crudos, busca "transcript" en toda la respuesta | Buena herramienta. Se reusa su modo `agent` como la sonda principal. |
| **Tarifas de Virlo en `app.tarifas`** (`046` §4) | Hace falta para `v_costos_semana`, sea cual sea el carril. |

## 2. Lo que le falta

1. **El carril de agentes como principal.** El plan lo pone en la Fase 4, "si la Fase 0 da
   volumen". Pero el techo del roster ([costos.md §4.1.1](../costos.md): 0,6-2,3 aprobados por
   semana con 500k de piso) no aparece citado ni en el plan ni en ADR-101. Sin eso, el plan
   optimiza el carril que no puede ganar.
2. **La demanda.** No hay un solo número de lo que se necesita (1.200-1.400 aprobados al mes, 28
   proyectos). Sin demanda no hay forma de dimensionar corridas ni presupuesto.
3. **El conflicto con [ADR-019](../adr/ADR-019-remocion-total-eje-keyword.md).** Los agentes son
   búsqueda por keyword + intención, el eje que ADR-019 mató con 3 % de aprobables. ADR-101 enmienda
   a ADR-098 pero no a ADR-019, y tiene que hacer las dos cosas y decir por qué esta vez es distinto.
4. **Los idiomas.** `english_only` viene en `true` y el plan lo nota, pero no saca la consecuencia:
   para buscar en portugués o francés hay que escribir **intención y keywords en ese idioma**, o sea
   un agente por idioma. Eso multiplica el costo y es una decisión de producto.
5. **Cómo se escribe la intención.** Nuestros criterios son prosa larga; la intención es una frase
   de 40-250 caracteres. Falta el paso "criterios → intención + keywords" (con `suggest-keywords`,
   que es gratis) y dónde se guarda y edita.
6. **La operación de Virlo.** Dice que no hay endpoint de saldo y **sí existe** (`GET
   /account/balance`, gratis), así que el pre-flight de ADR-094 se puede replicar. Tampoco cubre:
   webhooks (no hay que hacer polling), que los cobros de recurrentes **no salen en `X-Cost`**, y
   que sin saldo los recurrentes y el tracking **se pausan y no vuelven solos**.
7. **La pregunta de n8n.** Mani la hizo explícita; el plan asume que todo vive en el motor.
8. **Tracking como alternativa real.** Aparece solo como "más barato que el lookup". No como
   re-medición (snapshots) ni como reemplazo del workflow de descubrimiento (outliers + similares).

## 3. Lo que hay que refactorizar

| Qué | Hoy dice | Debería decir |
|---|---|---|
| **Criterio de pase de la Fase 3** | "Virlo trae ≥ 90 % de lo que Apify trae sobre `min_views`" | Paridad con un carril que no alcanza no es la meta. El criterio es el de ADR-089: **aprobados / N pedido** y **costo por aprobado**, Virlo contra Apify, con la vara escrita antes de mirar ([00-plan §4](./00-plan.md)). |
| **Orden de la Fase 0** | 3 lookups de referentes (1,50 USD) + 1 agente | Primero **agentes**: 4 agentes de una corrida, uno por voz, con idiomas mezclados contra un solo idioma ([00 §4](./00-plan.md)), ~6 USD. El lookup queda como una sonda chica de control. |
| **El interruptor `Proveedor de scraping`** (0 apify · 1 sombra · 2 virlo) | Un interruptor global que cambia el proveedor **del mismo carril** | Con D-1 (un agente por voz), el agente se prende **por voz** (una fila en `app.agentes_virlo` con `activo`), y el interruptor global sobra. Si el Carril B existe, su proveedor es un ajuste aparte. |
| **`normalizar-virlo.mjs`** | Escrito contra la forma del *creator lookup* | Hay que escribirlo contra `AgentVideoItemDto` (uuid como `id`, sin duración del video, `author.followers`, `intent_match`), con fixtures reales de la sonda. |
| **ADR-101** | "Virlo entra en sombra" como proveedor del roster | Reescribirlo como "el eje vuelve a ser el tema, con intención" (enmienda ADR-019 y ADR-098) **después** de la Fase 0, con sus números. |

## 4. Lo que se quita o se congela

| Qué | Por qué |
|---|---|
| **El creator lookup como reemplazo del roster** | 0,50 USD por cuenta por corrida = ~41 USD por corrida con 83 cuentas, contra 1-6 USD hoy. El propio plan lo dice. Si se sigue a cuentas, es con tracking (0,25) y para pocas. |
| **La Fase 5 ("transcript de Virlo antes que Supadata")** | Queda congelada hasta que Nick conteste por escrito. Con la doc actual no hay texto que usar, y en IG no existe. |
| **Aplicar la `046` como está** | No se aplica hasta decidir D-1 y D-3. Su §3 (vistas filtradas) solo hace falta si Virlo escribe en `pool_crudo`; con el Carril A en una tabla propia, sobra. Sus §2 y §4 (columna `proveedor`, tarifas) se rescatan en la migración que corresponda. |
| **`comparar-proveedores.mjs` como juez principal** | Compara reel por reel en el carril de referentes. Sirve solo si el Carril B se pone en sombra. Se guarda. |
| **El `AJUSTE_MAP` que ya lee `proveedor_scraping`** en `workflow.json` | Está en el repo y **no** en el live (no se hizo el push). Si D-1 se confirma, se revierte esa línea para que el repo no declare un ajuste que nadie usa. |

## 5. Qué hacer con los archivos de Alejo

Nada se borra hoy. Cuando Mani confirme las decisiones de [00-plan §3](./00-plan.md):

- `plan-migracion-virlo.md` pasa a ser antecedente y este plan queda como dueño (un hecho, un
  dueño).
- ADR-101 se reescribe con los números de la Fase 0 (sigue en estado *Propuesta* hasta entonces).
- La `046` se reescribe o se renumera según D-1/D-3, antes de aplicarse.
- `sonda-virlo.mjs` y `normalizar-virlo.mjs` se extienden, no se tiran.

**Conviene hacer esto con Alejo, no a espaldas de su trabajo**: la mitad de lo que se adopta es de
él, y el cambio de encuadre es una conversación de 15 minutos.
