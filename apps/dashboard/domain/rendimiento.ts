export type MetricaRendimiento = "vpd";

export type EtiquetaRendimiento = {
  id: string;
  nombre: string;
  metrica: MetricaRendimiento;
  minimo: number;
};

export type ContraSuEdad = "top 10 %" | "top 25 %" | "top 50 %" | "mitad de abajo";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Vistas por día de vida. El mismo día cuenta como uno para no dividir por cero. */
export function vpd(
  views: number | null | undefined,
  publicadoEn: string | null | undefined,
  medidoEn: string,
): number | null {
  if (views == null || !publicadoEn) return null;
  const publicado = new Date(publicadoEn).getTime();
  const medido = new Date(medidoEn).getTime();
  if (!Number.isFinite(publicado) || !Number.isFinite(medido)) return null;
  return views / Math.max((medido - publicado) / DIA_MS, 1);
}

export function etiquetaDe(
  valor: number | null,
  etiquetas: readonly EtiquetaRendimiento[],
): EtiquetaRendimiento | null {
  if (valor == null) return null;
  return etiquetas
    .filter((etiqueta) => etiqueta.minimo <= valor)
    .sort((a, b) => b.minimo - a.minimo)[0] ?? null;
}

/**
 * ponytail: cortes fijos por ADR-104 D2 y plan-refactor-motor §1.5 (medidos el 18/10).
 * Re-medir con docs/experimentos/2026-10-18-etiqueta-rendimiento.sql.
 */
export function contraSuEdad(valor: number | null, diasDeVida: number): ContraSuEdad | null {
  if (valor == null || !Number.isFinite(diasDeVida)) return null;
  const [top10, top25, top50] =
    diasDeVida < 7 ? [70000, 22000, 7000]
    : diasDeVida < 14 ? [40000, 15000, 3500]
    : diasDeVida <= 50 ? [20000, 6000, 1500]
    : [5000, 1300, 250];

  if (valor >= top10) return "top 10 %";
  if (valor >= top25) return "top 25 %";
  if (valor >= top50) return "top 50 %";
  return "mitad de abajo";
}

export function esInstagram(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

type EtiquetaEditable = Pick<EtiquetaRendimiento, "id" | "nombre" | "minimo">;

export type ValidacionEtiqueta =
  | { ok: true; nombre: string; minimo: number }
  | { ok: false; mensaje: string };

export function validarEtiquetaRendimiento(
  nombreCrudo: string,
  minimoCrudo: number,
  existentes: readonly EtiquetaEditable[],
  idActual?: string,
): ValidacionEtiqueta {
  const nombre = nombreCrudo.trim();
  if (nombre.length < 1 || nombre.length > 40) {
    return { ok: false, mensaje: "El nombre debe tener entre 1 y 40 caracteres." };
  }
  if (!Number.isInteger(minimoCrudo) || minimoCrudo < 0) {
    return { ok: false, mensaje: "El mínimo debe ser un número entero mayor o igual a 0." };
  }
  const otras = existentes.filter((etiqueta) => etiqueta.id !== idActual);
  if (otras.some((etiqueta) => etiqueta.nombre === nombre)) {
    return { ok: false, mensaje: "Ya existe una etiqueta con ese nombre." };
  }
  if (otras.some((etiqueta) => etiqueta.minimo === minimoCrudo)) {
    return { ok: false, mensaje: "Ya existe una etiqueta con ese mínimo." };
  }
  return { ok: true, nombre, minimo: minimoCrudo };
}
