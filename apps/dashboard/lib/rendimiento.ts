import { z } from "zod";
import type { EtiquetaRendimiento } from "@/domain/rendimiento";
import type { TenantContext } from "@/domain/tenant";
import { registrarEvento } from "@/lib/eventos";
import { scoped } from "@/lib/supabase/scoped";

const filaEtiqueta = z.object({
  id: z.string(),
  nombre: z.string(),
  metrica: z.literal("vpd"),
  minimo: z.coerce.number(),
});

export async function leerEtiquetasRendimiento(ctx: TenantContext): Promise<EtiquetaRendimiento[]> {
  const { data, error } = await (await scoped(ctx))
    .select("app.etiquetas_rendimiento", "id, nombre, metrica, minimo")
    .order("minimo", { ascending: false });
  if (error) throw new Error(`Supabase respondió con error leyendo etiquetas: ${error.message}`);
  return z.array(filaEtiqueta).parse(data ?? []);
}

export async function crearEtiquetaRendimiento(
  ctx: TenantContext,
  usuarioId: string,
  nombre: string,
  minimo: number,
): Promise<EtiquetaRendimiento> {
  const { data, error } = await (await scoped(ctx))
    .insert("app.etiquetas_rendimiento", [{ nombre, minimo }])
    .select("id, nombre, metrica, minimo")
    .single();
  if (error) throw new Error(`Supabase respondió con error creando la etiqueta: ${error.message}`);
  const despues = filaEtiqueta.parse(data);
  await registrarEvento(ctx, usuarioId, "rendimiento.etiqueta_crear", { antes: null, despues });
  return despues;
}

export async function editarEtiquetaRendimiento(
  ctx: TenantContext,
  usuarioId: string,
  id: string,
  nombre: string,
  minimo: number,
): Promise<EtiquetaRendimiento> {
  const antes = await leerUna(ctx, id);
  if (!antes) throw new Error("NO_ESTA");
  const { data, error } = await (await scoped(ctx))
    .update("app.etiquetas_rendimiento", { nombre, minimo, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select("id, nombre, metrica, minimo");
  if (error) throw new Error(`Supabase respondió con error editando la etiqueta: ${error.message}`);
  const despues = filaEtiqueta.parse(data?.[0]);
  await registrarEvento(ctx, usuarioId, "rendimiento.etiqueta_editar", { antes, despues });
  return despues;
}

export async function borrarEtiquetaRendimiento(
  ctx: TenantContext,
  usuarioId: string,
  id: string,
): Promise<void> {
  const antes = await leerUna(ctx, id);
  if (!antes) throw new Error("NO_ESTA");
  const { data, error } = await (await scoped(ctx))
    .borrar("app.etiquetas_rendimiento")
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Supabase respondió con error borrando la etiqueta: ${error.message}`);
  if (!data || data.length === 0) throw new Error("NO_ESTA");
  await registrarEvento(ctx, usuarioId, "rendimiento.etiqueta_borrar", { antes, despues: null });
}

async function leerUna(ctx: TenantContext, id: string): Promise<EtiquetaRendimiento | null> {
  const { data, error } = await (await scoped(ctx))
    .select("app.etiquetas_rendimiento", "id, nombre, metrica, minimo")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Supabase respondió con error leyendo la etiqueta: ${error.message}`);
  return data ? filaEtiqueta.parse(data) : null;
}
