"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Analítica de producto, autoinstalada y sin dependencias externas.
 *
 * Se manda con `navigator.sendBeacon` para no retrasar la navegación ni
 * penalizar el rendimiento con un fetch bloqueante. Los eventos se acumulan
 * en un buffer pequeño y se envían agrupados.
 *
 * Privacidad: solo se envían nombres de acción y la ruta. Nunca notas, ni
 * nombres de alumnos, ni identificadores. El backend descarta cualquier
 * evento fuera de la lista blanca.
 */

const FLUSH_INTERVAL_MS = 8000;
const MAX_BATCH = 20;

type QueuedEvent = {
  name: string;
  path?: string;
  props?: Record<string, string | number | boolean>;
};

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  const payload = JSON.stringify(batch);

  // sendBeacon sobrevive a la descarga de la página; fetch no siempre.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics",
      new Blob([payload], { type: "application/json" })
    );
    return;
  }

  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* analítica es best-effort: si falla, se descarta */
  });
}

export function track(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  queue.push({ name, path: window.location.pathname, props });
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }
}

/** Exportar desde la consola del navegador durante el desarrollo. */
if (typeof window !== "undefined") {
  (window as unknown as { track?: typeof track }).track = track;
}

export function reportError(err: unknown, path?: string) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  void fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message.slice(0, 500),
      stack: stack?.slice(0, 4000),
      path: path ?? window.location.pathname,
    }),
  }).catch(() => {
    /* best-effort */
  });
}

export function AnalyticsProvider() {
  const pathname = usePathname();

  // Vista de página: alimenta "dónde pasan el tiempo".
  useEffect(() => {
    track("page_view");
  }, [pathname]);

  // Errores no capturados: pantalla en blanco, promesa rechazada, etc.
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Último volcado antes de cerrar la pestaña.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}