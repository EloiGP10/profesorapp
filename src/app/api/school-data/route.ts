import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const schoolData = await prisma.schoolData.findFirst({
    include: {
      academicYears: {
        include: { academicYear: { select: { id: true, name: true } } },
      },
    },
  });

  if (!schoolData) {
    return NextResponse.json(null);
  }

  return NextResponse.json(schoolData);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { name, code, address, city, province, postalCode, phone, email, website, director, directorDni, communityCode, educationType } = body;

    if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 });

    const existing = await prisma.schoolData.findFirst();
    if (existing) {
      const updated = await prisma.schoolData.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          code: code !== undefined ? code : existing.code,
          address: address !== undefined ? address : existing.address,
          city: city !== undefined ? city : existing.city,
          province: province !== undefined ? province : existing.province,
          postalCode: postalCode !== undefined ? postalCode : existing.postalCode,
          phone: phone !== undefined ? phone : existing.phone,
          email: email !== undefined ? email : existing.email,
          website: website !== undefined ? website : existing.website,
          director: director !== undefined ? director : existing.director,
          directorDni: directorDni !== undefined ? directorDni : existing.directorDni,
          communityCode: communityCode !== undefined ? communityCode : existing.communityCode,
          educationType: educationType || existing.educationType,
        },
      });
      return NextResponse.json(updated);
    }

    const schoolData = await prisma.schoolData.create({
      data: {
        name,
        code,
        address,
        city,
        province,
        postalCode,
        phone,
        email,
        website,
        director,
        directorDni,
        communityCode,
        educationType,
      },
    });

    return NextResponse.json(schoolData, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al guardar datos del centro" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, name, code, address, city, province, postalCode, phone, email, website, director, directorDni, communityCode, educationType } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.schoolData.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Datos del centro no encontrados" }, { status: 404 });

    const updated = await prisma.schoolData.update({
      where: { id },
      data: {
        name: name || existing.name,
        code: code !== undefined ? code : existing.code,
        address: address !== undefined ? address : existing.address,
        city: city !== undefined ? city : existing.city,
        province: province !== undefined ? province : existing.province,
        postalCode: postalCode !== undefined ? postalCode : existing.postalCode,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        website: website !== undefined ? website : existing.website,
        director: director !== undefined ? director : existing.director,
        directorDni: directorDni !== undefined ? directorDni : existing.directorDni,
        communityCode: communityCode !== undefined ? communityCode : existing.communityCode,
        educationType: educationType || existing.educationType,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar datos del centro" }, { status: 500 });
  }
}
