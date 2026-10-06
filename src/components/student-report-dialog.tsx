"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import {
  countAbsences,
  getStudentPenalty,
  studentFinalAverage,
  trimesterAverage,
  type StatAssessment,
  type StatPenalties,
  type StatStudent,
} from "@/lib/student-stats";

export interface ReportStudent extends StatStudent {
  listNumber: number;
  name: string;
  surname1: string;
  surname2: string | null;
  nia: string | null;
}

export interface ReportTrimester {
  id: string;
  name: string;
  percentage: number;
  assessments: (StatAssessment & { name: string; type: string })[];
}

interface StudentReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: ReportStudent | null;
  groupName: string;
  trimesters: ReportTrimester[];
  penalties: StatPenalties;
}

interface ReportItem {
  name: string;
  type: string;
  percentage: number;
  maxScore: number;
  score: number | null;
  isExtra: boolean;
  isPersonal: boolean;
  excluded: boolean;
}

interface ReportTrimesterData {
  id: string;
  name: string;
  percentage: number;
  items: ReportItem[];
  average: number | null;
  penalty: number;
  absences: { absent: number; late: number; negative: number };
}

const TYPE_LABELS: Record<string, string> = {
  EXAM: "Examen",
  NOTEBOOK: "Libreta",
  WORK: "Trabajo",
  RUBRIC_WORK: "Trabajo con rúbrica",
  OTHER: "Otro",
};

function fullName(s: ReportStudent) {
  return `${s.name} ${s.surname1}${s.surname2 ? ` ${s.surname2}` : ""}`;
}

function fmt(n: number | null, digits = 2) {
  return n === null ? "—" : n.toFixed(digits);
}

