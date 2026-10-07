import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Webhook del proveedor de pago (Lemon Squeezy / Stripe / Gumroad).
 *
 * La escritura de la licencia NO ocurre aquí directamente desde el navegador:
 * el navegador es del cliente y falseable. Este endpoint es el que autoriza,
 * y se protege con el secreto que el proveedor firma o envía.
 *
 * Configurar una sola vez, sin desplegar código.
 */
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    // Sin secreto configurado el webhook queda cerrado: mejor no activates
    // licencias por error que abrir un endpoint público que regale cuentas.
    console.error("[webhook] PAYMENT_WEBHOOK_SECRET no configurado");
    return false;
  }
  const header = request.headers.get("x-webhook-secret");
  return header === secret;
}

/** Extrae el email y la referencia del cuerpo, tolerando formatos distintos. */
function parsePayload(body: Record<string, unknown>): {
  email: string | null;
  paymentRef: string | null;
  plan: string;
  priceCents: number;
} {
  const data = (body.data ?? body) as Record<string, unknown>;
  const attrs = (data.attributes ?? {}) as Record<string, unknown>;

  const email =
    pickString(attrs.email) ??
    pickString(data.email) ??
    pickString((body as Record<string, unknown>).email);

  const paymentRef =
    pickString(data.identifier) ??
    pickString(data.order_id) ??
    pickString(data.payment_id) ??
    pickString(body.id) ??
    null;

  const planName = pickString(attrs.plan_name) ?? pickString(data.plan_name) ?? "";
  const plan = /centro|school|colegio/i.test(planName) ? "CENTRO" : "PROFESOR";

  const amountRaw = attrs.amount ?? data.amount ?? data.total ?? 0;
  const priceCents =
    typeof amountRaw === "number"
      ? Math.round(amountRaw)
      : parseInt(String(amountRaw), 10) || 0;

  return { email, paymentRef, plan, priceCents };
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const event = String(body.event ?? body.type ?? "");
  const { email, paymentRef, plan, priceCents } = parsePayload(body);

  // Evento de reembolso: se revoca la licencia.
  if (/refund|chargeback|cancel/i.test(event)) {
    if (paymentRef) {
      await prisma.license.updateMany({
        where: { paymentRef },
        data: { status: "refunded" },
      });
    }
    return NextResponse.json({ ok: true, action: "revoked" });
  }

  if (!/order|paid|purchase|created|succeeded/i.test(event)) {
    // Evento que no nos interesa (p. ej. "product_created").
    return NextResponse.json({ ok: true, action: "ignored" });
  }

  if (!email || !paymentRef) {
    console.warn("[webhook] Evento de pago sin email o referencia:", event);
    return NextResponse.json({ ok: true, action: "incomplete" });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (!user) {
    // Puede ocurrir que paguen antes de registrarse: el pago sigue siendo
    // válido, pero la licencia se activará cuando se cree la cuenta.
    console.warn(`[webhook] Pago de ${email} sin cuenta registrada`);
    return NextResponse.json({ ok: true, action: "no-user" });
  }

  const license = await prisma.license.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan,
      priceCents,
      paymentRef,
      status: "active",
      versionAtPurchase: process.env.npm_package_version ?? null,
    },
    update: {
      plan,
      priceCents,
      paymentRef,
      status: "active",
    },
  });

  return NextResponse.json({ ok: true, action: "granted", licenseId: license.id });
}