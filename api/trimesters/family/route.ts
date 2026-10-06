import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase_local_supabase_select } from "@/supabase-local_supabase_select";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const groupId = searchParams.get("groupId");

    if (!studentId || !groupId) {
      return NextResponse.json({ error: "studentId and groupId required" }, { status: 400 });
    }

    // Obtener trimestres del grupo
    const trimRes = await supabase_local_supabase_select({
      table: "trimesters",
      filters: { groupId: { eq: groupId } },
      limit: 100,
      order: "order",
    });

    const trimesters = trimRes.data || [];

    // Para cada trimestre, obtener evaluaciones y nota del alumno
    const assessmentsPromises = trimesters.map(async (t) => {
      // Obtener evaluaciones del trimestre (globales + personales)
      const evalRes = await supabase_local_supabase_select({
        table: "assessments",
        filters: {
          trimesterId: { eq: t.id },
        },
        limit: 100,
      });

      const allAssessments = evalRes.data || [];

      // Filtrar evaluaciones relevantes (sin extra, sin estudiante propio, o del alumno)
      const relevant = allAssessments.filter((a: any) => {
        // Incluir evaluaciones globales
        if (!a.studentId) return true;
        // Incluir evaluaciones personales del alumno
        if (a.studentId === studentId) return true;
        return false;
      });

      // Obtener notas del alumno para estas evaluaciones
      const gradesRes = await supabase_local_supabase_select({
        table: "grades",
        filters: {
          studentId: { eq: studentId },
          assessmentId: { in: relevant.map((a: any) => a.id) },
        },
        limit: 100,
      });

      const gradesMap = (gradesRes.data || []).reduce((acc: any, g: any) => {
        acc[g.assessmentId] = g.score;
        return acc;
      }, {});

      // Construir lista de evaluaciones con notas
      const items = relevant.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        percentage: a.percentage,
        maxScore: a.maxScore || 10,
        score: gradesMap[a.id] ?? null,
        isExtra: a.isExtra,
        isPersonal: !!a.studentId,
        excluded: false,
      }));

      // Calcular media simple (sin penalizaciones)
      const graded = items.filter((i) => i.score !== null);
      const avg = graded.length > 0
        ? graded.reduce((sum, i) => sum + i.score, 0) / graded.length
        : null;

      return {
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        assessments: items,
        average: avg,
      };
    });

    const results = await Promise.all(assessmentsPromises);

    return NextResponse.json({ trimesters: results });
  } catch (error) {
    console.error("Error fetching family trimesters:", error);
    return NextResponse.json({ error: "Failed to fetch family data" }, { status: 500 });
  }
}