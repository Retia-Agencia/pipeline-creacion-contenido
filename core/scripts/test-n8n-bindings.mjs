// Test de `conservarBindings` (ADR-053 §Enmienda 3). Node pelado, NO toca n8n.
//
//   node test-n8n-bindings.mjs
//
// Lo que no puede romperse: un push que reemplaza los `parameters` enteros con los del repo NO puede
// pisar un resourceLocator `__rl` del live con el slug del repo. Es la identidad de la instancia, y
// el `diff` ya lo clasificaba así ("nunca se empuja"); el push no lo cumplía.
import { conservarBindings, esBinding } from './n8n-bindings.mjs';

let fail = 0;
const check = (nombre, cond, detalle) => {
  console.log((cond ? '✅' : '❌') + ' ' + nombre + (cond ? '' : '\n     → ' + detalle));
  if (!cond) fail++;
};

// La forma real del live el 15/09, en `Apify — IG Reels` del motor.
const RL = { __rl: true, value: 'shu8hvrXbJbY3Eb9W', mode: 'list', cachedResultName: 'Instagram Scraper (apify/instagram-scraper)' };

check('esBinding reconoce un __rl', esBinding(RL) === true, JSON.stringify(RL));
check('esBinding no confunde un string ni un objeto común', !esBinding('apify~instagram-scraper') && !esBinding({ value: 'x' }) && !esBinding(null), '');

{
  const repo = { actorId: 'apify~instagram-scraper', customBody: '={{ nuevo }}' };
  const live = { actorId: RL, customBody: '={{ viejo }}' };
  const r = conservarBindings(repo, live);
  check('slug del repo contra __rl del live: se queda el del live', JSON.stringify(r.actorId) === JSON.stringify(RL), JSON.stringify(r));
  check('los demás campos vienen del repo', r.customBody === '={{ nuevo }}', JSON.stringify(r));
  check('no muta la entrada del repo', repo.actorId === 'apify~instagram-scraper', JSON.stringify(repo));
}
{
  const r = conservarBindings({ actorId: 'a~b' }, { actorId: 'c~d' });
  check('sin __rl en el live: manda el repo (es un drift de verdad)', r.actorId === 'a~b', JSON.stringify(r));
}
{
  const otroRL = { __rl: true, value: 'OTRO', mode: 'id' };
  const r = conservarBindings({ actorId: otroRL }, { actorId: RL });
  check('el repo declara su propio __rl: manda el repo (lo decidió alguien a propósito)', r.actorId.value === 'OTRO', JSON.stringify(r));
}
{
  const r = conservarBindings({ customBody: 'x' }, { actorId: RL, customBody: 'y' });
  check('el repo no declara el campo: no se inventa (el PUT ya reemplaza parameters enteros)', !('actorId' in r), JSON.stringify(r));
}
{
  const r = conservarBindings({ a: 1 }, undefined);
  check('live sin parameters: devuelve el repo tal cual', JSON.stringify(r) === '{"a":1}', JSON.stringify(r));
}

console.log(fail ? `\n❌ ${fail} fallido(s)` : '\nTodo en verde');
process.exit(fail ? 1 : 0);