export function StudentReportDialog({
  open,
  onOpenChange,
  student,
  groupName,
  trimesters,
  penalties,
}: StudentReportDialogProps) {
  const [exporting, setExporting] = useState(false);

  const report = useMemo(() => {
    if (!student) return null;
    const trimesterData: ReportTrimesterData[] = trimesters.map((t) => {
      const items: ReportItem[] = [
        ...t.assessments.filter((a) => !a.studentId),
        ...t.assessments.filter((a) => a.studentId === student.id),
      ].map((a) => ({
        name: a.name,
        type: a.type,
        percentage: a.percentage,
        maxScore: a.maxScore,
        score: student.grades.find((g) => g.assessmentId === a.id)?.score ?? null,
        isExtra: a.isExtra,
        isPersonal: !!a.studentId,
        excluded: !!student.exceptions.find((e) => e.assessmentId === a.id && e.isExcluded),
      }));
      return {
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        items,
        average: trimesterAverage(student, t, penalties),
        penalty: getStudentPenalty(student, t.id, penalties),
        absences: countAbsences(student, t.id),
      };
    });
    return {
      trimesterData,
      finalAverage: studentFinalAverage(student, trimesters, penalties),
      totalAbsences: countAbsences(student),
    };
  }, [student, trimesters, penalties]);

  const handlePrint = () => {
    if (!student || !report) return;
    const trimesterTables = report.trimesterData
      .map((t) => {
        const rows = t.items
          .map((it) => {
            const tag = it.excluded ? " (exenta)" : it.isExtra ? " (extra)" : it.isPersonal ? " (personal)" : "";
            return `<tr><td>${it.name}${tag}</td><td style="text-align:center">${TYPE_LABELS[it.type] ?? it.type}</td><td style="text-align:center">${it.percentage}%</td><td style="text-align:center">${it.score === null ? "—" : it.score} / ${it.maxScore}</td></tr>`;
          })
          .join("");
        return `<h3>${t.name} (${t.percentage}%) — Media: ${fmt(t.average)}</h3>
          <table><thead><tr><th>Evaluación</th><th>Tipo</th><th>Peso</th><th>Nota</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Sin evaluaciones</td></tr>'}</tbody></table>
          <p>Faltas: ${t.absences.absent} · Retrasos: ${t.absences.late} · Negativos: ${t.absences.negative}${t.penalty > 0 ? ` · Penalización aplicada: -${t.penalty.toFixed(2)}` : ""}</p>`;
      })
      .join("");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) {
      toast.error("El navegador bloqueó la ventana de impresión");
      return;
    }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Boletín — ${fullName(student)}</title>
      <style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin-bottom:0}h3{font-size:15px;margin:20px 0 6px}p{font-size:12px}.meta{color:#555;font-size:13px;margin:4px 0 12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#eee}.final{font-size:16px;font-weight:bold;margin-top:16px}.sign{margin-top:48px;display:flex;gap:48px;font-size:12px}.sign div{border-top:1px solid #111;padding-top:4px;width:200px}</style>
      </head><body>
      <h1>Boletín de calificaciones</h1>
      <p class="meta">${fullName(student)} · Nº ${student.listNumber}${student.nia ? ` · NIA ${student.nia}` : ""} · Grupo ${groupName} · ${new Date().toLocaleDateString("es-ES")}</p>
      ${trimesterTables}
      <p class="final">Media final: ${fmt(report.finalAverage)}</p>
      <p>Total faltas: ${report.totalAbsences.absent} · retrasos: ${report.totalAbsences.late} · negativos: ${report.totalAbsences.negative}</p>
      <div class="sign"><div>Firma del tutor/a</div><div>Firma de la familia</div></div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  const handleExportExcel = () => {
    if (!student || !report) return;
    setExporting(true);
    try {
      const aoa: (string | number)[][] = [
        [`Boletín de calificaciones — ${fullName(student)}`],
        [`Grupo ${groupName} · Nº ${student.listNumber}${student.nia ? ` · NIA ${student.nia}` : ""} · ${new Date().toLocaleDateString("es-ES")}`],
        [],
      ];
      for (const t of report.trimesterData) {
        aoa.push([`${t.name} (${t.percentage}%) — Media: ${fmt(t.average)}`]);
        aoa.push(["Evaluación", "Tipo", "Peso %", "Nota", "Sobre"]);
        for (const it of t.items) {
          const tag = it.excluded ? " (exenta)" : it.isExtra ? " (extra)" : it.isPersonal ? " (personal)" : "";
          aoa.push([
            `${it.name}${tag}`,
            TYPE_LABELS[it.type] ?? it.type,
            it.percentage,
            it.score === null ? "—" : it.score,
            it.maxScore,
          ]);
        }
        aoa.push([`Faltas: ${t.absences.absent} · Retrasos: ${t.absences.late} · Negativos: ${t.absences.negative}`]);
        aoa.push([]);
      }
      aoa.push([`Media final: ${fmt(report.finalAverage)}`]);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 34 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Boletín");
      XLSX.writeFile(wb, `Boletin-${fullName(student).replace(/\s+/g, "-")}.xlsx`);
      toast.success("Boletín exportado a Excel");
    } catch {
      toast.error("Error al exportar el boletín");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Boletín — {student ? fullName(student) : ""}
          </DialogTitle>
          <DialogDescription>
            {student ? `Nº ${student.listNumber} · Grupo ${groupName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {report && (
          <div className="space-y-5">
            {report.trimesterData.map((t) => (
              <div key={t.id}>
                <div className="flex items-baseline justify-between mb-1">
                  <h4 className="text-sm font-semibold">{t.name} <span className="font-normal text-muted-foreground">({t.percentage}%)</span></h4>
                  <p className="text-sm">Media: <span className="font-semibold">{fmt(t.average)}</span></p>
                </div>
                {t.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin evaluaciones.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-2 py-1">Evaluación</th>
                          <th className="text-left px-2 py-1">Tipo</th>
                          <th className="text-center px-2 py-1">Peso</th>
                          <th className="text-center px-2 py-1">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.items.map((it, i) => (
                          <tr key={i} className={`border-t ${it.excluded ? "opacity-50" : ""}`}>
                            <td className="px-2 py-1">
                              {it.name}
                              {it.excluded && <span className="text-muted-foreground"> (exenta)</span>}
                              {it.isExtra && <span className="text-muted-foreground"> (extra)</span>}
                              {it.isPersonal && <span className="text-muted-foreground"> (personal)</span>}
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">{TYPE_LABELS[it.type] ?? it.type}</td>
                            <td className="px-2 py-1 text-center">{it.percentage}%</td>
                            <td className="px-2 py-1 text-center font-medium">
                              {it.score === null ? "—" : `${it.score} / ${it.maxScore}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Faltas: {t.absences.absent} · Retrasos: {t.absences.late} · Negativos: {t.absences.negative}
                  {t.penalty > 0 ? ` · Penalización: -${t.penalty.toFixed(2)}` : ""}
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">Media final</span>
              <span className="text-lg font-bold">{fmt(report?.finalAverage ?? null)}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePrint} className="flex-1 min-w-40">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir / PDF
              </Button>
              <Button type="button" variant="outline" onClick={handleExportExcel} disabled={exporting} className="flex-1 min-w-40">
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Descargar Excel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
