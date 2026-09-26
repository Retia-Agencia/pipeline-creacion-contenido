"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { busquedasQueAlcanzan, haceCuanto } from "@/domain/corrida";
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
//
// 🩸 Y ese mismo día (ADR-100) las dos frases quedaron falsas: el número seguía siendo el TECHO
// (cuentas × videos por cuenta) cuando la marca de agua ya compra solo lo nuevo, y "si ya se buscó
// esta semana, trae casi los mismos videos" dejó de pasar — la búsqueda no repite. `queCostariaCorrer`
// ahora estima con la marca de agua puesta (`costoDeCorridaConMarca`) y cae al techo si está apagada
// o no se pudo leer (`estimado.costo.conMarca` lo distingue); la frase la reemplaza cuándo fue la
// última búsqueda, que es verdad se use o no la marca.
//
// 🩸 Y desde el audit del 2026-09-25 el saldo deja de leerse como si fuera exclusivo del ▶: el cupo
// de Apify es UNO para todo (docs/costos.md §1.1). Transcribir compra metadata por cada link pegado
// (~0,0023 USD/URL) del MISMO saldo —el 24/09 gastó 0,91 USD sin una sola corrida— y el motor se
// planta solo cuando quedan menos de ~2,5 USD (`margen_cupo_apify_usd`, ADR-094). Las dos cosas se
// dicen en la confirmación cuando hay saldo para mostrarlas.
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
                Esta búsqueda cuesta{" "}
                {estimado.costo.conMarca ? (
                  <>
                    ~<strong>{usd(estimado.costo.usd)} USD</strong> (hasta {usd(estimado.costo.techoUsd)})
                  </>
                ) : (
                  <>
                    hasta <strong>{usd(estimado.costo.usd)} USD</strong>
                  </>
                )}{" "}
                ({estimado.costo.cuentas} cuentas × {estimado.costo.resultadosPorCuenta} videos).{" "}
                {estimado.costo.proyectos > 1 &&
                  `Son las cuentas distintas de los ${estimado.costo.proyectos} proyectos: una cuenta que alimenta a varios se paga una sola vez. `}
                {estimado.saldo && libre !== null && alcanza !== null && (
                  <>
                    Quedan {usd(libre)} USD hasta el {fecha(estimado.saldo.finCiclo)}:{" "}
                    <strong className={alcanza <= 1 ? "text-destructive" : undefined}>
                      {alcanza === 0 ? "no alcanza" : `alcanza para ${alcanza}`}
                    </strong>
                    .{" "}
                    Ojo: Transcribir también gasta de este saldo (~0,0023 USD por link pegado), y el
                    motor se planta solo cuando quedan menos de ~2,50 USD.{" "}
                  </>
                )}
                {estimado.ultimaBusqueda
                  ? `La última búsqueda fue ${haceCuanto(estimado.ultimaBusqueda, new Date())}. `
                  : "Todavía no hay ninguna búsqueda registrada. "}
                ¿Seguro?
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
