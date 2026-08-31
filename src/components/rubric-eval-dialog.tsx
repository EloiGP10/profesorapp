"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Loader2,
  Save, Sparkles, Star, User,
} from "lucide-react";
import type { GradeTableStudent } from "@/components/grade-table";

export interface RubricEvalRow {
  id: string;
  title: string;
  percentage: number;
  order: number;
  poorText: string;
  fairText: string;
  goodText: string;
  excellentText: string;
}

export interface RubricEvalAssessment {
  id: string;
  name: string;
  maxScore: number;
  percentage: number;
  rubric?: {
    id: string;
    rows: RubricEvalRow[];
  } | null;
}

interface RubricEvalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: RubricEvalAssessment | null;
  students: GradeTableStudent[];
  initialStudentId?: string | null;
  onGradeSaved?: (studentId: string, assessmentId: string, score: number) => void;
}

const LEVEL_CONFIG = [
  {
    id: "POOR",
    label: "Mal",
    scoreValue: 1,
    color: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    activeColor: "ring-2 ring-red-500 bg-red-100 dark:bg-red-900/50 border-red-500 font-semibold shadow-sm",
  },
  {
    id: "FAIR",
    label: "Regular",
    scoreValue: 4,
    color: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    activeColor: "ring-2 ring-amber-500 bg-amber-100 dark:bg-amber-900/50 border-amber-500 font-semibold shadow-sm",
  },
  {
    id: "GOOD",
    label: "Bien",
    scoreValue: 7,
    color: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    activeColor: "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50 border-blue-500 font-semibold shadow-sm",
  },
  {
    id: "EXCELLENT",
    label: "Genial",
    scoreValue: 10,
    color: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    activeColor: "ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 font-semibold shadow-sm",
  },
] as const;

