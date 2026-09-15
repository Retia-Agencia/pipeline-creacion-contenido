"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { busquedasQueAlcanzan } from "@/domain/corrida";
import { correrAhora, queCostariaCorrer, type ResultadoDisparo } from "./actions";
import { usarCockpit } from "../usar-cockpit";
import { MOTOR_BLOQUEADO } from "./bloqueo";

// `undefined` = calculando · `null` = no se pudo calcular (fail-open) · objeto = el número.
// Antes "calculando" y "falló" eran el mismo `null`, así que durante los segundos que tarda Apify en
// dar el saldo se pintaba la frase vieja sin números y el "Sí, correr" ya se podía apretar.
type Estimado = Awaited<ReturnType<typeof queCostariaCorrer>> | undefined;

const usd = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });

// Correr cuesta créditos (Apify + transcripción) aunque no entregue nada nuevo:
// por eso el click pide confirmación explícita (plan-cockpit §3.3).
//
// 📏 Desde el 2026-09-15 la confirmación dice el COSTO y lo que QUEDA del cupo, contados al apretar.
// "¿Seguro?" no frenó las búsquedas repetidas del 10/09; "cuesta 3,40 y alcanza para 6" es la misma
// información, y es la única de las dos que se lee.
export function BotonCorrer({ deshabilitado }: { deshabilitado: boolean }) {
  const cockpit = usarCockpit();
  const [confirmando, setConfirmando] = useState(false);
  const [estimado, setEstimado] = useState<Estimado>(undefined);
  const [resultado, setResultado] = useState<ResultadoDisparo | null>(null);
  const [enviando, startTransition] = useTransition();

  const preguntar = () => {
    setConfirmando(true);
    setEstimado(undefined);
    startTransition(async () => setEstimado(await queCostariaCorrer(cockpit)));
  };

  const disparar = () => {
    setConfirmando(false);
    startTransition(async () => {
      setResultado(await correrAhora(cockpit));
    });
  };

  // Bloqueo temporal (ver `bloqueo.ts`). Por sí solo es cosmético: se decide al renderizar,
  // así que una pestaña abierta de antes lo sigue viendo habilitado. El freno de verdad vive
  // en la server action, que mira el mismo flag.
  if (MOTOR_BLOQUEADO) {
    return <Button disabled>🚧 Bajo construcción por dev</Button>;
  }

  if (deshabilitado) {
    return (
      <Button disabled>Hay una corrida en curso — esperá a que termine</Button>
    );
  }

  const libre = estimado?.saldo ? Math.max(0, estimado.saldo.topeUsd - estimado.saldo.usadoUsd) : null;
  const alcanza = estimado && libre !== null ? busquedasQueAlcanzan(libre, estimado.costo.usd) : null;

  return (
    <div className="space-y-3">
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {estimado === undefined ? (
              "Calculando cuánto cuesta…"
            ) : estimado === null ? (
              "Correr gasta créditos aunque no haya videos nuevos. ¿Seguro?"
            ) : (
              <>
                Esta búsqueda cuesta hasta <strong>{usd(estimado.costo.usd)} USD</strong> (
                {estimado.costo.cuentas} cuentas × {estimado.costo.resultadosPorCuenta} videos).{" "}
                {estimado.costo.proyectos > 1 &&
                  `Son las cuentas distintas de los ${estimado.costo.proyectos} proyectos: una cuenta que alimenta a varios se paga una sola vez. `}
                {estimado.saldo && libre !== null && alcanza !== null && (
                  <>
                    Quedan {usd(libre)} USD hasta el {fecha(estimado.saldo.finCiclo)}:{" "}
                    <strong className={alcanza <= 1 ? "text-destructive" : undefined}>
                      {alcanza === 0 ? "no alcanza" : `alcanza para ${alcanza}`}
                    </strong>
                    .{" "}
                  </>
                )}
                Si ya se buscó esta semana, trae casi los mismos videos. ¿Seguro?
              </>
            )}
          </span>
          <Button onClick={disparar} disabled={enviando || estimado === undefined}>
            Sí, correr
          </Button>
          <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={enviando}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button onClick={preguntar} disabled={enviando}>
          {enviando ? "Enviando señal…" : "▶ Buscar contenido"}
        </Button>
      )}
      {resultado && (
        <Alert variant={resultado.ok ? "default" : "destructive"}>
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
