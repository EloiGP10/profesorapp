import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { signSession, setAuthCookie } from "@/lib/session";

// GET: Obtener datos de perfil y estadísticas del docente
export async function GET() {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          groups: true,
        },
      },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const studentCount = await prisma.student.count({
    where: { group: { userId: user!.id } },
  });

  return NextResponse.json({
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      createdAt: dbUser.createdAt,
      groupsCount: dbUser._count.groups,
      studentsCount: studentCount,
    },
  });
}

// PUT: Actualizar nombre, email o contraseña
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { name, email, currentPassword, newPassword } = await request.json();

    const dbUser = await prisma.user.findUnique({
      where: { id: user!.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const updateData: { name?: string | null; email?: string; passwordHash?: string } = {};

    // Actualizar nombre
    if (name !== undefined) {
      updateData.name = name ? String(name).trim() : null;
    }

    // Actualizar email
    if (email && email.trim().toLowerCase() !== dbUser.email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing && existing.id !== dbUser.id) {
        return NextResponse.json({ error: "Ese correo electrónico ya está en uso" }, { status: 400 });
      }
      updateData.email = normalizedEmail;
    }

    // Actualizar contraseña
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Debes introducir tu contraseña actual para cambiarla" }, { status: 400 });
      }

      if (dbUser.passwordHash) {
        const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
        if (!isValid) {
          return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
        }
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres" }, { status: 400 });
      }

      updateData.passwordHash = await bcrypt.hash(String(newPassword), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user!.id },
      data: updateData,
      select: { id: true, email: true, name: true },
    });

    // Actualizar la cookie de sesión con el nuevo token si cambió email o nombre
    const token = await signSession({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    });

    const response = NextResponse.json({
      ok: true,
      user: updatedUser,
      message: "Perfil actualizado correctamente",
    });
    return setAuthCookie(response, token);
  } catch {
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
