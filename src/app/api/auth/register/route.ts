import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, setAuthCookie } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkPasswordStrength } from "@/lib/password";

export async function POST(request: Request) {
  const limited = rateLimit(request, "register", LIMITS.register);
  if (limited) return limited;

  try {
    const { email, password, name } = await request.json();

    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const passwordCheck = checkPasswordStrength(String(password));
    if (!passwordCheck.ok) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 400 }
      );
    }

    // Coste 12: bastante más lento de romper por fuerza bruta y aceptable en login.
    const passwordHash = await bcrypt.hash(String(password), 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        passwordHash,
      },
    });

    // Aplicar invitaciones pendientes: si un coordinador le compartió un
    // grupo a este correo antes de que existiera la cuenta, el acceso se
    // concede ahora.
    try {
      const invites = await prisma.pendingGroupInvite.findMany({
        where: { email: normalizedEmail },
        select: { id: true, groupId: true, role: true },
      });
      for (const inv of invites) {
        await prisma.appAccess.upsert({
          where: { userId_groupId: { userId: user.id, groupId: inv.groupId } },
          create: {
            userId: user.id,
            groupId: inv.groupId,
            role: inv.role,
            isActive: true,
          },
          update: { isActive: true, role: inv.role },
        });
        await prisma.pendingGroupInvite.delete({ where: { id: inv.id } });
      }
    } catch (err) {
      // Si falla, el alta se completa igualmente: el profesor podrá pedirse el
      // acceso de nuevo desde la interfaz.
      console.error("[register] No se pudieron aplicar las invitaciones:", err);
    }

    const token = await signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    return setAuthCookie(response, token);
  } catch {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}