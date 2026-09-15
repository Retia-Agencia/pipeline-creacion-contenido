import type { DatosMarcaDeAgua } from "@/domain/run-plan";
import type { TenantContext } from "@/domain/tenant";
import { DIAS_JOVEN } from "@/domain/marca-de-agua";
import { scoped } from "@/lib/supabase/scoped";

// IO de ADR-100: las tres vistas sobre pool_crudo. Nunca tira: si falla, devuelve `ok: false` y la
// fachada sirve el plan sin marca (D6).
export async function leerDatosMarcaDeAgua(ctx: TenantContext, diasRecencia: number, ahora: Date): Promise<DatosMarcaDeAgua> {
  try {
    const acceso = await scoped(ctx);
    const desdeRecencia = new Date(ahora.getTime() - diasRecencia * 86_400_000).toISOString();
    const [marcas, ritmos, obs] = await Promise.all([
      acceso.select("app.v_watermark_referentes", "handle, watermark").eq("plataforma", "instagram"),
      acceso.select("app.v_ritmo_referentes", "handle, ritmo_semanal").eq("plataforma", "instagram"),
      acceso
        .select("app.v_remedir_candidatos", "external_id, handle, publicado_en, medido_en, vistas, edad_al_medir_dias")
        .eq("plataforma", "instagram")
        .gte("publicado_en", desdeRecencia)
        .lt("edad_al_medir_dias", DIAS_JOVEN)
        .limit(5000),
    ]);
    const error = marcas.error ?? ritmos.error ?? obs.error;
    if (error) return { ok: false, error: error.message };
    // supabase-js tipa `.data` como una unión con su caso de error de parseo; ya descartamos `error`
    // arriba, así que acá las filas son las columnas que se pidieron. Se castea al leerlas (mismo
    // criterio que el `as` del mapa de `scoped.ts`: este proyecto no genera `database.types.ts`).
    const filasMarcas = (marcas.data ?? []) as unknown as { handle: string; watermark: string | null }[];
    const filasRitmos = (ritmos.data ?? []) as unknown as { handle: string; ritmo_semanal: unknown }[];
    const filasObs = (obs.data ?? []) as unknown as Record<string, unknown>[];
    return {
      ok: true,
      marcas: filasMarcas,
      ritmos: filasRitmos.map((r) => ({ handle: r.handle, ritmo_semanal: Number(r.ritmo_semanal) })),
      observaciones: filasObs.map((o) => ({
        external_id: String(o.external_id), handle: String(o.handle), publicado_en: String(o.publicado_en),
        medido_en: String(o.medido_en), vistas: Number(o.vistas), edad_al_medir_dias: Number(o.edad_al_medir_dias),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
