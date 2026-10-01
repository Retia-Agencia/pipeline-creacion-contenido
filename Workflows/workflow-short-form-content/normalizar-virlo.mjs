// normalizar-virlo.mjs — lleva un video de Virlo a la forma interna que ya producen `Normalizar IG`
// y `Normalizar TT`, y a una fila de `app.pool_crudo`. Fase 2 de docs/agents/plan-migracion-virlo.md.
//
// ⚠️ PROVISORIO: escrito contra la doc de Virlo (28/09) y la muestra del playground (01/10,
// fixtures/virlo/playground/), sin una sola respuesta real. La muestra contestó:
//   · `id` del video de un agente es un uuid de Virlo ⇒ el id se deriva de la url;
//   · el creador viene dentro del video (`author.username`, `author.followers`, sin bio);
//   · `duration` en segundos enteros, o null si la plataforma no la dio.
// Lo que sigue abierto lo contesta la sonda con plata (`sonda-virlo.mjs agent --di --apply`): un
// reel de Instagram real, y si `language_detected` llega en `intelligence`.
//
// Cuando se cablee en el motor, este código entra como COPIA TEXTUAL en el Code node y
// test-nodos.mjs lo pina contra este archivo, igual que `Preparar pool crudo` con
// backfill-pool-crudo.mjs: los Code nodes de n8n no pueden importar.
//
// 🔑 El `external_id` es lo único que no se negocia: de él dependen `processed_items` (dedup), la
// caché de transcripts y `videos_meta`. Si Virlo diera otro id, el mismo reel entraría como nuevo.

// Mismo alfabeto y misma cuenta que apps/dashboard/domain/enlace.ts `shortcodeAExternalId`.
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function shortcodeAExternalId(shortcode) {
  let n = 0n;
  for (const c of String(shortcode)) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) return '';
    n = n * 64n + BigInt(i);
  }
  return n.toString();
}

/** El id que usa todo el sistema: media id numérico de IG, o el id numérico del video de TikTok. */
export function externalIdVirlo(video, plataforma) {
  const id = String(video?.id ?? '');
  const url = String(video?.url ?? '');
  if (plataforma === 'tiktok') {
    if (/^\d{15,}$/.test(id)) return id;
    const m = url.match(/\/video\/(\d+)/);
    return m ? m[1] : '';
  }
  // IG: `123…_456` es media id + owner id; nos quedamos con la primera parte, como Apify.
  if (/^\d{15,}(_\d+)?$/.test(id)) return id.split('_')[0];
  const m = url.match(/instagram\.com\/(?:[^/?#]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? shortcodeAExternalId(m[1]) : '';
}

/** ¿Es un video transcribible? Virlo trae el feed entero de IG: fotos y carruseles con `views: 0`. */
export function esVideoVirlo(video) {
  if (!video || typeof video !== 'object') return false;
  if (video.is_video === false) return false;
  if (video.content_type && !/video|reel|clip/i.test(String(video.content_type))) return false;
  return Number(video.views) > 0;
}

// Virlo manda `publish_date` en UTC pero SIN zona (`2026-09-21T18:22:00`), y `new Date()` lee ese
// formato como hora LOCAL: en Colombia correría 5 h cada reel, y la marca de agua compara horas.
export function fechaUtc(s) {
  if (s == null || s === '') return null;
  const txt = String(s);
  const d = new Date(/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(txt) ? txt + 'Z' : txt);
  return Number.isNaN(d.getTime()) ? null : d;
}

const fecha = (s) => {
  const d = fechaUtc(s);
  return d ? d.toISOString().split('T')[0] : '';
};

/**
 * Un video de Virlo → la forma interna (las mismas claves que `Normalizar IG`, más `idioma_nativo` en
 * TikTok como `Normalizar TT`). `creador` viene aparte porque la doc lo pone a nivel del lookup, no
 * del video: { username, nombre, seguidores, bio }.
 */
export function normalizarVideoVirlo(video, creador = {}, plataforma = 'instagram') {
  const seguidores = Number(creador.seguidores ?? video?.author?.followers ?? 0) || 0;
  const likes = Number(video.likes ?? 0) || 0;
  const comentarios = Number(video.comments ?? 0) || 0;
  const url = String(video.url ?? '');
  const salida = {
    plataforma,
    external_id: externalIdVirlo(video, plataforma),
    username: String(creador.username ?? video?.author?.username ?? '').replace(/^@/, ''),
    nombre: String(creador.nombre ?? ''),
    seguidores,
    bio: String(creador.bio ?? ''),
    descripcion: String(video.description ?? video.title ?? ''),
    likes,
    comentarios,
    reproducciones: Number(video.views ?? 0) || 0,
    url,
    video_url: url,
    thumbnail_url: String(video.thumbnail_url ?? ''),
    hashtags: (Array.isArray(video.hashtags) ? video.hashtags : []).map((h) => String(h?.name ?? h).replace(/^#/, '')).join(', '),
    duracion_video: Number(video.duration ?? 0) || 0,
    engagement_rate: seguidores > 0 ? ((likes + comentarios) / seguidores * 100).toFixed(2) : '0',
    fecha_publicacion: fecha(video.publish_date),
  };
  // `language` no aparece en la muestra del agente; con Data Intelligence viene `language_detected`.
  if (plataforma === 'tiktok') salida.idioma_nativo = String(video.language ?? video.intelligence?.language_detected ?? '');
  return salida;
}

/** Una observación para `app.pool_crudo` (migración 046: `proveedor = 'virlo'`). */
export function filaPoolCrudoVirlo(video, { plataforma = 'instagram', handle, medido_en, job_id, run_id = null, instance_id, seguidores = null }) {
  const d = fechaUtc(video.publish_date);
  return {
    instance_id,
    plataforma,
    external_id: externalIdVirlo(video, plataforma),
    handle: String(handle ?? '').replace(/^@/, '').toLowerCase(),
    publicado_en: d ? d.toISOString() : null,
    vistas: Number(video.views ?? 0) || null,
    likes: video.likes == null ? null : Number(video.likes),
    comentarios: video.comments == null ? null : Number(video.comments),
    seguidores,
    duracion_seg: Number(video.duration) > 0 ? Number(video.duration) : null,
    medido_en,
    apify_run_id: null,
    // La PK de pool_crudo lleva el dataset. Virlo no tiene: el job del lookup cumple ese papel.
    apify_dataset_id: `virlo:${job_id}`,
    run_id,
    origen: 'motor',
    proveedor: 'virlo',
  };
}
