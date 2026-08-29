import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, setAuthCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
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