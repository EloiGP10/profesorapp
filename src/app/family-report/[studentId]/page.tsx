import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/print-button";
import {
  countAbsences,
  getStudentPenalty,
  trimesterAverage,
  type StatPenalties,
  type StatStudent,
  type StatTrimester,
} from "@/lib/student-stats";

export const dynamic = "force-dynamic";

const CATEGORY = "FAMILY_REPORT";

function fullName(s: {
  name: string;
  surname1: string;
  surname2: string | null;
}) {
  return `${s.name} ${s.surname1}${s.surname2 ? ` ${s.surname2}` : ""}`;
}

function fmt(n: number | null, digits = 2) {
  return n === null ? "—" : n.toFixed(digits);
}

function parseAnnotations(content: string | null): Record<string, string> {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default async function FamilyReportPage({
  params,
}: {
  params: { studentId: string };
}) {
  // La ruta recibe el shareToken, no el studentId. Se busca por token para no
  // filtrar por id: así no se puede recorrer el listado de alumnos probando ids.
  const student = await prisma.student.findFirst({
    where: { shareToken: params.studentId, shareEnabled: true },
    include: {
      group: {
        include: {
          trimesters: {
            orderBy: { order: "asc" },
            include: {
              assessments: { orderBy: { order: "asc" } },
            },
          },
        },
      },
      grades: { select: { assessmentId: true, score: true } },
      absences: { select: { type: true, trimesterId: true } },
      exceptions: { select: { assessmentId: true, isExcluded: true } },
      notes: { where: { category: CATEGORY }, select: { content: true }, take: 1 },
    },
  });

  if (!student) notFound();

  const annotations = parseAnnotations(student.notes[0]?.content ?? null);

  const statStudent: StatStudent = {
    id: student.id,
    grades: student.grades,
    absences: student.absences,
    exceptions: student.exceptions,
  };

  const penalties: StatPenalties = {
    absence: student.group.penaltyAbsence,
    late: student.group.penaltyLate,
    negative: student.group.penaltyNegative,
  };

  const statTrimesters: StatTrimester[] = student.group.trimesters.map((t) => ({
    id: t.id,
    percentage: t.percentage,
    assessments: t.assessments.map((a) => ({
      id: a.id,
      percentage: a.percentage,
      maxScore: a.maxScore,
      isExtra: a.isExtra,
      isOptional: a.isOptional,
      studentId: a.studentId,
    })),
  }));

  const nameById = new Map(
    student.group.trimesters.flatMap((t) =>
      t.assessments.map((a) => [a.id, a] as const)
    )
  );

  const rows = student.group.trimesters.map((t, i) => {
    const st = statTrimesters[i];
    const items = st.assessments
      .filter((a) => !a.studentId || a.studentId === student.id)
      .filter(
        (a) =>
          !student.exceptions.find((e) => e.assessmentId === a.id && e.isExcluded)
      )
      .map((a) => {
        const full = nameById.get(a.id);
        const grade = student.grades.find((g) => g.assessmentId === a.id);
        return {
          id: a.id,
          name: full?.name ?? "",
          type: full?.type ?? "",
          percentage: a.percentage,
          maxScore: a.maxScore,
          isPersonal: !!a.studentId,
          isExtra: a.isExtra,
          isOptional: a.isOptional,
          score: grade?.score ?? null,
        };
      });

    return {
      id: t.id,
      name: t.name,
      percentage: t.percentage,
      items,
      average: trimesterAverage(statStudent, st, penalties),
      absences: countAbsences(statStudent, t.id),
      penalty: getStudentPenalty(statStudent, t.id, penalties),
    };
  });

  let weighted = 0;
  let totalWeight = 0;
  rows.forEach((r) => {
    if (r.average === null) return;
    weighted += r.average * (r.percentage || 0);
    totalWeight += r.percentage || 0;
  });
  const finalAverage = totalWeight > 0 ? weighted / totalWeight : null;

  const chartPoints = rows.filter((r) => r.average !== null);
  const annotationKeys = Object.keys(annotations).filter(
    (k) => k !== "firma" && annotations[k]?.trim()
  );

  return (
    <div className="min-h-screen bg-background p-4 print:p-0">
      <div className="mx-auto max-w-4xl print:max-w-none">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Enlace personal e intransferible. Los datos se actualizan automáticamente.
          </p>
          <PrintButton />
        </div>

        <header className="mb-6 border-b-2 border-foreground pb-3">
          <h1 className="text-2xl font-bold">Boletín de calificaciones</h1>
          <p className="mt-1 text-sm">
            {fullName(student)} · Nº {student.listNumber}
            {student.nia ? ` · NIA ${student.nia}` : ""} · {student.group.name}
          </p>
        </header>

        {annotationKeys.length > 0 && (
          <section className="mb-6 rounded-lg border p-4 print:mb-4 print:border-foreground">
            <h2 className="mb-2 text-sm font-semibold">Observaciones del profesor</h2>
            <div className="space-y-2">
              {annotationKeys.map((key) => (
                <div key={key}>
                  <p className="text-xs font-medium text-muted-foreground">{key}</p>
                  <p className="whitespace-pre-wrap text-sm">{annotations[key]}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {rows.map((r) => (
          <section key={r.id} className="mb-6 print:mb-4 print:break-inside-avoid">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                {r.name} ({r.percentage}%)
              </h2>
              <p className="text-sm">
                Media: <span className="font-semibold">{fmt(r.average)}</span>
              </p>
            </div>

            {r.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin evaluaciones.</p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted print:bg-transparent">
                    <th className="border border-border px-2 py-1 text-left">Evaluación</th>
                    <th className="border border-border px-2 py-1 text-left">Tipo</th>
                    <th className="border border-border px-2 py-1 text-center">Peso</th>
                    <th className="border border-border px-2 py-1 text-center">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((it) => (
                    <tr key={it.id}>
                      <td className="border border-border px-2 py-1">
                        {it.name}
                        {it.isPersonal ? " (personal)" : ""}
                        {it.isExtra ? " (voluntario, no cuenta)" : ""}
                        {!it.isExtra && it.isOptional ? " (opcional)" : ""}
                      </td>
                      <td className="border border-border px-2 py-1">{it.type}</td>
                      <td className="border border-border px-2 py-1 text-center">
                        {it.percentage}%
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {it.score === null ? "—" : `${it.score} / ${it.maxScore}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="mt-1 text-xs text-muted-foreground">
              Faltas: {r.absences.absent} · Retrasos: {r.absences.late} · Negativos:{" "}
              {r.absences.negative}
              {r.penalty > 0 ? ` · Penalización: -${fmt(r.penalty)}` : ""}
            </p>
          </section>
        ))}

        <section className="mb-6 rounded-lg border p-4 print:mb-4">
          <p className="text-sm font-medium">Media final</p>
          <p className="mt-1 text-3xl font-bold">{fmt(finalAverage)}</p>
        </section>

        {chartPoints.length > 0 && (
          <section className="no-print mb-6 rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">Evolución</h2>
            <div className="flex h-40 items-end gap-6">
              {chartPoints.map((r) => {
                const pct = Math.max(
                  0,
                  Math.min(100, ((r.average ?? 0) / 10) * 100)
                );
                return (
                  <div key={r.id} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-medium">{fmt(r.average)}</span>
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{ height: `${pct}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {r.name.replace("Trimestre", "T")}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {annotations.firma?.trim() && (
          <footer className="border-t pt-3 text-sm print:border-foreground">
            <p className="whitespace-pre-wrap">{annotations.firma}</p>
          </footer>
        )}

        <PrintStyles />
      </div>
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body { background: #fff !important; }
        @page { size: A4; margin: 14mm; }
      }
    `}</style>
  );
}