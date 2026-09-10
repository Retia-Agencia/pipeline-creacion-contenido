import {
  coberturaDeRespuesta, debeReintentar, esTranscriptEncolado, ganaElReintento, modoResultante,
  textoDeRespuesta, UMBRAL_COBERTURA, type Modo,
} from "@/domain/cobertura";
import { leerClave } from "@/lib/env";
// Las dos llamadas externas del transcriptor (ADR-031): Supadata para el transcript, Haiku para
// traducirlo. Viven acá y solo acá — el BFF es el único portador de secretos (plan-cockpit C2).
//
// ⚠️ INVARIANTE DE PRODUCTO: esto tiene que producir el MISMO script literal que el motor. Los
// parámetros de abajo (endpoint, tope de 6000 caracteres, modelo, y sobre todo el system prompt)
// están copiados textual de los nodos `Transcribir (Supadata)` y `Traducir (Claude Haiku)` de
// Workflows/workflow-short-form-content/workflow.json. Si allá cambian, acá también — si no, el
// equipo recibe dos traducciones distintas del mismo video según de dónde vino (ADR-009).

const TOPE_TRANSCRIPT = 6000;

// Cuánto se espera a Supadata, y por qué son DOS números y no uno.
//
// `auto` lee subtítulos que ya existen y vuelve rápido: 90 s es el número del nodo del motor,
// copiado. `generate` corre un ASR contra el audio y, cuando Supadata lo ENCOLA (ADR-096), la
// respuesta `202` puede tardar minutos en llegar — medido el 10/09: **91 s** para el video de
// 550 s. Esperarla acá no sirve para NADA: esta ruta corre con `maxDuration = 60`, así que una
// llamada que pasa el minuto no devuelve un guion, mata la función, deja la fila sin marcar y la
// pasada siguiente **la vuelve a pagar**.
//
// 25 s es el techo que cabe adentro de ese presupuesto. Que alcance sale de la medición: los
// `generate` que SÍ contestan tardaron **9 s y 13 s** (videos de 76 s y 150 s, pedidos de a uno).
// ⚠️ Esos 3 datos son a concurrencia 1. Si aparece un `generate` legítimo que tarda más de 25 s
// bajo carga, este número lo estaría abortando — y se vería como "el reintento no mejora nunca".
// Lo que lo arregla de raíz no es un timeout más grande sino el polling del `jobId` (ADR-096).
const TIMEOUT_AUTO_MS = 90_000;
const TIMEOUT_GENERATE_MS = 25_000;

export type Transcripcion = {
  texto: string; // vacío = el video no tiene voz o Supadata no pudo
  idioma: string; // código de 2 letras; "" si no se pudo detectar
  cobertura: number | null; // hasta qué segundo llegó el transcript (ADR-095). null = no se pudo medir
  // 🔑 Supadata encoló el ASR y todavía no contestó (ADR-096). Existe porque SIN ESTE CAMPO un
  // `202` tiene exactamente la misma forma que "el video no tiene voz" — `{texto:"", cobertura:
  // null}`— y quien llama no puede distinguir "no hay nada que sacar" de "todavía no".
  encolado: boolean;
};

/** Lo que se guarda: una transcripción y de cuál de los dos modos salió. */
export type TranscripcionConModo = Transcripcion & { modo: Modo };

export async function transcribir(url: string, modo: Modo = "auto"): Promise<Transcripcion> {
  // ADR-095: sin `text=true` Supadata devuelve `content` como segmentos [{text, offset, duration}]
  // en vez de un string. `textoDeSegmentos` arma el MISMO texto que devolvía `text=true` (verificado
  // carácter por carácter) y de paso sale la cobertura, gratis en la misma respuesta que ya se paga.
  const res = await fetch(
    `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}&mode=${modo === "generate" ? "generate" : "auto"}`,
    {
      headers: { "x-api-key": leerClave("SUPADATA_API_KEY") },
      signal: AbortSignal.timeout(modo === "generate" ? TIMEOUT_GENERATE_MS : TIMEOUT_AUTO_MS),
    },
  );

  const cuerpo = await res.json().catch(() => ({}));

  // Supadata contesta 200 con {content}, o un cuerpo {error} cuando el video no tiene voz. Los dos
  // casos son "no hay transcript" y no una falla: el que decide qué hacer es quien llama.
  if (!res.ok && !cuerpo?.error) {
    throw new Error(`Supadata respondió ${res.status}`);
  }

  // La elección de rama (segmentos / `content` string / `text`) vive en `domain/cobertura.ts` y no
  // acá: escrita dos veces, ya había divergido del nodo con `content: []` — el cockpit usaba `text`
  // y el motor devolvía "sin voz" para el mismo video. Se conserva la rama vieja (`content` como
  // string) por si Supadata vuelve a cambiar de forma: eso no puede tumbar la herramienta (mismo
  // fail-open que el nodo `Transcribir (Supadata)`).
  const texto = textoDeRespuesta(cuerpo);
  const cobertura = coberturaDeRespuesta(cuerpo);
  const idioma = String(cuerpo.lang || cuerpo.language || "")
    .toLowerCase()
    .slice(0, 2);

  return {
    texto: texto.trim().slice(0, TOPE_TRANSCRIPT), idioma, cobertura,
    encolado: esTranscriptEncolado(cuerpo, res.status),
  };
}

