"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { colorToCss, parseColorString } from "@/components/color-picker";
import {
  AlertCircle, CalendarX2, Check, Copy, Info, Loader2, Minus, Pencil, Plus,
  ScrollText, Settings2, Sparkles, Star, Trash2, UserRoundX,
} from "lucide-react";

export interface GradeTableStudent {
  id: string;
  listNumber: number;
  name: string;
  surname1: string;
  surname2: string | null;
  grades: { assessmentId: string; score: number | null }[];
  absences: { id: string; date: string; type: string; notes: string | null; trimesterId: string | null }[];
  exceptions: { assessmentId: string; isExcluded: boolean }[];
  customAssessments?: Array<{
    id: string;
    name: string;
    type: string;
    percentage: number;
    maxScore: number;
    trimesterId: string;
  }>;
}

export interface GradeTableAssessment {
  id: string;
  name: string;
  type: string;
  percentage: number;
  maxScore: number;
  isExtra: boolean;
  studentId?: string | null;
  columnColor?: string | null;
}

export interface GradeTableTrimester {
  id: string;
  name: string;
  percentage: number;
  order: number;
  assessments: GradeTableAssessment[];
}

interface GradeTableProps {
  groupId: string;
  trimesters: GradeTableTrimester[];
  students: GradeTableStudent[];
  currentTrimesterId: string;
  penaltyAbsence?: number;
  penaltyLate?: number;
  penaltyNegative?: number;
  onAddAssessment: (trimesterId: string) => void;
  onEditAssessment: (assessment: GradeTableAssessment) => void;
  onOpenRubric: (assessment: GradeTableAssessment, hasRubric: boolean) => void;
  onOpenRubricEval?: (assessment: GradeTableAssessment, studentId?: string) => void;
  onOpenNotes: (studentId: string) => void;
  onEditStudent: (studentId: string) => void;
  onOpenException: (studentId: string, studentName: string) => void;
  onOpenAbsence: (
    studentId: string,
    studentName: string,
    absences: { id: string; date: string; type: string; notes: string | null; trimesterId: string | null }[]
  ) => void;
  /** Callback para recargar datos del grupo tras guardar cambios */
  onDataChange?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  studentId: string;
  studentName: string;
  absences: { id: string; date: string; type: string; notes: string | null; trimesterId: string | null }[];
}

