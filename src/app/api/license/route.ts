import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Estado de la licencia del usuario.
 *
 * While en desarrollo, `LICENSES_DISABLED=true` deja la app abierta para no
 * bloquear al propio desarrollador. En producción ese flag debe estar en false:
 * es lo que hace que la app sea de pago y no una donation.
 */
export async function GET() {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const licensesDisabled = process.env.LICENSES_DISABLED === "true";

  const license = await prisma.license.findUnique({
    where: { userId: user!.id },
    select: {
      plan: true,
      status: true,
      purchasedAt: true,
      priceCents: true,
      currency: true,
      versionAtPurchase: true,
      paymentRef: true,
    },
  });

  const active = Boolean(license && license.status === "active");

  return NextResponse.json({
    licensesDisabled,
    active: licensesDisabled || active,
    plan: license?.plan ?? null,
    purchasedAt: license?.purchasedAt ?? null,
    priceCents: license?.priceCents ?? null,
    currency: license?.currency ?? "EUR",
    versionAtPurchase: license?.versionAtPurchase ?? null,
    paymentRef: license?.paymentRef ?? null,
  });
}