/**
 * El reintento por cobertura (ADR-095 §Enmienda 2 §A): lo mismo que ya hace el nodo
 * `Transcribir (Supadata)` del motor, del lado donde trabaja Majo.
 *
 * 🔑 **Existía sólo en el motor, y Majo pega los links acá.** Hasta hoy ella recibía el aviso de
 * que el guion venía cortado y el guion cortado — el arreglo le llegaba a los videos que traía el
 * motor y no a los suyos.
 *
 * ⚠️ **Fail-open, igual que todo el resto** (ADR-095 §3.5): si el reintento se cae, queda lo que
 * trajo `auto`. El peor caso de este arreglo tiene que ser el comportamiento de ayer.
 *
 * 💰 Cuesta 2 créditos de Supadata en vez de 1, y sólo sobre los cortados (~4% medido). No se
 * reintenta sin duración: sin ella el veredicto es `desconocido` y `desconocido` no autoriza a
 * gastar.
 */
export async function transcribirConReintento(
  url: string, duracion: number | null,
): Promise<TranscripcionConModo> {
  const primero = await transcribir(url, "auto");

  if (!debeReintentar(primero.cobertura, duracion, UMBRAL_COBERTURA, "auto")) {
    return { ...primero, modo: "auto" };
  }

  try {
    const segundo = await transcribir(url, "generate");
    // 🩸 Un `202` llega acá como "generate no mejoró" y hasta hoy ponía el candado
    // `auto_tras_generate` sobre un video **al que nunca le contestaron** (ADR-096 §Enmienda). Se
    // dice en el log por la misma razón que existe el campo: hasta hoy era mudo.
    if (segundo.encolado) {
      console.error("[transcribir] Supadata encoló el generate (202): queda lo de auto y el video se vuelve a intentar", url);
    }
    const gano = ganaElReintento(primero, segundo);
    const elegido = gano ? segundo : primero;
    return {
      texto: elegido.texto,
      // El idioma del ganador sólo si lo dijo: `generate` a veces no lo trae, y perder el idioma
      // que `auto` sí detectó mandaría el texto a traducir de gusto.
      idioma: elegido.idioma || primero.idioma,
      cobertura: elegido.cobertura,
      encolado: elegido.encolado,
      modo: modoResultante(true, gano, !segundo.encolado),
    };
  } catch (e) {
    // Se dice, no se disimula. Y NO se marca `auto_tras_generate`: una caída de red no es un
    // veredicto sobre el video, así que este video merece otro intento la próxima vez.
    console.error("[transcribir] el reintento con generate falló, queda lo de auto:", e);
    return { ...primero, modo: "auto" };
  }
}

// Copiado textual del nodo `Traducir (Claude Haiku)`. Sin tildes, igual que allá.
const SISTEMA =
  "Sos un traductor literal. Traduci el texto al espanol neutro de forma fiel y literal: sin reescribir, sin resumir, sin embellecer, sin agregar ni quitar nada; conserva el sentido y el orden. Devolve UNICAMENTE el texto traducido, sin comillas ni comentarios.";

// Fail-open igual que el motor: si la traducción falla o vuelve vacía, el script queda como el
// transcript original. Mejor entregar el texto en su idioma que no entregar nada.
export async function traducir(texto: string): Promise<string> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": leerClave("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        system: SISTEMA,
        messages: [{ role: "user", content: texto.slice(0, TOPE_TRANSCRIPT) }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return texto;
    const cuerpo = await res.json();
    const traducido = String(cuerpo?.content?.[0]?.text ?? "").trim();
    return traducido || texto;
  } catch {
    return texto;
  }
}