export function RubricEvalDialog({
  open,
  onOpenChange,
  assessment,
  students,
  initialStudentId,
  onGradeSaved,
}: RubricEvalDialogProps) {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [scores, setScores] = useState<Record<string, "POOR" | "FAIR" | "GOOD" | "EXCELLENT">>({});
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => assessment?.rubric?.rows ?? [], [assessment?.rubric?.rows]);

  // Al abrir el diálogo, inicializar alumno
  useEffect(() => {
    if (open && students.length > 0) {
      const studentId = initialStudentId && students.some((s) => s.id === initialStudentId)
        ? initialStudentId
        : students[0].id;
      setSelectedStudentId(studentId);
    }
  }, [open, initialStudentId, students]);

  // Cargar puntuaciones del alumno seleccionado
  useEffect(() => {
    if (open && assessment?.id && selectedStudentId) {
      loadStudentScores(selectedStudentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assessment?.id, selectedStudentId]);

  const loadStudentScores = async (studentId: string) => {
    if (!assessment) return;
    setLoadingStudent(true);
    try {
      const res = await fetch(`/api/rubrics?assessmentId=${assessment.id}&studentId=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        const scoreMap: Record<string, "POOR" | "FAIR" | "GOOD" | "EXCELLENT"> = {};
        if (data.rows && Array.isArray(data.rows)) {
          data.rows.forEach((row: any) => {
            if (row.scores && row.scores.length > 0) {
              scoreMap[row.id] = row.scores[0].level;
            }
          });
        }
        setScores(scoreMap);
      }
    } catch {
      toast.error("Error al cargar notas de la rúbrica");
    } finally {
      setLoadingStudent(false);
    }
  };

  const currentStudentIndex = students.findIndex((s) => s.id === selectedStudentId);
  const currentStudent = students[currentStudentIndex];

  // Cálculo en vivo de la nota
  const calculatedGrade = useMemo(() => {
    if (!assessment || rows.length === 0) return null;
    let totalWeight = 0;
    let weightedSum = 0;

    for (const row of rows) {
      const level = scores[row.id];
      if (!level) continue;
      const levelConf = LEVEL_CONFIG.find((l) => l.id === level);
      if (!levelConf) continue;
      totalWeight += row.percentage;
      weightedSum += (levelConf.scoreValue / 10) * row.percentage * assessment.maxScore;
    }

    if (totalWeight === 0) return null;
    return Number((weightedSum / totalWeight).toFixed(2));
  }, [assessment, rows, scores]);

  const handleSelectLevel = (rowId: string, level: "POOR" | "FAIR" | "GOOD" | "EXCELLENT") => {
    setScores((prev) => ({
      ...prev,
      [rowId]: prev[rowId] === level ? (undefined as any) : level,
    }));
  };

  const handleSave = async (advanceNext = false) => {
    if (!assessment || !selectedStudentId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/rubrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: assessment.id,
          studentId: selectedStudentId,
          scores,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Nota de ${currentStudent?.name ?? "alumno"}: ${data.score ?? "—"}`);
        if (onGradeSaved && data.score !== null && data.score !== undefined) {
          onGradeSaved(selectedStudentId, assessment.id, data.score);
        }
        router.refresh();

        if (advanceNext && currentStudentIndex < students.length - 1) {
          setSelectedStudentId(students[currentStudentIndex + 1].id);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar la calificación");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (!assessment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                Evaluar con Rúbrica — {assessment.name}
              </DialogTitle>
              <DialogDescription>
                Califica en directo mientras el alumno expone o entrega el trabajo.
              </DialogDescription>
            </div>
            {calculatedGrade !== null && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs text-muted-foreground font-medium">Nota en vivo:</span>
                <Badge
                  variant="outline"
                  className={`text-base font-bold px-3 py-1 ${
                    calculatedGrade >= 5
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  }`}
                >
                  {calculatedGrade.toFixed(2)} / {assessment.maxScore}
                </Badge>
              </div>
            )}
          </div>

          {/* Selector y Navegación rápida de alumnos */}
          <div className="flex items-center justify-between gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={currentStudentIndex <= 0}
              onClick={() => setSelectedStudentId(students[currentStudentIndex - 1].id)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>

            <div className="flex-1 max-w-sm">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="font-medium text-sm">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecciona alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s, idx) => (
                    <SelectItem key={s.id} value={s.id}>
                      #{s.listNumber} {s.surname1}{s.surname2 ? ` ${s.surname2}` : ""}, {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentStudentIndex >= students.length - 1}
              onClick={() => setSelectedStudentId(students[currentStudentIndex + 1].id)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </DialogHeader>

        {loadingStudent ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando criterios de rúbrica...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>Esta evaluación no tiene criterios de rúbrica configurados todavía.</p>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {rows.map((row, rowIdx) => {
              const selectedLevel = scores[row.id];
              return (
                <div key={row.id} className="rounded-lg border p-4 bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {rowIdx + 1}
                      </span>
                      {row.title}
                    </h4>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {row.percentage}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {LEVEL_CONFIG.map((lvl) => {
                      const isSelected = selectedLevel === lvl.id;
                      const textDesc =
                        lvl.id === "POOR" ? row.poorText
                        : lvl.id === "FAIR" ? row.fairText
                        : lvl.id === "GOOD" ? row.goodText
                        : row.excellentText;

                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => handleSelectLevel(row.id, lvl.id)}
                          className={`flex flex-col text-left p-3 rounded-lg border text-xs transition-all ${lvl.color} ${
                            isSelected ? lvl.activeColor : "opacity-75 hover:opacity-100"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold mb-1">
                            <span>{lvl.label}</span>
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <p className="text-[11px] leading-relaxed line-clamp-3 opacity-90">
                            {textDesc || lvl.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Alumno {currentStudentIndex + 1} de {students.length}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-initial"
              disabled={saving || loadingStudent}
              onClick={() => handleSave(false)}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
            <Button
              className="flex-1 sm:flex-initial bg-primary text-primary-foreground"
              disabled={saving || loadingStudent}
              onClick={() => handleSave(true)}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Guardar y siguiente alumno →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
