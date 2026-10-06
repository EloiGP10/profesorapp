// Cálculos oficiales de notas por alumno. Misma fórmula que la tabla de
// calificaciones: media aritmética de evaluaciones calificadas (excluye
// extra, excluidas por excepción e incluye personales), menos penalización
// por faltas del trimestre, y media final ponderada por % de trimestre.

export interface StatStudent {
  id: string;
  grades: { assessmentId: string; score: number | null }[];
  absences: { type: string; trimesterId: string | null }[];
  exceptions: { assessmentId: string; isExcluded: boolean }[];
}

export interface StatAssessment {
  id: string;
  percentage: number;
  maxScore: number;
  isExtra: boolean;
  /** Opcional: computa en la media solo si el alumno tiene nota; si no, no penaliza. */
  isOptional?: boolean;
  studentId?: string | null;
}

export interface StatTrimester {
  id: string;
  percentage: number;
  assessments: StatAssessment[];
}

export interface StatPenalties {
  absence: number;
  late: number;
  negative: number;
}

export function getStudentPenalty(
  student: StatStudent,
  trimesterId: string,
  penalties: StatPenalties
): number {
  const relevant = student.absences.filter(
    (a) => !a.trimesterId || a.trimesterId === trimesterId
  );
  const absCount = relevant.filter((a) => a.type === "ABSENT" || a.type === "A").length;
  const lateCount = relevant.filter((a) => a.type === "LATE" || a.type === "R").length;
  const negCount = relevant.filter((a) => a.type === "NEGATIVE" || a.type === "N").length;
  return absCount * penalties.absence + lateCount * penalties.late + negCount * penalties.negative;
}

/** Evaluaciones computables del alumno en un trimestre.
 *
 * - Trabajo voluntario (`isExtra`): nunca computa, ni sube ni baja la media.
 * - Opcional (`isOptional`): computa si el alumno tiene nota; si no la tiene,
 *   simplemente se omite, por lo que no penaliza a quien no lo entrega.
 * - Excluidas por excepción: nunca computan.
 */
export function usefulAssessments(student: StatStudent, trimester: StatTrimester): StatAssessment[] {
  const candidates = [
    ...trimester.assessments.filter((a) => !a.studentId),
    ...trimester.assessments.filter((a) => a.studentId === student.id),
  ];
  return candidates.filter(
    (a) =>
      !a.isExtra &&
      !student.exceptions.find((e) => e.assessmentId === a.id && e.isExcluded)
  );
}

export function trimesterRawAverage(
  student: StatStudent,
  trimester: StatTrimester
): number | null {
  const useful = usefulAssessments(student, trimester);
  const graded = useful.filter(
    (a) => student.grades.find((g) => g.assessmentId === a.id)?.score != null
  );
  if (graded.length === 0) return null;
  return (
    graded.reduce((acc, a) => {
      const g = student.grades.find((x) => x.assessmentId === a.id);
      return acc + (g?.score ?? 0);
    }, 0) / graded.length
  );
}

/** Media del trimestre con penalización aplicada (igual que la tabla) */
export function trimesterAverage(
  student: StatStudent,
  trimester: StatTrimester,
  penalties: StatPenalties
): number | null {
  const raw = trimesterRawAverage(student, trimester);
  if (raw === null) return null;
  const penalty = getStudentPenalty(student, trimester.id, penalties);
  return penalty > 0 ? Math.max(0, raw - penalty) : raw;
}

/** Nota final ponderada por % de trimestre (igual que la tabla) */
export function studentFinalAverage(
  student: StatStudent,
  trimesters: StatTrimester[],
  penalties: StatPenalties
): number | null {
  let sum = 0;
  let weightSum = 0;
  for (const t of trimesters) {
    const avg = trimesterAverage(student, t, penalties);
    if (avg === null) continue;
    sum += avg * (t.percentage / 100);
    weightSum += t.percentage / 100;
  }
  if (weightSum <= 0) return null;
  return sum / weightSum;
}

/** Nota máxima media del trimestre (promedio de maxScore, sin penalización) */
export function trimesterMaxAverage(
  student: StatStudent,
  trimester: StatTrimester
): number | null {
  const useful = usefulAssessments(student, trimester);
  if (useful.length === 0) return null;
  return useful.reduce((acc, a) => acc + (a.maxScore || 0), 0) / useful.length;
}

export function countAbsences(
  student: StatStudent,
  trimesterId?: string
): { absent: number; late: number; negative: number } {
  const relevant = trimesterId
    ? student.absences.filter((a) => !a.trimesterId || a.trimesterId === trimesterId)
    : student.absences;
  return {
    absent: relevant.filter((a) => a.type === "ABSENT" || a.type === "A").length,
    late: relevant.filter((a) => a.type === "LATE" || a.type === "R").length,
    negative: relevant.filter((a) => a.type === "NEGATIVE" || a.type === "N").length,
  };
}
