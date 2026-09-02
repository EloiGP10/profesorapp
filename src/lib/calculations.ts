/**
 * FASE 10 — Servicio de cálculo de medias
 *
 * Este módulo proporciona funciones para calcular medias
 * de calificaciones por alumno, materia y evaluación.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AverageResult {
  studentId: string;
  contentId: string | null;
  evaluationId: string;
  average: number | null;
  qualitativeValue: string | null;
  gradeCount: number;
  weights: number;
}

/**
 * Calcula la media de un alumno en una materia/evaluación
 */
export async function calculateStudentAverage(
  studentId: string,
  contentId: string | null,
  evaluationId: string
): Promise<AverageResult> {
  // Obtener todas las notas del alumno para esta materia/evaluación
  const grades = await prisma.grade.findMany({
    where: {
      studentId,
      evaluationId,
      contentId,
      numericValue: { not: null },
    },
    include: {
      activity: {
        select: {
          weight: true,
          isExtra: true,
        },
      },
    },
  });

  if (grades.length === 0) {
    return {
      studentId,
      contentId,
      evaluationId,
      average: null,
      qualitativeValue: null,
      gradeCount: 0,
      weights: 0,
    };
  }

  // Calcular media ponderada (solo actividades normales, no extras)
  let weightedSum = 0;
  let totalWeight = 0;

  for (const grade of grades) {
    if (grade.activity?.isExtra) continue; // Saltar actividades extra
    if (grade.numericValue === null) continue;

    const weight = grade.activity?.weight || 1;
    weightedSum += grade.numericValue * weight;
    totalWeight += weight;
  }

  const average = totalWeight > 0 ? weightedSum / totalWeight : null;

  // Calcular valor cualitativo
  const qualitativeValue = average !== null ? getQualitativeValue(average) : null;

  return {
    studentId,
    contentId,
    evaluationId,
    average,
    qualitativeValue,
    gradeCount: grades.length,
    weights: totalWeight,
  };
}

/**
 * Calcula la media de un alumno en todas las materias de una evaluación
 */
export async function calculateStudentEvaluationAverage(
  studentId: string,
  evaluationId: string
): Promise<AverageResult[]> {
  // Obtener todas las materias con notas en esta evaluación
  const contents = await prisma.activity.findMany({
    where: {
      evaluationId,
      contentId: { not: null },
    },
    select: {
      contentId: true,
    },
    distinct: ["contentId"],
  });

  const results: AverageResult[] = [];

  for (const content of contents) {
    if (!content.contentId) continue;

    const result = await calculateStudentAverage(
      studentId,
      content.contentId,
      evaluationId
    );
    results.push(result);
  }

  return results;
}

/**
 * Calcula la media general de un alumno en todas las materias
 */
export async function calculateStudentOverallAverage(
  studentId: string,
  academicYearId: string
): Promise<AverageResult[]> {
  // Obtener todas las evaluaciones del año académico
  const evaluations = await prisma.evaluation.findMany({
    where: { academicYearId },
  });

  const results: AverageResult[] = [];

  for (const evaluation of evaluations) {
    const evalResults = await calculateStudentEvaluationAverage(
      studentId,
      evaluation.id
    );
    results.push(...evalResults);
  }

  return results;
}

/**
 * Calcula la media de todos los alumnos en una materia
 */
export async function calculateContentAverage(
  contentId: string,
  evaluationId: string
): Promise<{
  average: number | null;
  studentCount: number;
  qualitativeValue: string | null;
}> {
  const grades = await prisma.grade.findMany({
    where: {
      contentId,
      evaluationId,
      numericValue: { not: null },
    },
  });

  if (grades.length === 0) {
    return {
      average: null,
      studentCount: 0,
      qualitativeValue: null,
    };
  }

  const sum = grades.reduce((acc, grade) => acc + (grade.numericValue || 0), 0);
  const average = sum / grades.length;
  const qualitativeValue = getQualitativeValue(average);

  return {
    average,
    studentCount: grades.length,
    qualitativeValue,
  };
}

/**
 * Convierte un valor numérico a qualitativo
 */
function getQualitativeValue(score: number): string | null {
  if (score >= 9) return "SB";
  if (score >= 7) return "NT";
  if (score >= 6) return "BI";
  if (score >= 5) return "SU";
  if (score >= 0) return "IN";
  return null;
}

export default {
  calculateStudentAverage,
  calculateStudentEvaluationAverage,
  calculateStudentOverallAverage,
  calculateContentAverage,
};
