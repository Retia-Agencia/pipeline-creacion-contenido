"use server";

import { revalidatePath } from "next/cache";
import { validarEtiquetaRendimiento } from "@/domain/rendimiento";
import { comoRuta, rutaDe, type CockpitEnRuta } from "@/domain/rutas";
import { exigirPantallaDeAjustes } from "@/lib/auth";
import {
  borrarEtiquetaRendimiento,
  crearEtiquetaRendimiento,
  editarEtiquetaRendimiento,
  leerEtiquetasRendimiento,
} from "@/lib/rendimiento";

export type Resultado = { ok: boolean; mensaje: string };

async function contexto(enRuta: CockpitEnRuta) {
  return exigirPantallaDeAjustes("rendimiento", enRuta.cliente, enRuta.pipeline);
}

const ruta = (cockpit: Awaited<ReturnType<typeof contexto>>["cockpit"]) =>
  rutaDe(comoRuta(cockpit), "ajustes/rendimiento");

export async function crear(
  enRuta: CockpitEnRuta,
  nombre: string,
  minimo: number,
): Promise<Resultado> {
  const { usuario, ctx, cockpit } = await contexto(enRuta);
  try {
    const existentes = await leerEtiquetasRendimiento(ctx);
    const validacion = validarEtiquetaRendimiento(nombre, minimo, existentes);
    if (!validacion.ok) return { ok: false, mensaje: validacion.mensaje };
    await crearEtiquetaRendimiento(ctx, usuario.id, validacion.nombre, validacion.minimo);
    revalidatePath(ruta(cockpit));
    return { ok: true, mensaje: "Etiqueta creada." };
  } catch (e) {
    console.error("[rendimiento] no se pudo crear la etiqueta:", e);
    return { ok: false, mensaje: "No se pudo crear. Recargá y probá de nuevo." };
  }
}

export async function editar(
  enRuta: CockpitEnRuta,
  id: string,
  nombre: string,
  minimo: number,
): Promise<Resultado> {
  const { usuario, ctx, cockpit } = await contexto(enRuta);
  try {
    const existentes = await leerEtiquetasRendimiento(ctx);
    const validacion = validarEtiquetaRendimiento(nombre, minimo, existentes, id);
    if (!validacion.ok) return { ok: false, mensaje: validacion.mensaje };
    await editarEtiquetaRendimiento(ctx, usuario.id, id, validacion.nombre, validacion.minimo);
    revalidatePath(ruta(cockpit));
    return { ok: true, mensaje: "Etiqueta actualizada." };
  } catch (e) {
    console.error("[rendimiento] no se pudo editar la etiqueta:", e);
    return { ok: false, mensaje: "No se pudo guardar. Recargá y probá de nuevo." };
  }
}

export async function borrar(enRuta: CockpitEnRuta, id: string): Promise<Resultado> {
  const { usuario, ctx, cockpit } = await contexto(enRuta);
  try {
    await borrarEtiquetaRendimiento(ctx, usuario.id, id);
    revalidatePath(ruta(cockpit));
    return { ok: true, mensaje: "Etiqueta borrada." };
  } catch (e) {
    console.error("[rendimiento] no se pudo borrar la etiqueta:", e);
    return { ok: false, mensaje: "No se pudo borrar. Recargá y probá de nuevo." };
  }
}
