import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";

/**
 * Formulario de contacto.
 *
 * Límite estricto (3 por hora por IP) porque cada envío consume cuota de
 * Resend: sin este límite, cualquiera que descubra la ruta puede agotar el
 * correo con solicitudes desde muchas IPs distintas o con bucles automáticos.
 */

const MAX_PER_HOUR = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "contact", {
    limit: MAX_PER_HOUR,
    windowMs: 60 * 60_000,
  });
  if (limited) return limited;

  let body: { name?: string; email?: string; subject?: string; message?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Campo trampa: los robots rellenan los formularios, los humanos no ven nada.
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().slice(0, 120).toLowerCase();
  const subject = String(body.subject ?? "").trim().slice(0, 120);
  const message = String(body.message ?? "").trim().slice(0, 3000);

  if (!name || !message) {
    return NextResponse.json(
      { error: "El nombre y el mensaje son obligatorios" },
      { status: 400 }
    );
  }

  // El email es opcional: si no es válido se descarta en lugar de rechazar.
  const contactEmail = EMAIL_RE.test(email) ? email : "(sin email)";

  // Se guarda el mensaje aunque no se pueda enviar el email: así no se pierde.
  let stored = false;
  try {
    const session = await getSessionUser();
    await prisma.contactMessage.create({
      data: {
        name,
        email: EMAIL_RE.test(email) ? email : null,
        subject: subject || null,
        message,
        userId: session?.userId ?? null,
      },
    });
    stored = true;
  } catch (err) {
    console.error("[contact] No se pudo guardar el mensaje:", err);
  }

  if (!stored) {
    return NextResponse.json(
      { error: "No se pudo registrar el mensaje. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  // Se guarda siempre; el email es best-effort. Si Resend falla, el mensaje
  // sigue siendo recuperable desde la base de datos.
  const contactTo = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM;
  let sent = false;
  if (contactTo) {
    sent = await sendEmail({
      to: contactTo,
      subject: `[Contacto] ${subject || "Sin asunto"} — ${name}`,
      html: `
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(contactEmail)}</p>
        ${subject ? `<p><strong>Asunto:</strong> ${escapeHtml(subject)}</p>` : ""}
        <hr />
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
    });
  } else {
    console.warn("[contact] CONTACT_EMAIL y EMAIL_FROM sin definir: mensaje solo guardado.");
  }

  return NextResponse.json({ ok: true, emailed: sent });
}