import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";
import { sendEmail, buildReminderEmail } from "@/lib/email";

// GET: Listar recordatorios del usuario (opcionalmente filtrados por grupo)
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const reminders = await prisma.reminder.findMany({
    where: {
      userId: user!.id,
      ...(groupId ? { groupId } : {}),
    },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(reminders);
}

// POST: Crear recordatorio (opcionalmente envía email)
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { groupId, title, message, dueDate, sendEmail: shouldSendEmail, email } = await request.json();

    if (groupId && !(await verifyGroupOwnership(groupId, user!.id))) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: user!.id,
        groupId: groupId || null,
        title: title.trim(),
        message: message?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    // Send email if requested
    let emailSent = false;
    if (shouldSendEmail && email) {
      const groupName = groupId
        ? (await prisma.group.findFirst({ where: { id: groupId } }))?.name
        : undefined;

      emailSent = await sendEmail({
        to: email,
        subject: `📚 Recordatorio: ${title.trim()}`,
        html: buildReminderEmail({
          teacherName: user!.email?.split("@")[0] || "Profesor",
          reminderTitle: title.trim(),
          reminderMessage: message?.trim(),
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString("es-ES") : undefined,
          groupName,
        }),
      });
    }

    return NextResponse.json({ ...reminder, emailSent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear el recordatorio" }, { status: 500 });
  }
}

// PUT: Actualizar recordatorio
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id, title, message, dueDate, completed } = await request.json();

    const found = await prisma.reminder.findFirst({
      where: { id, userId: user!.id },
    });

    if (!found) {
      return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });
    }

    const reminder = await prisma.reminder.update({
      where: { id },
      data: {
        title: title?.trim() ?? found.title,
        message: message === undefined ? found.message : (message?.trim() || null),
        dueDate: dueDate === undefined ? found.dueDate : (dueDate ? new Date(dueDate) : null),
        completed: completed ?? found.completed,
      },
    });

    return NextResponse.json(reminder);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE: Eliminar recordatorio
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    const found = await prisma.reminder.findFirst({
      where: { id, userId: user!.id },
    });

    if (!found) {
      return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });
    }

    await prisma.reminder.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
