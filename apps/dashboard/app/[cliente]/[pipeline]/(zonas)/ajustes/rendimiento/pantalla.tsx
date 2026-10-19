"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EtiquetaRendimiento } from "@/domain/rendimiento";
import { intentar } from "@/lib/accion";
import { usarCockpit } from "../../usar-cockpit";
import { borrar, crear, editar, type Resultado } from "./actions";

const numero = (valor: number) => new Intl.NumberFormat("es-CO").format(valor);

export function PantallaRendimiento({ iniciales }: { iniciales: EtiquetaRendimiento[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva etiqueta</CardTitle>
          <CardDescription>
            Hoy la métrica es vistas por día de vida. Se puede ampliar a otras métricas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioCrear />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Etiquetas del Feed</CardTitle>
          <CardDescription>
            Cada mínimo empieza una franja; la etiqueta siguiente define hasta dónde llega.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {iniciales.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Todavía no hay etiquetas.</p>
          ) : (
            iniciales.map((etiqueta, indice) => (
              <Fila
                key={etiqueta.id}
                etiqueta={etiqueta}
                hasta={indice === 0 ? null : iniciales[indice - 1]!.minimo}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FormularioCrear() {
  const cockpit = usarCockpit();
  const [nombre, setNombre] = useState("");
  const [minimo, setMinimo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, startTransition] = useTransition();

  const enviar = () =>
    startTransition(async () => {
      const r = await intentar(() => crear(cockpit, nombre, Number(minimo)));
      setResultado(r);
      if (r.ok) {
        setNombre("");
        setMinimo("");
      }
    });

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="rendimiento-nombre-nuevo">Nombre</Label>
        <Input
          id="rendimiento-nombre-nuevo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={enviando}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rendimiento-minimo-nuevo">Mínimo de vistas/día</Label>
        <Input
          id="rendimiento-minimo-nuevo"
          type="number"
          min="0"
          step="1"
          value={minimo}
          onChange={(e) => setMinimo(e.target.value)}
          disabled={enviando}
        />
      </div>
      <Button onClick={enviar} disabled={enviando || !nombre.trim() || minimo === ""}>
        Agregar
      </Button>
      {resultado && (
        <p
          className={`text-sm sm:col-span-3 ${resultado.ok ? "text-muted-foreground" : "text-destructive"}`}
        >
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}

function Fila({ etiqueta, hasta }: { etiqueta: EtiquetaRendimiento; hasta: number | null }) {
  const cockpit = usarCockpit();
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const [minimo, setMinimo] = useState(String(etiqueta.minimo));
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, startTransition] = useTransition();
  const ejecutar = (accion: () => Promise<Resultado>) =>
    startTransition(async () => {
      setResultado(await intentar(accion));
      setConfirmando(false);
    });

  return (
    <div className="space-y-3 border-b py-4 last:border-b-0">
      <p className="text-sm text-muted-foreground">
        desde {numero(etiqueta.minimo)}
        {hasta === null ? "" : ` hasta ${numero(hasta)}`} vistas/día
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor={`rendimiento-nombre-${etiqueta.id}`}>Nombre</Label>
          <Input
            id={`rendimiento-nombre-${etiqueta.id}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={enviando}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`rendimiento-minimo-${etiqueta.id}`}>Mínimo</Label>
          <Input
            id={`rendimiento-minimo-${etiqueta.id}`}
            type="number"
            min="0"
            step="1"
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
            disabled={enviando}
          />
        </div>
        <Button
          variant="outline"
          disabled={enviando || !nombre.trim() || minimo === ""}
          onClick={() => ejecutar(() => editar(cockpit, etiqueta.id, nombre, Number(minimo)))}
        >
          Guardar
        </Button>
        {confirmando ? (
          <div className="flex gap-1">
            <Button
              variant="destructive"
              disabled={enviando}
              onClick={() => ejecutar(() => borrar(cockpit, etiqueta.id))}
            >
              Confirmar
            </Button>
            <Button variant="ghost" disabled={enviando} onClick={() => setConfirmando(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button variant="ghost" disabled={enviando} onClick={() => setConfirmando(true)}>
            Borrar
          </Button>
        )}
      </div>
      {resultado && (
        <p className={`text-sm ${resultado.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
