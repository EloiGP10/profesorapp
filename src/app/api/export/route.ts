import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { groupId, format } = await request.json();

  if (!(await verifyGroupOwnership(groupId, user!.id))) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId },
    include: {
      students: {
        include: {
          grades: { include: { assessment: { include: { trimester: true } } } },
          absences: { include: { trimester: true } },
        },
        orderBy: { listNumber: "asc" },
      },
      trimesters: {
        include: { assessments: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  if (format === "itaca-csv") return exportToItacaCsv(group);
  if (format === "itaca-xml") return exportToItacaXml(group);
  return exportToExcel(group);
}

type SerializableGroup = {
  name: string;
  penaltyAbsence: number;
  penaltyLate: number;
  penaltyNegative: number;
  students: Array<{
    listNumber: number;
    name: string;
    surname1: string;
    surname2: string | null;
    nia: string | null;
    grades: Array<{
      score: number | null;
      assessment: {
        name: string;
        percentage: number;
        maxScore: number;
        trimester: { name: string; percentage: number };
      };
    }>;
    absences: Array<{ type: string; trimesterId: string | null }>;
  }>;
  trimesters: Array<{
    id: string;
    name: string;
    percentage: number;
    assessments: Array<{ name: string; percentage: number; maxScore: number }>;
  }>;
};

function exportToExcel(group: SerializableGroup) {
  const headers = ["Nº Lista", "Nombre", "Apellidos"];
  for (const trimester of group.trimesters) {
    headers.push(`${trimester.name} (${trimester.percentage}%)`);
    for (const assessment of trimester.assessments) {
      headers.push(`  ${assessment.name} (${assessment.maxScore})`);
    }
  }
  headers.push("Nota Final");
  for (const trimester of group.trimesters) {
    headers.push(`Faltas ${trimester.name}`);
  }

  const rows = group.students.map((student) => {
    const row: (string | number)[] = [
      student.listNumber,
      student.name,
      student.surname1 + (student.surname2 ? ` ${student.surname2}` : ""),
    ];

    for (const trimester of group.trimesters) {
      const tGrades = student.grades.filter(
        (g) => g.assessment.trimester.name === trimester.name && g.score !== null
      );
      const tAvg =
        tGrades.length > 0
          ? tGrades.reduce((a, g) => a + (g.score ?? 0), 0) / tGrades.length
          : null;
      row.push(tAvg !== null ? Number(tAvg.toFixed(2)) : "");

      for (const assessment of trimester.assessments) {
        const grade = student.grades.find(
          (g) => g.assessment.name === assessment.name
        );
        row.push(
          grade?.score !== null && grade?.score !== undefined ? grade.score : ""
        );
      }
    }

    const finalGrade = calculateFinalGrade(student, group.trimesters, group);
    row.push(finalGrade !== null ? Number(finalGrade.toFixed(2)) : "");
    for (const trimester of group.trimesters) {
      const tAbs = (student.absences ?? []).filter(
        (a) => a.trimesterId === trimester.id
      );
      row.push(tAbs.length);
    }
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  XLSX.utils.book_append_sheet(wb, ws, group.name);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${group.name}.xlsx"`,
    },
  });
}

function escapeCsvField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportToItacaCsv(group: SerializableGroup) {
  const headers = ["NIA", "APELLIDOS", "NOMBRE"];
  for (const trimester of group.trimesters) {
    for (const assessment of trimester.assessments) {
      headers.push(`${trimester.name} - ${assessment.name}`);
    }
  }

  const rows = group.students.map((student) => {
    const row: string[] = [
      escapeCsvField(student.nia || student.listNumber.toString()),
      escapeCsvField(
        student.surname1 + (student.surname2 ? ` ${student.surname2}` : "")
      ),
      escapeCsvField(student.name),
    ];

    for (const trimester of group.trimesters) {
      for (const assessment of trimester.assessments) {
        const grade = student.grades.find(
          (g) => g.assessment.name === assessment.name
        );
        row.push(
          escapeCsvField(
            grade?.score !== null && grade?.score !== undefined
              ? grade.score.toString()
              : ""
          )
        );
      }
    }

    return row;
  });

  const bom = "\uFEFF";
  const csvContent =
    bom +
    [
      headers.map(escapeCsvField).join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="itaca_${group.name}.csv"`,
    },
  });
}

function exportToItacaXml(group: SerializableGroup) {
  const finalGrades = group.students.map((s) =>
    calculateFinalGrade(s, group.trimesters, group)
  );

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<centro>\n";
  xml += `  <nombre>${escapeXml(group.name)}</nombre>\n`;
  xml += "  <alumnos>\n";

  group.students.forEach((student, idx) => {
    xml += "    <alumno>\n";
    xml += `      <nia>${escapeXml(student.nia || student.listNumber.toString())}</nia>\n`;
    xml += `      <apellido1>${escapeXml(student.surname1)}</apellido1>\n`;
    xml += `      <apellido2>${escapeXml(student.surname2 || "")}</apellido2>\n`;
    xml += `      <nombre>${escapeXml(student.name)}</nombre>\n`;

    for (let ti = 0; ti < group.trimesters.length; ti++) {
      const trimester = group.trimesters[ti];
      const tGrades = student.grades.filter(
        (g) => g.assessment.trimester.name === trimester.name && g.score !== null
      );
      const tAvg =
        tGrades.length > 0
          ? tGrades.reduce((a, g) => a + (g.score ?? 0), 0) / tGrades.length
          : null;

      xml += `      <trimestre numero="${ti + 1}">\n`;
      xml += `        <nombre>${escapeXml(trimester.name)}</nombre>\n`;
      xml += `        <media>${tAvg !== null ? tAvg.toFixed(2) : ""}</media>\n`;
      for (const assessment of trimester.assessments) {
        const grade = student.grades.find(
          (g) => g.assessment.name === assessment.name
        );
        const score =
          grade?.score !== null && grade?.score !== undefined
            ? grade.score.toFixed(2)
            : "";
        xml += `        <evaluacion nombre="${escapeXml(assessment.name)}" nota="${score}" />\n`;
      }
      xml += "      </trimestre>\n";
    }

    const finalG = finalGrades[idx];
    xml += `      <nota_final>${finalG !== null ? finalG.toFixed(2) : ""}</nota_final>\n`;
    xml += "    </alumno>\n";
  });

  xml += "  </alumnos>\n";
  xml += "</centro>\n";

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="itaca_${group.name}.xml"`,
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function calculateFinalGrade(
  student: {
    grades: Array<{
      score: number | null;
      assessment: {
        percentage: number;
        maxScore: number;
        trimester: { name: string; percentage: number };
      };
    }>;
    absences?: Array<{ type: string; trimesterId: string | null }>;
  },
  trimesters: Array<{ id: string; name: string; percentage: number }>,
  group?: { penaltyAbsence: number; penaltyLate: number; penaltyNegative: number }
): number | null {
  let sum = 0;
  let weightSum = 0;

  for (const trimester of trimesters) {
    const tGrades = student.grades.filter(
      (g) => g.assessment.trimester.name === trimester.name
    );
    const graded = tGrades.filter((g) => g.score !== null);
    if (graded.length === 0) continue;
    const avg = graded.reduce((acc, g) => acc + (g.score ?? 0), 0) / graded.length;

    const tAbs = (student.absences ?? []).filter(
      (a) => !a.trimesterId || a.trimesterId === trimester.id
    );
    const absCount = tAbs.filter((a) => a.type === "ABSENT" || a.type === "A").length;
    const lateCount = tAbs.filter((a) => a.type === "LATE" || a.type === "R").length;
    const negCount = tAbs.filter((a) => a.type === "NEGATIVE" || a.type === "N").length;
    const penalty =
      (absCount * (group?.penaltyAbsence ?? 0)) +
      (lateCount * (group?.penaltyLate ?? 0)) +
      (negCount * (group?.penaltyNegative ?? 0));
    const penalizedAvg = penalty > 0 ? Math.max(0, avg - penalty) : avg;

    sum += penalizedAvg * (trimester.percentage / 100);
    weightSum += trimester.percentage / 100;
  }

  if (weightSum === 0) return null;
  return sum / weightSum;
}