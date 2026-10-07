import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Ingesta de eventos de analítica.
 *
 * Privacidad: solo se acepta un conjunto cerrado de nombres de evento y
 * properties simples. Nada de lo que se envía contiene notas, nombres de
 * alumnos ni identificadores: si metiera datos de menores en un evento de
 * analítica, estaríamos duplicando datos sensibles fuera de su contexto.
 */

const ALLOWED_EVENTS = new Set([
  "page_view",
  "click",
  "group_created",
  "group_cloned",
  "report_opened",
  "family_link_created",
  "family_link_revoked",
  "family_report_viewed",
  "pdf_exported",
  "excel_exported",
  "rubric_opened",
  "optional_used",
]);

const MAX_PROPS = 6;
const MAX_PROP_VALUE = 120;

function sanitizeProps(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const entries = Object.entries(input as Record<string, unknown>).slice(0, MAX_PROPS);
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k.slice(0, 40)] = String(v).slice(0, MAX_PROP_VALUE);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "analytics", { limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = (await request.json()) as {
      name?: string;
      path?: string;
      props?: unknown;
    };

    const name = String(body.name ?? "");
    if (!ALLOWED_EVENTS.has(name)) {
      // Evento desconocido: se ignora en silencio para no romper al cliente.
      return NextResponse.json({ ok: true, ignored: true });
    }

    await prisma.analyticsEvent.create({
      data: {
        name,
        userId: user!.id,
        path: body.path ? String(body.path).slice(0, 200) : null,
        props: sanitizeProps(body.props),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}