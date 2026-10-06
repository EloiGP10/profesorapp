"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import {
  countAbsences,
  studentFinalAverage,
  trimesterAverage,
  usefulAssessments,
  type StatAssessment,
  type StatStudent,
  type StatTrimester,
} from "@/lib/student-stats";

export interface FamilyReportStudent extends StatStudent {
  listNumber: number;
  name: string;
  surname1: string;
  surname2: string | null;
  nia: string | null;
}

export interface FamilyReportTrimester {
  id: string;
  name: string;
  percentage: number;
  assessments: (StatAssessment & { name: string; type: string })[];
}

interface FamilyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: FamilyReportStudent | null;
  groupName: string;
  trimesters: FamilyReportTrimester[];
}

function fullName(s: FamilyReportStudent) {
  return `${s.name} ${s.surname1}${s.surname2 ? ` ${s.surname2}` : ""}`;
}

function fmt(n: number | null, digits = 1) {
  return n === null ? "—" : n.toFixed(digits);
}

export function FamilyReportDialog({
  open,
  onOpenChange,
  student,
  groupName,
  trimesters,
}: FamilyReportDialogProps) {
  const report = useMemo(() => {
    if (!student) return null;
    return trimesters.map((t) => {
      const useful = [
        ...t.assessments.filter((a) => !a.isExtra && !a.studentId),
        ...t.assessments.filter((a) => !a.isExtra && a.studentId === student.id),
      ];
      const graded = useful.filter(
        (a) => student.grades.find((g) => g.assessmentId === a.id)?.score != null
      );
      const rawAvg = graded.length > 0
        ? graded.reduce((acc, a) => {
          const g = student.grades.find((x) => x.assessmentId === a.id);
          return acc + (g?.score ?? 0);
        }, 0) / graded.length
        : null;

      const items = useful.map((a) => ({
        name: a.name,
        type: a.type,
        percentage: a.percentage,
        maxScore: a.maxScore,
        score: student.grades.find((g) => g.assessmentId === a.id)?.score ?? null,
        isExtra: a.isExtra,
        isPersonal: !!a.studentId,
        excluded: !!student.exceptions.find((e) => e.assessmentId === a.id && e.isExcluded),
      }));

      const penalty = 0; // families don't see penalties

      return {
        id: t.id,
        name: t.name,
        percentage: t.percentage,
        items,
        average: rawAvg,
        penalty,
        absences: countAbsences(student, t.id),
      };
    });
  }, [student, trimesters]);

  const handlePrint = () => {
    if (!student || !report) return;
    const trimesterTables = report
      .map((t) => {
        const rows = t.items
          .map((it) => {
            const tag = it.excluded ? " (exenta)" : it.isExtra ? " (extra)" : it.isPersonal ? " (personal)" : "";
            return `<tr><td>${it.name}${tag}</td><td style="text-align:center">${it.percentage}%</td><td style="text-align:center">${it.score === null ? "—" : it.score} / ${it.maxScore}</td></tr>`;
          })
          .join("");
        return `<h3>${t.name} (${t.percentage}%) — Media: ${fmt(t.average)}</h3>
          <table><thead><tr><th>Evaluación</th><th style="text-align:center">Peso</th><th style="text-align:center">Nota</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Sin evaluaciones</td></tr>'}</tbody></table>
          <p>Faltas: ${t.absences.absent} · Retrasos: ${t.absences.late} · Negativos: ${t.absences.negative}</p>`;
      })
      .join("");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) {
      toast.error("El navegador bloqueó la ventana de impresión");
      return;
    }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informes — ${fullName(student)}</title>
      <style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin-bottom:4px}h3{font-size:14px;margin:16px 0 6px}p{font-size:12px}.meta{color:#555;font-size:13px;margin:4px 0 12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#eee}.final{font-size:14px;font-weight:bold;margin-top:12px}.sign{margin-top:32px;display:flex;gap:32px;font-size:12px}.sign div{border-top:1px solid #111;padding-top:4px;width:180px}</style>
      </head><body>
      <h1>Informes escolares</h1>
      <p class="meta">${fullName(student)} · Nº ${student.listNumber}${student.nia ? ` · NIA ${student.nia}` : ""} · Grupo ${groupName} · ${new Date().toLocaleDateString("es-ES")}</p>
      ${trimesterTables}
      <p class="final">Media final: ${fmt(report?.[report.length - 1]?.average)}</p>
      <p>Total faltas: ${report?.[0]?.absences?.absent ?? 0} · retrasos: ${report?.[0]?.absences?.late ?? 0} · negativos: ${report?.[0]?.absences?.negative ?? 0}</p>
      <div class="sign"><div>Firma de la familia</div><div>Fecha</div></div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  const handleExportExcel = () => {
    if (!student || !report) return;
    try {
      const aoa: (string | number)[][] = [
        [`Informes escolares — ${fullName(student)}`],
        [`Grupo ${groupName} · Nº ${student.listNumber}${student.nia ? ` · NIA ${student.nia}` : ""} · ${new Date().toLocaleDateString("es-ES")}`],
        [],
      ];
      for (const t of report) {
        aoa.push([`${t.name} (${t.percentage}%) — Media: ${fmt(t.average)}`]);
        aoa.push(["Evaluación", "Peso %", "Nota", "Sobre"]);
        for (const it of t.items) {
          const tag = it.excluded ? " (exenta)" : it.isExtra ? " (extra)" : it.isPersonal ? " (personal)" : "";
          aoa.push([
            `${it.name}${tag}`,
            it.percentage,
            it.score === null ? "—" : it.score,
            it.maxScore,
          ]);
        }
        aoa.push([`Faltas: ${t.absences.absent} · Retrasos: ${t.absences.late} · Negativos: ${t.absences.negative}`]);
        aoa.push([]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Informes");
      XLSX.writeFile(wb, `Informes-${fullName(student).replace(/\s+/g, "-")}.xlsx`);
      toast.success("Informes exportados a Excel");
    } catch {
      toast.error("Error al exportar los informes");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Informes — {student ? fullName(student) : ""}
          </DialogTitle>
          <DialogDescription>
            {student ? `Nº ${student.listNumber} · Grupo ${groupName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {report && (
          <div className="space-y-5">
            {report.map((t) => (
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
                          <th className="text-center px-2 py-1">Peso</th>
                          <th className="text-center px-2 py-1">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.items.map((it, i) => (
                          <tr key={i} className={`border-t ${it.excluded ? "opacity-50" : ""}`}>
                            <td className="px-2 py-1">{it.name}{it.excluded && <span className="text-muted-foreground"> (exenta)</span>}</td>
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
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">Media final</span>
              <span className="text-lg font-bold">{fmt(report?.[report.length - 1]?.average ?? null)}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handlePrint} className="flex-1 min-w-40">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir / PDF
              </Button>
              <Button type="button" variant="outline" onClick={handleExportExcel} className="flex-1 min-w-40">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Descargar Excel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}