function getScoreColor(score: number): string {
  if (score >= 9) return "text-green-600 dark:text-green-400";
  if (score >= 5) return "text-green-600 dark:text-green-400";
  if (score >= 4) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function GradeTable({
  groupId,
  trimesters,
  students,
  currentTrimesterId,
  penaltyAbsence = 0,
  penaltyLate = 0,
  penaltyNegative = 0,
  onAddAssessment,
  onEditAssessment,
  onOpenRubric,
  onOpenRubricEval,
  onOpenNotes,
  onEditStudent,
  onOpenException,
  onOpenAbsence,
  onDataChange,
}: GradeTableProps) {
  const [editingCell, setEditingCell] = useState<{ studentId: string; assessmentId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingCell, setSavingCell] = useState<{ studentId: string; assessmentId: string } | null>(null);
  const [deletingAssessmentId, setDeletingAssessmentId] = useState<string | null>(null);
  const [duplicatingAssessmentId, setDuplicatingAssessmentId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);
  const [compactMode, setCompactMode] = useState(false);

  // Cerrar menú contextual al hacer clic fuera o con Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    const onClick = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const openContextMenu = (e: React.MouseEvent, student: GradeTableStudent) => {
    e.preventDefault();
    setEditingCell(null);
    const name = `${student.surname1}${student.surname2 ? ` ${student.surname2}` : ""}, ${student.name}`;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      studentId: student.id,
      studentName: name,
      absences: student.absences,
    });
  };

  const trimester = trimesters.find((t) => t.id === currentTrimesterId);
  // Evaluaciones globales del trimestre activo (sin studentId)
  const currentAssessments = (trimester?.assessments ?? []).filter((a) => !a.studentId);
  const nonExtra = currentAssessments.filter((a) => !a.isExtra);

  // Cálculo de penalizaciones por alumno — solo cuenta las del trimestre activo
  const getStudentPenalty = (student: GradeTableStudent, forTrimesterId?: string) => {
    const tid = forTrimesterId ?? currentTrimesterId;
    const relevant = student.absences.filter(
      (a) => !a.trimesterId || a.trimesterId === tid
    );
    const absCount = relevant.filter((a) => a.type === "ABSENT" || a.type === "A").length;
    const lateCount = relevant.filter((a) => a.type === "LATE" || a.type === "R").length;
    const negCount = relevant.filter((a) => a.type === "NEGATIVE" || a.type === "N").length;
    return (absCount * penaltyAbsence) + (lateCount * penaltyLate) + (negCount * penaltyNegative);
  };

  // Nota final ponderada del alumno (con penalizaciones por trimestre)
  const studentFinalAverage = (student: GradeTableStudent): number | null => {
    let sum = 0;
    let weightSum = 0;
    for (const t of trimesters) {
      // Evaluaciones globales + personalizadas del alumno en este trimestre
      const tas = [
        ...t.assessments.filter((a) => !a.isExtra && !a.studentId),
        ...t.assessments.filter((a) => !a.isExtra && a.studentId === student.id),
      ];
      // Excluir tareas con excepción
      const useful = tas.filter(
        (a) => !student.exceptions.find((e) => e.assessmentId === a.id && e.isExcluded)
      );
      const graded = useful.filter(
        (a) => student.grades.find((g) => g.assessmentId === a.id)?.score != null
      );
      if (graded.length === 0) continue;
      const avg =
        graded.reduce((acc, a) => {
          const g = student.grades.find((x) => x.assessmentId === a.id);
          return acc + (g?.score ?? 0);
        }, 0) / graded.length;
      // Aplicar penalización específica de este trimestre
      const penalty = getStudentPenalty(student, t.id);
      const penalizedAvg = penalty > 0 ? Math.max(0, avg - penalty) : avg;
      sum += penalizedAvg * (t.percentage / 100);
      weightSum += t.percentage / 100;
    }

    if (weightSum <= 0) return null;
    return sum / weightSum;
  };

  // Nota máxima obtenible por trimestre (promedio de maxScore de las tareas evaluables, sin penalización)
  const getTrimesterMax = (student: GradeTableStudent, trimesterId: string): number | null => {
    const t = trimesters.find((x) => x.id === trimesterId);
    if (!t) return null;
    const tas = [
      ...t.assessments.filter((a) => !a.isExtra && !a.studentId),
      ...t.assessments.filter((a) => !a.isExtra && a.studentId === student.id),
    ];
    const useful = tas.filter(
      (a) => !student.exceptions.find((e) => e.assessmentId === a.id && e.isExcluded)
    );
    if (useful.length === 0) return null;
    return useful.reduce((acc, a) => acc + (a.maxScore || 0), 0) / useful.length;
  };

  // Agrupación por caso de excepción
  const exceptionSignature = (s: GradeTableStudent) =>
    s.exceptions
      .filter((e) => e.isExcluded)
      .map((e) => e.assessmentId)
      .slice()
      .sort()
      .join("|");

  const assessmentNameById = (id: string) =>
    trimesters.flatMap((t) => t.assessments).find((a) => a.id === id)?.name ?? "Evaluación";

  const regularStudents: GradeTableStudent[] = [];
  const exceptionGroups = new Map<string, GradeTableStudent[]>();
  for (const s of students) {
    const sig = exceptionSignature(s);
    if (sig) {
      if (!exceptionGroups.has(sig)) exceptionGroups.set(sig, []);
      exceptionGroups.get(sig)!.push(s);
    } else {
      regularStudents.push(s);
    }
  }

  const orderedRows: Array<
    | { type: "student"; student: GradeTableStudent; isExceptional?: boolean }
    | { type: "group"; sig: string; members: GradeTableStudent[]; excludedNames: string[] }
  > = [
    ...regularStudents.map((s) => ({ type: "student" as const, student: s })),
    ...Array.from(exceptionGroups.entries())
      .sort((a, b) => a[1][0].listNumber - b[1][0].listNumber)
      .flatMap(([sig, members]) => [
        {
          type: "group" as const,
          sig,
          members,
          excludedNames: sig.split("|").map(assessmentNameById),
        },
        ...members.map((s) => ({
          type: "student" as const,
          student: s,
          isExceptional: true,
        })),
      ]),
  ];

  // Índice de stripe (alternancia visual) por alumno
  const studentStripeIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const row of orderedRows) {
      if (row.type === "student") {
        map.set(row.student.id, idx);
        idx++;
      }
    }
    return map;
  }, [orderedRows]);

  // Alternancia visual: filas pares = gris claro, impares = blanco
  const stripeClass = (studentId: string) =>
    (studentStripeIndex.get(studentId) ?? 0) % 2 === 0 ? "bg-zinc-300 dark:bg-zinc-800" : "bg-white dark:bg-zinc-950";

  const saveGrade = async (studentId: string, assessment: GradeTableAssessment, rawValue: string) => {
    if (rawValue.trim() === "") {
      setEditingCell(null);
      return;
    }
    const value = Number(rawValue.replace(",", "."));
    if (isNaN(value)) {
      toast.error("Introduce un número válido");
      return;
    }
    if (value < 0) {
      toast.error("La nota no puede ser negativa");
      return;
    }
    setSavingCell({ studentId, assessmentId: assessment.id });
    try {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, assessmentId: assessment.id, score: value }),
      });
      if (res.ok) {
        toast.success("Nota guardada");
        onDataChange?.();
      } else {
        toast.error("Error al guardar la nota");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingCell(null);
      setEditingCell(null);
    }
  };

  const handleDuplicateAssessment = async (assessmentId: string) => {
    setDuplicatingAssessmentId(assessmentId);
    try {
      const res = await fetch("/api/assessments/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      if (res.ok) {
        toast.success("Evaluación duplicada correctamente");
        onDataChange?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al duplicar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDuplicatingAssessmentId(null);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!confirm("¿Eliminar esta evaluación? También se eliminarán sus calificaciones.")) return;
    setDeletingAssessmentId(assessmentId);
    try {
      const res = await fetch("/api/assessments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assessmentId }),
      });
      if (res.ok) {
        toast.success("Evaluación eliminada");
        onDataChange?.();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeletingAssessmentId(null);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`¿Eliminar a ${studentName} del grupo?`)) return;
    try {
      const res = await fetch("/api/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId }),
      });
      if (res.ok) {
        toast.success("Alumno eliminado");
        onDataChange?.();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  if (!trimester) return null;

  return (
    <div className="space-y-4">
      {/* Vista móvil: tarjetas */}
      <div className="md:hidden space-y-3">
        {orderedRows.map((row) => {
          if (row.type === "group") {
            return (
              <div
                key={row.sig}
                className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-300"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Caso Adaptación Curricular ({row.members.length} {row.members.length === 1 ? "alumno" : "alumnos"}) · Sin: {row.excludedNames.join(", ")}
                  </span>
                </div>
              </div>
            );
          }
          const student = row.student;
          const trimAbsences = student.absences.filter(
            (a) => a.trimesterId === currentTrimesterId
          );
          const absences = trimAbsences.length;
          const penalty = getStudentPenalty(student);

          const studentAssessments = [
            ...currentAssessments,
            ...(trimester.assessments || []).filter((a) => a.studentId === student.id),
          ];

          const mGraded = studentAssessments
            .filter((a) => !a.isExtra && !student.exceptions.some((e) => e.assessmentId === a.id && e.isExcluded))
            .filter((a) => student.grades.find((g) => g.assessmentId === a.id)?.score != null);

          const rawAvg =
            mGraded.length > 0
              ? mGraded.reduce((acc, a) => {
                  const g = student.grades.find((x) => x.assessmentId === a.id);
                  return acc + (g?.score ?? 0);
                }, 0) / mGraded.length
              : null;

          const mAvg = rawAvg !== null ? (penalty > 0 ? Math.max(0, rawAvg - penalty) : rawAvg) : null;
          const mFinal = studentFinalAverage(student);
          const mMaxObtenible = getTrimesterMax(student, currentTrimesterId);

          return (
            <div key={student.id} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between mb-2">
                  <button
                    className="text-left"
                    onClick={() => onOpenNotes(student.id)}
                  >
                    <p className="font-medium text-base">{student.name} {student.surname1}</p>
                    <p className="text-sm text-muted-foreground">#{student.listNumber}</p>
                  </button>
                <div className="flex items-center gap-1">
                  {absences > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5" title={penalty > 0 ? `Descuento: -${penalty.toFixed(2)} pts` : undefined}>
                      <CalendarX2 className="h-3.5 w-3.5 text-destructive" /> {absences}
                      {penalty > 0 && <span className="text-[10px] text-destructive">(-{penalty.toFixed(1)})</span>}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditStudent(student.id)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenException(student.id, `${student.name} ${student.surname1}`)}>
                        <AlertCircle className="mr-2 h-4 w-4" /> Excepciones / Tareas adaptadas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenAbsence(student.id, `${student.name} ${student.surname1}`, student.absences)}>
                        <UserRoundX className="mr-2 h-4 w-4" /> Registrar falta
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenNotes(student.id)}>
                        <ScrollText className="mr-2 h-4 w-4" /> Notas del alumno
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteStudent(student.id, `${student.name} ${student.surname1}`)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {studentAssessments.map((assessment) => {
                  const grade = student.grades.find((g) => g.assessmentId === assessment.id);
                  const isExcluded = student.exceptions.some((e) => e.assessmentId === assessment.id && e.isExcluded);

                  return (
                    <div key={assessment.id} className={`rounded border p-1.5 ${assessment.studentId ? "bg-amber-500/10 border-amber-500/30" : ""}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground truncate max-w-[100px] flex items-center gap-1">
                          {assessment.studentId && <Sparkles className="h-2.5 w-2.5 text-amber-500" />}
                          {assessment.name}
                        </p>
                        {assessment.type === "RUBRIC_WORK" && (
                          <button
                            onClick={() => onOpenRubricEval ? onOpenRubricEval(assessment, student.id) : onOpenRubric(assessment, true)}
                            className="text-amber-500 hover:scale-110 transition-transform"
                            title="Evaluar con rúbrica"
                          >
                            <Star className="h-3 w-3 fill-amber-500" />
                          </button>
                        )}
                      </div>

                      {savingCell?.studentId === student.id && savingCell?.assessmentId === assessment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : editingCell?.studentId === student.id && editingCell?.assessmentId === assessment.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveGrade(student.id, assessment, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveGrade(student.id, assessment, editValue);
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="h-6 text-xs w-full"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (assessment.type === "RUBRIC_WORK" && onOpenRubricEval) {
                              onOpenRubricEval(assessment, student.id);
                            } else {
                              setEditingCell({ studentId: student.id, assessmentId: assessment.id });
                              setEditValue(grade?.score !== null && grade?.score !== undefined ? String(grade.score) : "");
                            }
                          }}
                          className={`text-left text-sm font-medium ${
                            grade?.score !== null && grade?.score !== undefined ? getScoreColor(grade.score) : "text-muted-foreground"
                          } ${isExcluded ? "line-through opacity-40" : ""}`}
                        >
                          {grade?.score !== null && grade?.score !== undefined ? Number(grade.score).toFixed(1) : isExcluded ? "·" : "—"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1 text-xs">
                <span className="text-muted-foreground">Media trim.: {mAvg !== null ? (
                  <span className={getScoreColor(mAvg)}>
                    {mAvg.toFixed(2)} / {mMaxObtenible !== null ? mMaxObtenible.toFixed(1) : "10"}
                  </span>
                ) : (
                  "—"
                )}</span>
                <span className="text-muted-foreground">Final: {mFinal !== null ? (
                  <span className={`font-semibold ${getScoreColor(mFinal)}`}>
                    {mFinal.toFixed(2)} / 10
                  </span>
                ) : (
                  "—"
                )}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden md:block rounded-lg border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
          <span className="text-xs text-muted-foreground">
            {students.length} alumnos · {currentAssessments.length} evaluaciones
          </span>
          <Button
            variant={compactMode ? "default" : "outline"}
            size="sm"
            onClick={() => setCompactMode(!compactMode)}
            className="h-6 text-xs"
          >
            {compactMode ? "Vista normal" : "Vista completa"}
          </Button>
        </div>
        <div className={compactMode ? "" : "overflow-x-auto"}>
        <Table className={compactMode ? "min-w-full text-xs" : "min-w-max"}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center font-bold">Nº</TableHead>
              <TableHead className="font-bold">Nombre y apellidos</TableHead>
              <TableHead className="text-center w-10 font-bold">Faltas</TableHead>
              {currentAssessments.map((assessment) => {
                const colColor = parseColorString(assessment.columnColor);
                const colBg = colColor ? colorToCss(colColor, 0.15 + (colColor.intensity / 100) * 0.5) : undefined;
                const colText = colColor ? (colColor.r * 0.299 + colColor.g * 0.587 + colColor.b * 0.114 > 150 ? "text-black/70" : "text-white/80") : undefined;
                return (
                <TableHead
                  key={assessment.id}
                  style={colBg ? { backgroundColor: colBg } : undefined}
                  className={[
                    compactMode ? "min-w-[60px] text-center px-1" : "min-w-[95px] text-center",
                    colText,
                  ].filter(Boolean).join(" ")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-center text-xs font-semibold hover:underline flex items-center justify-center gap-1">
                          {assessment.name}
                          <span className="text-muted-foreground text-[10px]">({assessment.maxScore})</span>
                          {assessment.percentage > 0 && (
                            <span className="text-muted-foreground text-[10px]">· {assessment.percentage}%</span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        {assessment.type === "RUBRIC_WORK" && (
                          <>
                            <DropdownMenuItem onClick={() => onOpenRubricEval ? onOpenRubricEval(assessment) : onOpenRubric(assessment, true)}>
                              <Star className="mr-2 h-4 w-4 text-amber-500 fill-amber-500" /> Evaluar con rúbrica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenRubric(assessment, true)}>
                              <Settings2 className="mr-2 h-4 w-4" /> Configurar criterios rúbrica
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={() => onEditAssessment(assessment)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar evaluación
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={duplicatingAssessmentId === assessment.id}
                          onClick={() => handleDuplicateAssessment(assessment.id)}
                        >
                          {duplicatingAssessmentId === assessment.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4 text-primary" />
                          )}
                          Duplicar evaluación
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={deletingAssessmentId === assessment.id}
                          onClick={() => handleDeleteAssessment(assessment.id)}
                        >
                          {deletingAssessmentId === assessment.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Eliminar evaluación
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {assessment.type === "RUBRIC_WORK" && (
                      <button
                        onClick={() => onOpenRubricEval ? onOpenRubricEval(assessment) : onOpenRubric(assessment, true)}
                        className="text-amber-500 hover:scale-125 transition-transform"
                        title="Evaluar con rúbrica"
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-500" />
                      </button>
                    )}
                  </div>
                </TableHead>
                );
              })}
              <TableHead className="w-12 text-center">
                <button
                  onClick={() => onAddAssessment(trimester.id)}
                  className="text-muted-foreground hover:text-primary hover:scale-110 transition-transform p-1 rounded hover:bg-muted"
                  title="Añadir evaluación"
                >
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
              </TableHead>
              <TableHead className="text-center font-bold">Media</TableHead>
              <TableHead className="text-center font-bold">Final</TableHead>
            </TableRow>
            <TableRow className="bg-muted/20">
              <TableHead />
              <TableHead />
              <TableHead />
              {currentAssessments.map((assessment) => {
                const colColor = parseColorString(assessment.columnColor);
                const colBg = colColor ? colorToCss(colColor, 0.08 + (colColor.intensity / 100) * 0.25) : undefined;
                return (
                <TableHead
                  key={assessment.id}
                  style={colBg ? { backgroundColor: colBg } : undefined}
                  className="text-center text-[10px] text-muted-foreground"
                >
                  {assessment.percentage > 0 ? `${assessment.percentage}%` : ""}
                </TableHead>
                );
              })}
              <TableHead />
              <TableHead className="text-center text-[10px] text-muted-foreground font-normal">
                Total: {currentAssessments.reduce((acc, a) => acc + (a.percentage || 0), 0)}%
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={currentAssessments.length + 6} className="py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Info className="h-6 w-6" />
                    <p className="text-sm">No hay alumnos en este grupo.</p>
                    <p className="text-xs">Añade alumnos manualmente o impórtalos desde Excel.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orderedRows.map((row, rowIdx) => {
                if (row.type === "group") {
                  return (
                    <TableRow key={row.sig} className="bg-amber-500/10 border-y-2 border-amber-500/30">
                      <TableCell colSpan={currentAssessments.length + 6} className="py-2.5 px-4">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>
                              Caso de Adaptación Curricular ({row.members.length}{" "}
                              {row.members.length === 1 ? "alumno" : "alumnos"}):
                            </span>
                            <span className="font-normal text-muted-foreground">
                              Excluyen de la media:{" "}
                              <strong className="text-amber-800 dark:text-amber-200">
                                {row.excludedNames.join(", ")}
                              </strong>
                            </span>
                          </div>
                          <span className="text-[11px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
                            Alumnos con adaptación abajo 👇
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                const student = row.student;
                const count = Number(student.listNumber);
                const cellBg = stripeClass(student.id);
                const trimAbsences = student.absences.filter(
                  (a) => a.trimesterId === currentTrimesterId
                );
                const absences = trimAbsences.length;
                const penalty = getStudentPenalty(student);

                // Tareas a evaluar para este alumno en este trimestre
                const customAssessmentsInTrimester = (trimester.assessments || []).filter(
                  (a) => a.studentId === student.id
                );

                const studentAssessments = [
                  ...currentAssessments,
                  ...customAssessmentsInTrimester,
                ];

                const usefulAssessments = studentAssessments.filter(
                  (a) => !student.exceptions.some((e) => e.assessmentId === a.id && e.isExcluded)
                );

                const graded = usefulAssessments
                  .filter((a) => !a.isExtra)
                  .filter((a) => student.grades.find((g) => g.assessmentId === a.id)?.score != null);

                const rawAvg =
                  graded.length > 0
                    ? graded.reduce((acc, a) => {
                        const g = student.grades.find((x) => x.assessmentId === a.id);
                        return acc + (g?.score ?? 0);
                      }, 0) / graded.length
                    : null;

                const avg = rawAvg !== null ? (penalty > 0 ? Math.max(0, rawAvg - penalty) : rawAvg) : null;
                const excludedCount = student.exceptions.filter((e) => e.isExcluded).length;
                const customCount = customAssessmentsInTrimester.length;
                const maxObtenible = getTrimesterMax(student, currentTrimesterId);

                return (
                  <TableRow
                    key={student.id}
                    onContextMenu={(e) => openContextMenu(e, student)}
                    className={`cursor-context-menu hover:bg-muted/40 transition-colors ${cellBg}`}
                  >
                    <TableCell className={`text-center text-muted-foreground font-medium ${cellBg} ${compactMode ? "px-1 py-0.5 text-xs" : ""}`}>
                      {student.listNumber}
                    </TableCell>
                    <TableCell className={cellBg}>
                      <div>
                        <div className={`flex items-center gap-2 ${compactMode ? "gap-1" : ""}`}>
                          <button
                            className={`font-medium text-left hover:text-primary transition-colors flex items-center gap-1.5 ${compactMode ? "text-xs" : "text-sm"}`}
                            onClick={() => onOpenNotes(student.id)}
                          >
                            {student.surname1}{student.surname2 ? ` ${student.surname2}` : ""}, {student.name}
                          </button>

                          {excludedCount > 0 && (
                            <span className="text-xs text-amber-500 font-medium flex items-center gap-0.5" title={`${excludedCount} evaluaciones excluidas de su media`}>
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span className="text-[10px]">({excludedCount} exc.)</span>
                            </span>
                          )}
                          {customCount > 0 && (
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-0.5" title={`${customCount} tareas adaptadas exclusivas`}>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span className="text-[10px]">({customCount} adaptada)</span>
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Settings2 className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => onEditStudent(student.id)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar alumno
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onOpenException(student.id, `${student.surname1}${student.surname2 ? ` ${student.surname2}` : ""}, ${student.name}`)}>
                                <AlertCircle className="mr-2 h-4 w-4" /> Excepciones / Tareas adaptadas
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onOpenAbsence(student.id, `${student.surname1}${student.surname2 ? ` ${student.surname2}` : ""}, ${student.name}`, student.absences)}>
                                <UserRoundX className="mr-2 h-4 w-4" /> Registrar falta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onOpenNotes(student.id)}>
                                <ScrollText className="mr-2 h-4 w-4" /> Notas del alumno
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteStudent(student.id, `${student.name} ${student.surname1}`)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar alumno
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Mostrar tareas adaptadas exclusivas directamente bajo el nombre del alumno */}
                        {customAssessmentsInTrimester.map((ca) => {
                          const grade = student.grades.find((g) => g.assessmentId === ca.id);
                          const isEditing = editingCell?.studentId === student.id && editingCell?.assessmentId === ca.id;
                          const isSaving = savingCell?.studentId === student.id && savingCell?.assessmentId === ca.id;

                          return (
                            <div
                              key={ca.id}
                              className="mt-1 flex items-center gap-1.5 text-[11px] bg-purple-500/10 border border-purple-500/30 rounded px-2 py-0.5 w-fit"
                            >
                              <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />
                              <span className="font-semibold text-purple-900 dark:text-purple-300">
                                {ca.name}:
                              </span>
                              {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
                              ) : isEditing ? (
                                <Input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => saveGrade(student.id, ca, editValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveGrade(student.id, ca, editValue);
                                    if (e.key === "Escape") setEditingCell(null);
                                  }}
                                  className="h-5 w-12 text-xs p-0.5 text-center"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingCell({ studentId: student.id, assessmentId: ca.id });
                                    setEditValue(grade?.score != null ? String(grade.score) : "");
                                  }}
                                  className={`font-bold hover:underline ${
                                    grade?.score != null ? getScoreColor(grade.score) : "text-muted-foreground"
                                  }`}
                                  title="Haz clic para calificar la tarea adaptada"
                                >
                                  {grade?.score != null ? Number(grade.score).toFixed(1) : "—"} / {ca.maxScore}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className={`text-center ${compactMode ? "px-0.5" : ""} ${cellBg}`}>
                      <span
                        className={`text-xs font-medium cursor-pointer ${absences > 0 ? "text-destructive" : "text-muted-foreground"}`}
                        onClick={() => onOpenAbsence(student.id, `${student.surname1}, ${student.name}`, student.absences)}
                        title={penalty > 0 ? `Descuento por incidencias: -${penalty.toFixed(2)} pts` : "Registrar falta"}
                      >
                        {absences > 0 ? (
                          <span>
                            {absences}
                            {penalty > 0 && <span className="text-[10px] block text-destructive">(-{penalty.toFixed(1)})</span>}
                          </span>
                        ) : (
                          <Minus className="h-3 w-3 inline" />
                        )}
                      </span>
                    </TableCell>

                    {currentAssessments.map((assessment) => {
                      const grade = student.grades.find((g) => g.assessmentId === assessment.id);
                      const cellKey = `${student.id}-${assessment.id}`;
                      const isEditing =
                        editingCell?.studentId === student.id &&
                        editingCell?.assessmentId === assessment.id;
                      const isSaving =
                        savingCell?.studentId === student.id &&
                        savingCell?.assessmentId === assessment.id;
                      const excluded = student.exceptions.find(
                        (e) => e.assessmentId === assessment.id && e.isExcluded
                      );

                      const colColor = parseColorString(assessment.columnColor);
                      const colBg = colColor ? colorToCss(colColor, 0.06 + (colColor.intensity / 100) * 0.18) : undefined;
                      const colLeftBorder = colColor ? `3px solid ${colorToCss(colColor, 0.7 + (colColor.intensity / 100) * 0.3)}` : undefined;

                      return (
                        <TableCell
                          key={cellKey}
                          style={{
                            ...(colBg ? { backgroundColor: colBg } : {}),
                            ...(colLeftBorder ? { boxShadow: `inset 3px 0 0 ${colColor ? colorToCss(colColor, 0.85) : "transparent"}` } : {}),
                          }}
                          className={`text-center ${compactMode ? "px-0.5 py-0.5" : "p-1"} ${cellBg}`}
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveGrade(student.id, assessment, editValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveGrade(student.id, assessment, editValue);
                                  if (e.key === "Escape") {
                                    setEditingCell(null);
                                    setEditValue("");
                                  }
                                }}
                                className={`${compactMode ? "h-5 w-12" : "h-6 w-16"} text-xs text-center p-0`}
                                inputMode="decimal"
                              />
                              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (assessment.type === "RUBRIC_WORK" && onOpenRubricEval) {
                                  onOpenRubricEval(assessment, student.id);
                                } else {
                                  setEditingCell({ studentId: student.id, assessmentId: assessment.id });
                                  setEditValue(grade?.score !== null && grade?.score !== undefined ? String(grade.score) : "");
                                }
                              }}
                              className={`${compactMode ? "h-5 px-1 text-xs max-w-[50px]" : "h-7 px-2 text-sm max-w-[72px]"} rounded font-semibold text-center block mx-auto w-full ${
                                grade?.score !== null && grade?.score !== undefined
                                  ? getScoreColor(grade.score)
                                  : "text-muted-foreground"
                              } ${excluded ? "opacity-35 line-through" : ""} hover:bg-muted/80 transition-colors`}
                              title={
                                excluded
                                  ? "Excluido para este alumno"
                                  : assessment.type === "RUBRIC_WORK"
                                    ? `Calificado por rúbrica: ${grade?.score ?? "—"} / ${assessment.maxScore}. Haz clic para evaluar.`
                                    : grade?.score !== null && grade?.score !== undefined
                                      ? `${grade.score} / ${assessment.maxScore}`
                                      : "Sin calificar — haz clic"
                              }
                            >
                              {grade?.score !== null && grade?.score !== undefined
                                ? Number(grade.score).toFixed(1)
                                : excluded
                                  ? "·"
                                  : "—"}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell className={`${compactMode ? "px-0.5" : ""} ${cellBg}`} />
                    <TableCell className={`text-center font-semibold ${compactMode ? "px-0.5 text-xs" : ""} ${cellBg}`}>
                      {avg !== null ? (
                        <span className={getScoreColor(avg)}>
                          {avg.toFixed(2)}
                          {!compactMode && <span className="text-muted-foreground/60 text-[10px] font-normal"> / {maxObtenible !== null ? maxObtenible.toFixed(1) : "10"}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-center font-bold ${compactMode ? "px-0.5 text-xs" : ""} ${cellBg}`}>
                      {(() => {
                        const finalScore = studentFinalAverage(student);
                        return finalScore !== null ? (
                          <span className={getScoreColor(finalScore)}>
                            {finalScore.toFixed(2)}
                            {!compactMode && <span className="text-muted-foreground/60 text-[10px] font-normal"> / 10</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {/* Fila resumen de clase */}
            {students.length > 0 && (
              <TableRow className="bg-muted/60 font-semibold border-t-2">
                <TableCell />
                <TableCell className="text-sm font-bold">Media del grupo</TableCell>
                <TableCell />
                {currentAssessments.map((assessment) => {
                  const scores = students
                    .map((s) => s.grades.find((g) => g.assessmentId === assessment.id)?.score)
                    .filter((s): s is number => s !== null && s !== undefined);
                  const isExcludedStudents = students.filter((s) =>
                    s.exceptions.find((e) => e.assessmentId === assessment.id && e.isExcluded)
                  );
                  const usableScores = isExcludedStudents.length > 0
                    ? students
                        .filter((s) => !isExcludedStudents.includes(s))
                        .map((s) => s.grades.find((g) => g.assessmentId === assessment.id)?.score)
                        .filter((s): s is number => s !== null && s !== undefined)
                    : scores;
                  const avg =
                    usableScores.length > 0
                      ? usableScores.reduce((a, b) => a + b, 0) / usableScores.length
                      : null;
                  const passCount = usableScores.filter((s) => s >= 5).length;
                  return (
                    <TableCell key={assessment.id} className="text-center">
                      <p className="text-sm font-semibold">
                        {avg !== null ? (
                          <span className={getScoreColor(avg)}>{avg.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {passCount}/{usableScores.length} aptos
                      </p>
                    </TableCell>
                  );
                })}
                <TableCell />
                <TableCell className="text-center font-bold">
                  {(() => {
                    const allAvgs = students
                      .map((student) => {
                        const graded = nonExtra.filter((a) => {
                          const g = student.grades.find((x) => x.assessmentId === a.id);
                          return g?.score !== null && g?.score !== undefined;
                        });
                        if (graded.length === 0) return null;
                        const baseAvg =
                          graded.reduce((acc, a) => {
                            const g = student.grades.find((x) => x.assessmentId === a.id);
                            return acc + (g?.score ?? 0);
                          }, 0) / graded.length;
                        const penalty = getStudentPenalty(student);
                        return penalty > 0 ? Math.max(0, baseAvg - penalty) : baseAvg;
                      })
                      .filter((v): v is number => v !== null);
                    const total = allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : null;
                    return total !== null ? (
                      <span className={getScoreColor(total)}>{total.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-center font-extrabold">
                  {(() => {
                    const finals = students
                      .map((s) => studentFinalAverage(s))
                      .filter((v): v is number => v !== null);
                    const total = finals.length > 0 ? finals.reduce((a, b) => a + b, 0) / finals.length : null;
                    return total !== null ? (
                      <span className={getScoreColor(total)}>{total.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    );
                  })()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Menú contextual (click derecho sobre un alumno) */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed z-50 min-w-[210px] rounded-md border bg-popover p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <div className="px-2 py-1.5 text-xs font-bold text-foreground border-b mb-1">
            {contextMenu.studentName}
          </div>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => onOpenException(contextMenu.studentId, contextMenu.studentName)}
          >
            <AlertCircle className="h-4 w-4 text-primary" />
            Excepciones / Tareas adaptadas
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => onOpenAbsence(contextMenu.studentId, contextMenu.studentName, contextMenu.absences)}
          >
            <UserRoundX className="h-4 w-4" />
            Registrar falta / disciplina
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => onOpenNotes(contextMenu.studentId)}
          >
            <ScrollText className="h-4 w-4" />
            Notas y Anotaciones
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => onEditStudent(contextMenu.studentId)}
          >
            <Pencil className="h-4 w-4" />
            Editar alumno
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
            onClick={() => handleDeleteStudent(contextMenu.studentId, contextMenu.studentName)}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar alumno
          </button>
        </div>
      )}
    </div>
  );
}