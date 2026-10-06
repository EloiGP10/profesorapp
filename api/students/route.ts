import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase_local_supabase_select } from "@/supabase-local_supabase_select";
import { supabase_local_supabase_get_project } from "@/supabase-local_supabase_get_project";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 });
    }

    // Usar el supabase local
    const result = await supabase_local_supabase_select({
      table: "students",
      filters: {
        id: { eq: studentId },
      },
      limit: 1,
    });

    const students = result.data || [];
    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const student = students[0];
    return NextResponse.json({
      id: student.id,
      name: student.name,
      surname1: student.surname1,
      surname2: student.surname2,
      listNumber: student.list_number || student.listNumber || 0,
      nia: student.nia,
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
  }
}