import { z } from "zod";
import { claveDe, type Plataforma } from "@/domain/enlace";
import type { TenantContext } from "@/domain/tenant";
import { scoped } from "@/lib/supabase/scoped";
import { leerTodo } from "@/lib/supabase/tope";

// IO del guion limpio (ADR-074, migración `032`).
//
// 🔑 **El crudo no vive acá y no se toca desde acá.** `app.candidatos.script` y
// `app.transcripciones.script` siguen siendo la transcripción literal de ADR-009. Esta tabla es una
// capa derivada: se puede vaciar entera sin perder nada que se haya pagado.

export type GuionLimpio = {
  clave: string;
  texto: string;
  modelo: string;
  criteriosHash: string | null;
  actualizadoEn: string;
  /** Con qué voz se limpió. `null` = solo los criterios de la casa. */
  vozId: string | null;
};

const fila = z.object({
  plataforma: z.enum(["instagram", "tiktok"]),
  external_id: z.string(),
  texto: z.string(),
  modelo: z.string(),
  criterios_hash: z.string().nullable(),
  actualizado_en: z.string(),
  voz_id: z.string().nullable(),
});

const COLUMNAS = "plataforma, external_id, texto, modelo, criterios_hash, actualizado_en, voz_id";

/** El arbiter de la PK de la `032`, con el tenant adentro como exige PostgREST. */
const ARBITER = "instance_id,plataforma,external_id";

/**
 * Los guiones limpios de **estos videos**, indexados por clave.
 *
 * 🔑 **Se pide por llaves y no "todos los de la empresa".** Traía la tabla entera (con el `texto`,
 * que es largo) para usar los 40 de una colección, y al pasar de 1.000 filas el tope de PostgREST
 * rompió la limpieza y el documento de toda colección (11/11). Un lote de 200 devuelve máximo 200
 * filas, así que acá ni siquiera puede truncarse. El 200 es el mismo de `quitarMiembros`: una URL
 * con más ids da 414 en prod.
 *
 * Agrupa por plataforma porque los ids de Instagram y TikTok son enteros de 19 dígitos que pueden
 * chocar: un `in` plano sobre `external_id` traería el limpio de otro video (ver `claveDe`).
 *
 * ⚠️ Trae el `texto`: es para abrir un guion o bajar el documento. Los badges usan `huellasDeLimpios`.
 */
export async function leerLimpiosDe(
  ctx: TenantContext,
  videos: readonly { plataforma: Plataforma; external_id: string }[],
): Promise<Map<string, GuionLimpio>> {
  const porPlataforma = new Map<Plataforma, string[]>();
  for (const v of videos) {
    const ids = porPlataforma.get(v.plataforma) ?? [];
    ids.push(v.external_id);
    porPlataforma.set(v.plataforma, ids);
  }

  const s = await scoped(ctx);
  const mapa = new Map<string, GuionLimpio>();
  for (const [plataforma, ids] of porPlataforma) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await s
        .select("app.guiones_limpios", COLUMNAS)
        .eq("plataforma", plataforma)
        .in("external_id", ids.slice(i, i + 200));
      if (error) throw new Error(`Supabase respondió con error leyendo los limpios: ${error.message}`);
      for (const f of z.array(fila).parse(data ?? [])) {
        const clave = claveDe({ plataforma: f.plataforma as Plataforma, external_id: f.external_id });
        mapa.set(clave, {
          clave,
          texto: f.texto,
          modelo: f.modelo,
          criteriosHash: f.criterios_hash,
          actualizadoEn: f.actualizado_en,
          vozId: f.voz_id,
        });
      }
    }
  }
  return mapa;
}

/**
 * Qué videos ya tienen limpio y con qué huella salió cada uno, **sin traerse los textos**.
 *
 * Es lo que dibuja los badges de la grilla: quién está limpio, y cuál de esos quedó viejo. Las
 * claves del mapa siguen siendo la respuesta a *"¿tiene limpio?"*; el valor es lo que agrega
 * ADR-080. El `texto` no viaja: para eso está `leerLimpiosDe`, que se pide al abrir un guion.
 *
 * La huella puede ser `null` (guiones limpiados antes de la `032`) y eso NO es un dato faltante:
 * `estadoDelLimpio` los cuenta al día a propósito.
 */
export async function huellasDeLimpios(ctx: TenantContext): Promise<Map<string, string | null>> {
  const s = await scoped(ctx);
  // Paginado: sin esto la lectura se cortaba en 1.000 sin error y los badges de "limpio" mentían.
  const data = await leerTodo(
    (d, h) =>
      s
        .select("app.guiones_limpios", "plataforma, external_id, criterios_hash")
        .order("plataforma")
        .order("external_id")
        .range(d, h),
    "las huellas de los limpios (app.guiones_limpios)",
  );
  const huellas = new Map<string, string | null>();
  const columnas = fila.pick({ plataforma: true, external_id: true, criterios_hash: true });
  for (const f of z.array(columnas).parse(data)) {
    huellas.set(
      claveDe({ plataforma: f.plataforma as Plataforma, external_id: f.external_id }),
      f.criterios_hash,
    );
  }
  return huellas;
}

/**
 * Guarda (o rehace) el limpio de un video.
 *
 * `merge`: re-limpiar **pisa**. Una fila por video, sin historial — el punto de comparación que
 * importa es el crudo, que está intacto en otra tabla, no las limpiezas anteriores.
 *
 * 🔑 **`usuarioId` solo se manda cuando la fila es NUEVA** (ADR-074 §Enmienda). `creado_por`
 * significa *quién lo limpió la primera vez*, y mandarlo en cada upsert se lo robaba a esa persona:
 * `merge` pisa lo que se le manda, así que rehacer un guion de Majo lo ponía a nombre de quien
 * apretara. Con la columna afuera del payload, PostgREST no la toca.
 *
 * El que llama ya sabe cuál de los dos casos es sin leer nada: `limpiarFaltantes` apunta a videos
 * **sin** limpio y `relimpiarViejos` solo a los que **ya** lo tienen.
 */
export async function guardarLimpio(
  ctx: TenantContext,
  video: { plataforma: Plataforma; external_id: string },
  datos: {
    texto: string;
    modelo: string;
    criteriosHash: string;
    vozId: string | null;
    /** El autor. `null` = la fila ya existe y su `creado_por` no se toca. */
    usuarioId: string | null;
  },
): Promise<void> {
  const { error } = await (await scoped(ctx)).upsert(
    "app.guiones_limpios",
    [
      {
        plataforma: video.plataforma,
        external_id: video.external_id,
        texto: datos.texto,
        modelo: datos.modelo,
        criterios_hash: datos.criteriosHash,
        voz_id: datos.vozId,
        ...(datos.usuarioId === null ? {} : { creado_por: datos.usuarioId }),
        actualizado_en: new Date().toISOString(),
      },
    ],
    { onConflict: ARBITER },
  );
  if (error) throw new Error(`Supabase respondió con error guardando el limpio: ${error.message}`);
}

/** Tira el limpio de un video. El crudo no se toca: rehacerlo es volver a apretar el botón. */
export async function borrarLimpio(
  ctx: TenantContext,
  plataforma: Plataforma,
  externalId: string,
): Promise<void> {
  const { error } = await (await scoped(ctx))
    .borrar("app.guiones_limpios")
    .eq("plataforma", plataforma)
    .eq("external_id", externalId);
  if (error) throw new Error(`Supabase respondió con error: ${error.message}`);
}
