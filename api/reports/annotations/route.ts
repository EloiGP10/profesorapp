import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const ANNOTATIONS_DIR = path.join(process.cwd(), "public", "data", "annotations");

if (!fs.existsSync(ANNOTATIONS_DIR)) {
  fs.mkdirSync(ANNOTATIONS_DIR, { recursive: true });
}

// GET /api/reports/annotations?studentId=xxx - Obtener anotaciones
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ annotations: {} }, { status: 200 });
  }

  const filePath = path.join(ANNOTATIONS_DIR, `${studentId}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return NextResponse.json({ annotations: data }, { status: 200 });
  }

  return NextResponse.json({ annotations: {} }, { status: 200 });
}

// POST /api/reports/annotations - Guardar anotaciones
export function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, annotations } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 });
    }

    const filePath = path.join(ANNOTATIONS_DIR, `${studentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(annotations, null, 2));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save annotations" }, { status: 500 });
  }
}