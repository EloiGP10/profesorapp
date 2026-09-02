"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradeTable } from "@/components/grade-table";
import { StudentDialog } from "@/components/student-dialog";
import { NotesDialog } from "@/components/notes-dialog";
import { RemindersDialog } from "@/components/reminders-dialog";
import { GroupStatsDialog } from "@/components/group-stats";
import { GroupSettingsDialog, type TrimesterConfig } from "@/components/group-settings-dialog";
import { AssessmentDialog } from "@/components/assessment-dialog";
import { RubricDialog } from "@/components/rubric-dialog";
import { RubricEvalDialog, type RubricEvalAssessment } from "@/components/rubric-eval-dialog";
import { ExceptionDialog } from "@/components/exception-dialog";
import { AbsenceDialog } from "@/components/absence-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { ProfileDialog } from "@/components/profile-dialog";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, BarChart3, Bell, FileUp, GraduationCap,
  Loader2, Plus, Settings2, User, UserPlus, FileText, Award, Settings, BookOpen, Clock,
} from "lucide-react";
import type { GradeTableStudent, GradeTableAssessment } from "@/components/grade-table";

interface AssessmentFull extends GradeTableAssessment {
  rubric?: {
    id: string;
    rows: Array<{
      id: string;
      title: string;
      percentage: number;
      order: number;
      poorText: string;
      fairText: string;
      goodText: string;
      excellentText: string;
    }>;
  } | null;
}

interface TrimesterWithAssessments extends TrimesterConfig {
  id: string;
  assessments: AssessmentFull[];
}

interface GroupSummary {
  id: string;
  name: string;
  code: string | null;
  year: number;
}

interface GroupData {
  id: string;
  name: string;
  code: string | null;
  year: number;
  penaltyAbsence: number;
  penaltyLate: number;
  penaltyNegative: number;
  trimesters: TrimesterWithAssessments[];
  students: GroupStudent[];
}

