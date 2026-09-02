import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) {
    return NextResponse.json({ error: "groupId requerido" }, { status: 400 });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, userId: user.id },
  });
  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  let schedule = await prisma.schedule.findFirst({
    where: { groupId },
    include: { slots: { orderBy: [{ day: "asc" }, { startMinute: "asc" }, { order: "asc" }] } },
  });

  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: { groupId, name: "Horario semanal" },
      include: { slots: true },
    });
  }

  return NextResponse.json(schedule);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const { groupId, slot } = body;

  if (!groupId || !slot) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, userId: user.id },
  });
  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  let schedule = await prisma.schedule.findFirst({ where: { groupId } });
  if (!schedule) {
    schedule = await prisma.schedule.create({ data: { groupId } });
  }

  const created = await prisma.scheduleSlot.create({
    data: {
      scheduleId: schedule.id,
      day: Number(slot.day),
      startMinute: Number(slot.startMinute),
      endMinute: Number(slot.endMinute),
      subject: String(slot.subject ?? "").trim() || "Sin asignatura",
      classroom: slot.classroom?.trim() || null,
      teacher: slot.teacher?.trim() || null,
      color: slot.color?.trim() || null,
      note: slot.note?.trim() || null,
      order: Number(slot.order ?? 0),
    },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const { slotId, groupId, ...data } = body;

  if (!slotId || !groupId) {
    return NextResponse.json({ error: "slotId y groupId requeridos" }, { status: 400 });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, userId: user.id },
  });
  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: slotId },
    include: { schedule: true },
  });
  if (!slot || slot.schedule.groupId !== groupId) {
    return NextResponse.json({ error: "Slot no encontrado" }, { status: 404 });
  }

  const updated = await prisma.scheduleSlot.update({
    where: { id: slotId },
    data: {
      day: data.day !== undefined ? Number(data.day) : slot.day,
      startMinute: data.startMinute !== undefined ? Number(data.startMinute) : slot.startMinute,
      endMinute: data.endMinute !== undefined ? Number(data.endMinute) : slot.endMinute,
      subject: data.subject !== undefined ? (String(data.subject).trim() || "Sin asignatura") : slot.subject,
      classroom: data.classroom !== undefined ? (data.classroom?.trim() || null) : slot.classroom,
      teacher: data.teacher !== undefined ? (data.teacher?.trim() || null) : slot.teacher,
      color: data.color !== undefined ? (data.color?.trim() || null) : slot.color,
      note: data.note !== undefined ? (data.note?.trim() || null) : slot.note,
      order: data.order !== undefined ? Number(data.order) : slot.order,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const slotId = searchParams.get("slotId");
  const groupId = searchParams.get("groupId");

  if (!slotId || !groupId) {
    return NextResponse.json({ error: "slotId y groupId requeridos" }, { status: 400 });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, userId: user.id },
  });
  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: slotId },
    include: { schedule: true },
  });
  if (!slot || slot.schedule.groupId !== groupId) {
    return NextResponse.json({ error: "Slot no encontrado" }, { status: 404 });
  }

  await prisma.scheduleSlot.delete({ where: { id: slotId } });
  return NextResponse.json({ ok: true });
}
