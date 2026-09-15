import type { DatosMarcaDeAgua } from "@/domain/run-plan";
import type { TenantContext } from "@/domain/tenant";
import { DIAS_JOVEN, FRACCION_PISO_REMEDIR } from "@/domain/marca-de-agua";
import { scoped } from "@/lib/supabase/scoped";

// PostgREST de Supabase corta en 1.000 filas por consulta, en silencio.
const TOPE_POSTGREST = 1000;

// IO de ADR-100: las tres vistas sobre pool_crudo. Nunca tira: si falla, devuelve `ok: false` y la
// fachada sirve el plan sin marca (D6).
//
// 🩸 La primera versión pedía hasta 5.000 observaciones sin filtrar y PostgREST devolvía 1.000: el
// 15/09 la fachada leía 3.302 filas, recibía 1.000 al azar y servía 68 reels a re-medir cuando eran
// 63 jóvenes + 174 de rescate. Por eso el filtro grueso va en SQL (284 filas ese día) y todo se acota
// a los handles del plan: la regla fina la sigue aplicando `elegirRemedir`.
//
// ponytail: `.in("handle", …)` viaja en la URL. Aguanta unos cientos de referentes; si el roster
// crece a miles, pasa a una RPC con los handles en el body (mismo caso que `cache_transcripts`).
export async function leerDatosMarcaDeAgua(
  ctx: TenantContext,
  o: { diasRecencia: number; piso: number; handles: string[] },
  ahora: Date,
): Promise<DatosMarcaDeAgua> {
  if (!o.handles.length) return { ok: true, marcas: [], ritmos: [], observaciones: [] };
  try {
    const acceso = await scoped(ctx);
    const desdeRecencia = new Date(ahora.getTime() - o.diasRecencia * 86_400_000).toISOString();
    const [marcas, ritmos, obs] = await Promise.all([
      acceso.select("app.v_watermark_referentes", "handle, watermark").eq("plataforma", "instagram").in("handle", o.handles),
      acceso.select("app.v_ritmo_referentes", "handle, ritmo_semanal").eq("plataforma", "instagram").in("handle", o.handles),
      o.piso > 0
        ? acceso
            .select("app.v_remedir_candidatos", "external_id, handle, publicado_en, medido_en, vistas, edad_al_medir_dias")
            .eq("plataforma", "instagram")
            .in("handle", o.handles)
            .gte("publicado_en", desdeRecencia)
            .gte("vistas", Math.floor(o.piso * FRACCION_PISO_REMEDIR))
            // Joven cerca del piso, o sobre el piso (candidato a rescate). El resto nunca entra.
            .or(`edad_al_medir_dias.lt.${DIAS_JOVEN},vistas.gte.${o.piso}`)
            .order("vistas", { ascending: false })
            .limit(TOPE_POSTGREST)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const error = marcas.error ?? ritmos.error ?? obs.error;
    if (error) return { ok: false, error: error.message };
    // supabase-js tipa `.data` como una unión con su caso de error de parseo; ya descartamos `error`
    // arriba, así que acá las filas son las columnas que se pidieron. Se castea al leerlas (mismo
    // criterio que el `as` del mapa de `scoped.ts`: este proyecto no genera `database.types.ts`).
    const filasMarcas = (marcas.data ?? []) as unknown as { handle: string; watermark: string | null }[];
    const filasRitmos = (ritmos.data ?? []) as unknown as { handle: string; ritmo_semanal: unknown }[];
    const filasObs = (obs.data ?? []) as unknown as Record<string, unknown>[];
    for (const [nombre, filas] of [["marcas", filasMarcas], ["ritmos", filasRitmos], ["observaciones", filasObs]] as const) {
      // Llegar al tope es la señal de que puede faltar algo. Las observaciones vienen por vistas desc,
      // así que lo que se corta es lo de menos vistas; igual se grita.
      if (filas.length >= TOPE_POSTGREST) console.error(`[run-plan] marca de agua: ${nombre} llegó al tope de ${TOPE_POSTGREST} filas`);
    }
    return {
      ok: true,
      marcas: filasMarcas,
      ritmos: filasRitmos.map((r) => ({ handle: r.handle, ritmo_semanal: Number(r.ritmo_semanal) })),
      observaciones: filasObs.map((f) => ({
        external_id: String(f.external_id), handle: String(f.handle), publicado_en: String(f.publicado_en),
        medido_en: String(f.medido_en), vistas: Number(f.vistas), edad_al_medir_dias: Number(f.edad_al_medir_dias),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