interface GroupStudent extends GradeTableStudent {
  nia: string | null;
  email: string | null;
  phone: string | null;
}

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [allGroups, setAllGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  const [activeTrimesterId, setActiveTrimesterId] = useState<string>("");
  const [dialogStudent, setDialogStudent] = useState<null | { open: boolean; studentId: string | null }>({ open: false, studentId: null });
  const [dialogNotes, setDialogNotes] = useState<null | { open: boolean; studentId: string; studentName: string }>(null);
  const [dialogReminders, setDialogReminders] = useState(false);
  const [dialogStats, setDialogStats] = useState(false);
  const [dialogSettings, setDialogSettings] = useState(false);
  const [dialogProfile, setDialogProfile] = useState(false);
  const [dialogImport, setDialogImport] = useState(false);
  const [dialogExport, setDialogExport] = useState(false);
  const [dialogGrade, setDialogGrade] = useState<null | { open: boolean; trimesterId: string; assessment?: AssessmentFull | null }>(null);
  const [dialogRubric, setDialogRubric] = useState<null | { open: boolean; assessment: AssessmentFull }>(null);
  const [dialogRubricEval, setDialogRubricEval] = useState<null | { open: boolean; assessment: RubricEvalAssessment | null; studentId?: string | null }>(null);
  const [dialogException, setDialogException] = useState<null | { open: boolean; studentId: string; studentName: string }>(null);
  const [dialogAbsence, setDialogAbsence] = useState<null | { open: boolean; studentId: string; studentName: string; absences: { id: string; date: string; type: string; notes: string | null; trimesterId: string | null }[] }>(null);
  const [statsActive, setStatsActive] = useState(false);

  useEffect(() => {
    loadGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadGroup = async () => {
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    const meData = await meRes.json();
    setUserName(meData.user?.name || meData.user?.email?.split("@")[0] || null);

    try {
      // Cargar todos los grupos para la barra de pestañas superior
      const allRes = await fetch("/api/groups");
      if (allRes.ok) {
        const all = await allRes.json();
        setAllGroups(all);
      }

      // Cargar datos del grupo actual
      const res = await fetch(`/api/groups?id=${id}`);
      if (res.status === 404) {
        setHidden(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
        setActiveTrimesterId(data.trimesters[0]?.id ?? "");
      }
    } catch (error) {
      console.error("Error loading group:", error);
    } finally {
      setLoading(false);
    }
  };

  const statsData = useMemo<{ trimesterStats: Array<{ name: string; percentage: number; avg: number | null; passRate: number | null }>; overallAvg: number | null } | null>(() => {
    if (!group) return null;

    const trimesterStats = group.trimesters.map((t) => {
      const avgs = group.students.map((s) => {
        const grades = s.grades.filter((g) => {
          const ass = t.assessments.find((a) => a.id === g.assessmentId);
          return ass && g.score !== null;
        });
        if (grades.length === 0) return null;
        return grades.reduce((acc, g) => acc + (g.score ?? 0), 0) / grades.length;
      }).filter((v): v is number => v !== null);

      const avg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
      const passRate = avgs.length > 0 ? (avgs.filter((v) => v >= 5).length / avgs.length) * 100 : null;

      return { name: t.name, percentage: t.percentage, avg, passRate };
    });

    const overalls = group.students.map((s) => {
      let sum = 0;
      let wsum = 0;
      group.trimesters.forEach((t) => {
        const tas = t.assessments.filter((a) => !a.isExtra);
        const graded = s.grades
          .filter((g) => tas.find((a) => a.id === g.assessmentId) && g.score !== null)
          .map((g) => g.score as number);
        if (graded.length === 0) return;
        const avg = graded.reduce((a, b) => a + b, 0) / graded.length;
        sum += avg * (t.percentage / 100);
        wsum += t.percentage / 100;
      });
      return wsum > 0 ? sum / wsum : null;
    }).filter((v): v is number => v !== null);

    const overallAvg = overalls.length > 0 ? overalls.reduce((a, b) => a + b, 0) / overalls.length : null;

    return { trimesterStats, overallAvg };
  }, [group]);

  const toggleStats = async () => {
    setStatsActive((v) => !v);
    setDialogStats((v) => !v);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (hidden || !group) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Grupo no encontrado</h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          El grupo que buscas no existe o no tienes acceso a él.
          Puede que haya sido eliminado.
        </p>
        <Button onClick={() => router.push("/dashboard")}>
          Volver al panel
        </Button>
      </div>
    );
  }

  const activeTrimester = group.trimesters.find((t) => t.id === activeTrimesterId) ?? group.trimesters[0];
  const activeAssessments = activeTrimester?.assessments ?? [];

  const handleAddAssessment = (trimesterId: string) => {
    setDialogGrade({ open: true, trimesterId });
  };

  const handleEditAssessment = (assessment: GradeTableAssessment) => {
    setDialogGrade({ open: true, trimesterId: activeTrimester.id, assessment: assessment as AssessmentFull });
  };

  const openRubric = (assessment: AssessmentFull) => {
    setDialogRubric({ open: true, assessment });
  };

  const handleOpenRubricEval = (assessment: GradeTableAssessment, studentId?: string) => {
    setDialogRubricEval({
      open: true,
      assessment: assessment as RubricEvalAssessment,
      studentId: studentId || null,
    });
  };

  const handleOpenNotes = (studentId: string) => {
    const student = group.students.find((s) => s.id === studentId);
    if (!student) return;
    setDialogNotes({
      open: true,
      studentId,
      studentName: `${student.surname1} ${student.name}`,
    });
  };

  const handleEditStudent = (studentId: string) => {
    setDialogStudent({ open: true, studentId });
  };

  const handleOpenException = (studentId: string, studentName: string) => {
    setDialogException({ open: true, studentId, studentName });
  };

  const handleOpenAbsence = (
    studentId: string,
    studentName: string,
    absences: { id: string; date: string; type: string; notes: string | null; trimesterId: string | null }[]
  ) => {
    setDialogAbsence({ open: true, studentId, studentName, absences });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Barra superior de pestañas de clases / grupos */}
      {allGroups.length > 0 && (
        <div className="border-b bg-muted/40 px-4 py-1.5 flex items-center gap-1 overflow-x-auto">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1.5 uppercase tracking-wider shrink-0">
            Mis Clases:
          </span>
          {allGroups.map((g) => (
            <Link key={g.id} href={`/group/${g.id}`}>
              <Button
                variant={g.id === group.id ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-3 text-xs rounded-md transition-all ${
                  g.id === group.id
                    ? "font-bold bg-background text-foreground shadow-sm border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.name}
              </Button>
            </Link>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/dashboard")}
            title="Crear o gestionar grupos"
          >
            <Plus className="h-3 w-3 mr-1" />
            Nueva
          </Button>
        </div>
      )}

      {/* Header principal */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" title="Volver al panel">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{group.name}</h1>
                {group.code && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                    {group.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {group.students.length} alumnos · Curso {group.year}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link href={`/dashboard/qualifications/${id}`}>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Award className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">Calificaciones</span><span className="xs:hidden">Calif.</span>
              </Button>
            </Link>
            <Link href={`/dashboard/evaluations/${id}`}>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <FileText className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Eval.
              </Button>
            </Link>
            <Link href={`/dashboard/teaching-content/${id}`}>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <BookOpen className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Contenidos
              </Button>
            </Link>
            <Link href={`/dashboard/schedule/${id}`}>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Clock className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Horario
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={toggleStats} className="text-xs sm:text-sm">
              <BarChart3 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Estadísticas</span><span className="sm:hidden">Stats</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialogReminders(true)} className="text-xs sm:text-sm">
              <Bell className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Recordatorios</span><span className="sm:hidden">Avís</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialogSettings(true)} className="text-xs sm:text-sm">
              <Settings2 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Ajustes
            </Button>
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                <Settings className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Config
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setDialogProfile(true)} className="flex items-center gap-1.5 text-xs sm:text-sm">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              <span className="hidden sm:inline text-xs font-medium">{userName || "Perfil"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Tabs value={activeTrimesterId} onValueChange={setActiveTrimesterId}>
            <TabsList>
              {group.trimesters.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
                  {t.name} ({t.percentage}%)
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogImport(true)}>
              <FileUp className="mr-1.5 h-4 w-4" /> Importar alumnos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialogExport(true)}>
              <BarChart3 className="mr-1.5 h-4 w-4" /> Exportar
            </Button>
            <Button size="sm" onClick={() => setDialogStudent({ open: true, studentId: null })}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Añadir alumno
            </Button>
          </div>
        </div>

        <GradeTable
          groupId={group.id}
          trimesters={group.trimesters}
          students={group.students}
          currentTrimesterId={activeTrimesterId}
          penaltyAbsence={group.penaltyAbsence}
          penaltyLate={group.penaltyLate}
          penaltyNegative={group.penaltyNegative}
          onAddAssessment={handleAddAssessment}
          onEditAssessment={handleEditAssessment}
          onOpenRubric={openRubric}
          onOpenRubricEval={handleOpenRubricEval}
          onOpenNotes={handleOpenNotes}
          onEditStudent={handleEditStudent}
          onOpenException={handleOpenException}
          onOpenAbsence={handleOpenAbsence}
          onDataChange={loadGroup}
        />
      </main>

      {/* Dialogs */}
      <StudentDialog
        open={dialogStudent?.open ?? false}
        onOpenChange={(o) => setDialogStudent((prev) => ({ open: o, studentId: prev?.studentId ?? null }))}
        groupId={group.id}
        student={
          dialogStudent?.studentId
            ? group.students.find((s) => s.id === (dialogStudent?.studentId ?? ""))
            : null
        }
        nextListNumber={
          group.students.length > 0
            ? Math.max(...group.students.map((s) => s.listNumber)) + 1
            : 1
        }
        onSaved={loadGroup}
      />

      <NotesDialog
        open={dialogNotes?.open ?? false}
        onOpenChange={(o) => setDialogNotes((prev) => (prev ? { ...prev, open: o } : prev))}
        studentId={dialogNotes?.studentId ?? null}
        studentName={dialogNotes?.studentName ?? ""}
      />

      <RemindersDialog
        open={dialogReminders}
        onOpenChange={setDialogReminders}
        groupId={group.id}
      />

      {statsData && (
        <GroupStatsDialog
          open={dialogStats}
          onOpenChange={setDialogStats}
          groupName={group.name}
          trimesterStats={(statsData as any).trimesterStats}
          overallAvg={(statsData as any).overallAvg}
        />
      )}

      <GroupSettingsDialog
        open={dialogSettings}
        onOpenChange={setDialogSettings}
        groupId={group.id}
        trimesters={group.trimesters}
        penaltyAbsence={group.penaltyAbsence}
        penaltyLate={group.penaltyLate}
        penaltyNegative={group.penaltyNegative}
      />

      <ProfileDialog
        open={dialogProfile}
        onOpenChange={setDialogProfile}
        onProfileUpdated={(u) => setUserName(u.name || u.email.split("@")[0])}
      />

      <AssessmentDialog
        open={dialogGrade?.open ?? false}
        onOpenChange={(o) => setDialogGrade((prev) => (prev ? { ...prev, open: o } : prev))}
        trimesterId={dialogGrade?.trimesterId ?? activeTrimester.id}
        assessment={dialogGrade?.assessment ?? null}
        existingAssessments={activeAssessments}
        onSaved={loadGroup}
        onCreated={(newAssessment) => {
          loadGroup();
          if (newAssessment.type === "RUBRIC_WORK") {
            setDialogRubric({
              open: true,
              assessment: { ...newAssessment, rubric: null },
            });
          }
        }}
      />

      <RubricDialog
        open={dialogRubric?.open ?? false}
        onOpenChange={(o) => setDialogRubric((prev) => (prev ? { ...prev, open: o } : prev))}
        assessmentId={dialogRubric?.assessment.id ?? ""}
        assessmentName={dialogRubric?.assessment.name ?? ""}
        maxScore={dialogRubric?.assessment.maxScore ?? 10}
        rubric={dialogRubric?.assessment.rubric ?? null}
      />

      <RubricEvalDialog
        open={dialogRubricEval?.open ?? false}
        onOpenChange={(o) => setDialogRubricEval((prev) => (prev ? { ...prev, open: o } : prev))}
        assessment={dialogRubricEval?.assessment ?? null}
        students={group.students}
        initialStudentId={dialogRubricEval?.studentId ?? null}
        onGradeSaved={loadGroup}
      />

      <ExceptionDialog
        open={dialogException?.open ?? false}
        onOpenChange={(o) => setDialogException((prev) => (prev ? { ...prev, open: o } : prev))}
        studentId={dialogException?.studentId ?? ""}
        studentName={dialogException?.studentName ?? ""}
        trimesters={group.trimesters.map((t) => ({ id: t.id, name: t.name }))}
        assessments={(group.trimesters ?? []).flatMap((t) =>
          (t.assessments ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            trimester: { name: t.name },
          }))
        )}
        onSaved={loadGroup}
      />

      <AbsenceDialog
        open={dialogAbsence?.open ?? false}
        onOpenChange={(o) => setDialogAbsence((prev) => (prev ? { ...prev, open: o } : prev))}
        studentId={dialogAbsence?.studentId ?? ""}
        studentName={dialogAbsence?.studentName ?? ""}
        currentTrimesterId={activeTrimesterId}
        trimesters={group.trimesters.map((t) => ({ id: t.id, name: t.name }))}
        absences={dialogAbsence?.absences ?? []}
        onSaved={loadGroup}
      />

      <ImportDialog
        open={dialogImport}
        onOpenChange={setDialogImport}
        groupId={group.id}
      />

      <ExportDialog
        open={dialogExport}
        onOpenChange={setDialogExport}
        groupId={group.id}
        groupName={group.name}
        hasAssessments={
          (group.trimesters ?? []).some((t) => (t.assessments ?? []).length > 0)
        }
      />
    </div>
  );
}