"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Opcion, TipoAjuste } from "@/domain/ajustes";
import { guardar, type ResultadoGuardar } from "./actions";
import { usarCockpit } from "../../usar-cockpit";

// Un knob = una fila editable. El botón Guardar aparece SOLO cuando el valor cambió: sin eso,
// 18 botones siempre activos invitan a guardar sin querer y no se ve de un vistazo qué se tocó.
// La validación de verdad vive en el servidor (domain/ajustes.ts); acá el input solo acota.

const PASOS: Record<TipoAjuste, { paso: string; min: string; max?: string }> = {
  proporcion: { paso: "0.05", min: "0", max: "1" },
  entero: { paso: "1", min: "0" },
  entero_positivo: { paso: "1", min: "1" },
  toggle: { paso: "1", min: "0", max: "1" },
  opcion: { paso: "1", min: "0" },
};

const SI_NO: readonly Opcion[] = [
  [1, "Sí"],
  [0, "No"],
];

export function Knob({
  clave,
  valor,
  descripcion,
  tipo,
  opciones,
}: {
  clave: string;
  valor: number | null;
  descripcion: string | null;
  tipo: TipoAjuste;
  opciones?: readonly Opcion[];
}) {
  const cockpit = usarCockpit();
  const guardado = valor === null ? "" : String(valor);
  const [texto, setTexto] = useState(guardado);
  const [resultado, setResultado] = useState<ResultadoGuardar | null>(null);
  const [enviando, startTransition] = useTransition();

  const cambiado = texto.trim() !== guardado;
  const id = `knob-${clave}`;

  const enviar = () => {
    startTransition(async () => setResultado(await guardar(cockpit, clave, texto)));
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b py-4 last:border-b-0">
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {clave}
        </Label>
        {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
        {resultado && (
          <p className={`text-xs ${resultado.ok ? "text-muted-foreground" : "text-destructive"}`}>
            {resultado.mensaje}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {tipo === "toggle" || tipo === "opcion" ? (
          // 1/0 en la base, Sí/No en la pantalla: el equipo no tiene por qué saber que es un número.
          // Un `opcion` es lo mismo con más de dos valores, cada uno con su etiqueta del CATALOGO.
          // `h-8 w-32` es exactamente la caja del <Input> de al lado: con 18 knobs, dos tamaños
          // distintos convierten la columna de valores en un escalón y se lee como un error.
          <select
            id={id}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={enviando}
            className="h-8 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            {(tipo === "opcion" ? (opciones ?? []) : SI_NO).map(([v, etiqueta]) => (
              <option key={v} value={String(v)}>
                {etiqueta}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={enviando}
            step={PASOS[tipo].paso}
            min={PASOS[tipo].min}
            max={PASOS[tipo].max}
            className="w-32 text-right tabular-nums"
          />
        )}
        <Button size="sm" onClick={enviar} disabled={!cambiado || enviando} className={cambiado ? "" : "invisible"}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
