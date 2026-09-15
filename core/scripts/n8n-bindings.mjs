// La identidad de la instancia en los `parameters` de un nodo (ADR-053 §Enmienda 3).
//
// Un resourceLocator `__rl` (hoy: `actorId` de los nodos de Apify) guarda el id interno que n8n
// resolvió al elegir el recurso en el editor. El repo declara el slug legible
// (`apify~instagram-scraper`). Son el mismo recurso dicho de dos formas, y el del live es el que
// n8n sabe correr.
//
// 🩸 El `diff` ya lo sabía (`binding` — "nunca se empuja"), pero el `push` reemplazaba los
// `parameters` enteros con los del repo, así que el primer push de un nodo de Apify le habría
// cambiado el `__rl` por el slug. Nunca pasó porque ningún nodo de Apify se había empujado: lo
// destapó el dry-run de ADR-100, el 15/09. Una sola definición para los dos comandos.

/** `true` si el valor es un resourceLocator de n8n. */
export const esBinding = (v) => Boolean(v) && typeof v === 'object' && v.__rl === true;

/**
 * Los `parameters` del repo, salvo los campos de primer nivel donde el live tiene un `__rl` y el repo
 * no: ahí se conserva el del live. Si el repo declara su propio `__rl`, manda el repo (alguien lo
 * puso a propósito). No muta las entradas.
 */
export function conservarBindings(repoParams, liveParams) {
  const salida = { ...repoParams };
  if (!liveParams || typeof liveParams !== 'object') return salida;
  for (const [campo, enLive] of Object.entries(liveParams)) {
    if (campo in salida && esBinding(enLive) && !esBinding(salida[campo])) salida[campo] = enLive;
  }
  return salida;
}
