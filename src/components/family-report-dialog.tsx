"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileSpreadsheet, Link2, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import {
  countAbsences,
  studentFinalAverage,
  trimesterAverage,
  type StatAssessment,
  type StatStudent,
  type StatTrimester,
} from "@/lib/student-stats";

const TRIMESTER_KEYS = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

const STRUCTURED_COMMENTS: Record<string, string[]> = {
  "Trimestre 1": [
    "Destacar buen comienzo de curso",
    "Necesita reforzar contenidos básicos",
    "Buena actitud en clase",
    "Precio atención a las faltas",
  ],
  "Trimestre 2": [
    "Progreso notable en la segunda mitad",
    "Mantener el nivel de exigencia",
    "Alumno más participativo",
    "Trabajar en autonomía",
  ],
  "Trimestre 3": [
    "Cierre del curso satisfactorio",
    "Preparación para el próximo curso",
    "Áreas de mejora para el próximo curso",
    "Evaluación final y conclusiones",
  ],
};

function fullName(s: any) {
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
}: any) {
  const [annotations, setAnnotations] = useState<any>({});
  const [commentTexts, setCommentTexts] = useState<any>(({} as any));
  const [expandedTrims, setExpandedTrims] = useState<string[]>([]);

  // Cargar anotaciones existentes al abrir el diálogo
  useEffect(() => {
    if (!open || !student?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reports/annotations?studentId=${student.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const loaded: any = data.annotations || {};
        if (cancelled) return;
        setAnnotations(loaded);
        const initial: any = {};
        TRIMESTER_KEYS.forEach((key) => {
          initial[key] = loaded[key] || "";
        });
        initial.firma = loaded.firma || "";
        setCommentTexts(initial);
        setExpandedTrims([]);
      } catch {
        toast.error("Error al cargar las observaciones");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, student?.id]);

  // Guardar anotaciones
  const saveAnnotations = async (newAnnotations: any) => {
    try {
      await fetch("/api/reports/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student?.id,
          annotations: newAnnotations,
        }),
      });
      setAnnotations(newAnnotations);
      // Construir commentTexts actualizado
      const newComments: any = {};
      TRIMESTER_KEYS.forEach((key) => {
        newComments[key] = newAnnotations[key] || "";
      });
      newComments.firma = newAnnotations.firma || "";
      setCommentTexts(newComments);
      toast.success("Anotaciones guardadas");
    } catch (e) {
      toast.error("Error al guardar anotaciones");
    }
  };

  // Generar comentario estructurado por botón
  const generateStructuredComment = (trimesterKey: string, index: number) => {
    const options = STRUCTURED_COMMENTS[trimesterKey] || [];
    if (index < options.length) {
      const current = commentTexts[trimesterKey] || "";
      setCommentTexts({
        ...commentTexts,
        [trimesterKey]: current ? `${current}\n---\n${options[index]}` : options[index],
      });
    }
  };

  const report = useMemo(() => {
    if (!student) return null;
    return trimesters.map((t: any) => {
      const useful = [
        ...t.assessments.filter((a: any) => !a.isExtra && !a.studentId),
        ...t.assessments.filter((a: any) => !a.isExtra && a.studentId === student.id),
      ];
      const graded = useful.filter(
        (a: any) => student.grades.find((g: any) => g.assessmentId === a.id)?.score != null
      );
      const rawAvg = graded.length > 0
        ? graded.reduce((acc: any, a: any) => {
          const g = student.grades.find((x: any) => x.assessmentId === a.id);
          return acc + (g?.score ?? 0);
        }, 0) / graded.length
        : null;

      const items = useful.map((a: any) => ({
        name: a.name,
        type: a.type,
        percentage: a.percentage,
        maxScore: a.maxScore,
        score: student.grades.find((g: any) => g.assessmentId === a.id)?.score ?? null,
        isExtra: a.isExtra,
        isPersonal: !!a.studentId,
        excluded: !!student.exceptions.find((e: any) => e.assessmentId === a.id && e.isExcluded),
      }));

      const penalty = 0;

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

  // Media final ponderada de todos los trimestres
  const finalAverage = useMemo(() => {
    if (!student || !report || report.length === 0) return null;
    let weighted = 0;
    let totalWeight = 0;
    report.forEach((t: any) => {
      if (t.average === null) return;
      weighted += t.average * (t.percentage || 0);
      totalWeight += t.percentage || 0;
    });
    return totalWeight > 0 ? weighted / totalWeight : null;
  }, [student, report]);

  // Alternar visibilidad de la sección de comentarios de un trimestre
  const toggleTrimExpansion = (trimesterKey: string) => {
    setExpandedTrims((prev: string[]) => {
      if (prev.includes(trimesterKey)) return prev.filter((k: string) => k !== trimesterKey);
      return [...prev, trimesterKey];
    });
  };

  // Exportar Excel con annotations incluidas
  const handleExportExcel = () => {
    if (!student || !report) return;
    try {
      const aoa: (string | number)[][] = [
        [`Informes escolares — ${fullName(student)}`],
        [`Grupo ${groupName} · Nº ${student.listNumber}${student.nia ? ` · NIA ${student.nia}` : ""} · ${new Date().toLocaleDateString("es-ES")}`],
        [],
      ];

      // Sección de observaciones del profesor
      aoa.push(["Observaciones del profesor", ""]);
      TRIMESTER_KEYS.forEach((trimesterKey) => {
        aoa.push([trimesterKey, annotations[trimesterKey] || ""]);
      });
      aoa.push(["Firma del profesor", annotations.firma || ""]);
      aoa.push(["", ""]);

      for (const t of report) {
        aoa.push([`${t.name} (${t.percentage}%) — Media: ${fmt(t.average)}`]);
        aoa.push(["Evaluación", "Peso %", "Nota", "Sobre"]);
        for (const it of t.items) {
          aoa.push([
            `${it.name}`,
            it.percentage,
            it.score === null ? "—" : it.score,
            it.maxScore,
          ]);
        }
        aoa.push([`Faltas: ${t.absences.absent} · Retrasos: ${t.absences.late} · Negativos: ${t.absences.negative}`]);
        aoa.push([]);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 38 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Informes");
      toast.success("Informes exportados a Excel con observaciones");
      XLSX.writeFile(wb, `Informes-${fullName(student).replace(/\s+/g, "-")}.xlsx`);
    } catch {
      toast.error("Error al exportar los informes");
    }
  };

  // Copiar el enlace público para las familias
  const handleCopyLink = async () => {
    if (!student) return;
    const url = `${window.location.origin}/family-report/${student.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado. Ya puedes enviárselo a la familia.");
    } catch {
      window.prompt("Copia este enlace para la familia:", url);
    }
  };

  // Exportar a PDF con el mismo formato que se ve en pantalla
  const handleExportPdf = () => {
    if (!student) return;
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto">
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
            {report.map((t: any) => (
              <div key={t.id} className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
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
                        {t.items.map((it: any, i: number) => (
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

            {/* Sección de Observaciones del Profesor */}
            <div className="rounded-lg border p-4 mb-6 bg-muted/20">
              <h3 className="font-semibold mb-3">Observaciones del profesor</h3>

              {TRIMESTER_KEYS.map((trimesterKey) => (
                <div key={trimesterKey} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium">{trimesterKey}</h5>
                    <button
                      onClick={() => toggleTrimExpansion(trimesterKey)}
                      className="text-xs text-primary hover:underline"
                    >
                      {expandedTrims.includes(trimesterKey) ? "Collapse" : "Expandir"}
                    </button>
                  </div>

                  {expandedTrims.includes(trimesterKey) && (
                    <div className="space-y-2">
                      {/* Botones de estructura */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {STRUCTURED_COMMENTS[trimesterKey].map((text: string, i: number) => (
                          <Button
                            key={text}
                            variant="ghost"
                            size="sm"
                            onClick={() => generateStructuredComment(trimesterKey, i)}
                            className="text-[11px] px-2 py-1"
                          >
                            {text}
                          </Button>
                        ))}
                      </div>

                      {/* Campo de texto editable */}
                      <textarea
                        className="w-full rounded border p-2 text-sm resize-h min-h[60px]"
                        value={commentTexts[trimesterKey] || ""}
                        onChange={(e: any) => {
                          const newComments: any = { ...commentTexts, [trimesterKey]: e.target.value };
                          setCommentTexts(newComments);
                        }}
                        placeholder="Escribe aquí las observaciones para este trimestre..."
                        rows={3}
                      />

                      {/* Botón para guardar este trimestre */}
                      <Button
                        size="sm"
                        onClick={() => {
                          const newAnnotations: any = { ...annotations, [trimesterKey]: commentTexts[trimesterKey] || "" };
                          // Guardar también firma en el último trimestre
                          if (trimesterKey === "Trimestre 3") {
                            newAnnotations.firma = commentTexts["Trimestre 3"] || "";
                          }
                          saveAnnotations(newAnnotations);
                        }}
                        className="w-full mt-2"
                      >
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Firma al final */}
              <div className="mt-4 pt-4 border-t">
                <h5 className="text-sm font-medium">Firma del profesor</h5>
                <textarea
                  className="w-full rounded border p-2 text-sm resize-h min-h[60px]"
                  value={annotations.firma || ""}
                  onChange={(e: any) => {
                    const newAnnotations: any = { ...annotations, firma: e.target.value };
                    setAnnotations(newAnnotations);
                  }}
                  placeholder="Firma y nombre del profesor"
                  rows={2}
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">Media final</span>
              <span className="text-lg font-bold">{fmt(report?.[report.length - 1]?.average ?? null)}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="flex-1 min-w-52"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Copiar enlace para la familia
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportPdf}
                className="flex-1 min-w-52"
              >
                <Printer className="mr-2 h-4 w-4" />
                Exportar PDF (igual que se ve)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportExcel}
                className="flex-1 min-w-52"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Descargar Excel con notas
              </Button>
            </div>
          </div>
        )}

        {/* Contenedor exclusivo para impresión: replica el formato visible */}
        {student && report && (
          <div className="print-report hidden">
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                .print-report,
                .print-report * {
                  visibility: visible !important;
                  display: revert !important;
                }
                .print-report {
                  display: block !important;
                  position: absolute;
                  left: 0; top: 0; width: 100%;
                  padding: 0; margin: 0;
                  overflow: visible !important;
                  height: auto !important;
                  max-height: none !important;
                  background: #fff; color: #000;
                }
                @page { size: A4; margin: 14mm; }
              }
            `}</style>

            <header style={{ marginBottom: "16px", borderBottom: "2px solid #000", paddingBottom: "8px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                Boletín de calificaciones
              </h1>
              <p style={{ fontSize: "14px", margin: "4px 0 0" }}>
                {fullName(student)} · Nº {student.listNumber}
                {student.nia ? ` · NIA ${student.nia}` : ""} · {groupName}
              </p>
            </header>

            {TRIMESTER_KEYS.map((trimesterKey) => (
              <section key={trimesterKey} style={{ marginBottom: "12px" }}>
                <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px" }}>{trimesterKey}</h2>
                <p style={{ fontSize: "12px", margin: "0 0 4px", whiteSpace: "pre-wrap" }}>
                  {annotations[trimesterKey] || "—"}
                </p>
              </section>
            ))}

            {report.map((t: any) => (
              <section key={t.id} style={{ marginBottom: "14px", breakInside: "avoid" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px" }}>
                  {t.name} ({t.percentage}%) — Media: {fmt(t.average)}
                </h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ background: "#eee" }}>
                      <th style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "left" }}>Evaluación</th>
                      <th style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "left" }}>Tipo</th>
                      <th style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "center" }}>Peso</th>
                      <th style={{ border: "1px solid #999", padding: "3px 5px", textAlign: "center" }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td style={{ border: "1px solid #ccc", padding: "3px 5px" }}>
                          {it.name}{it.isPersonal ? " (personal)" : ""}
                        </td>
                        <td style={{ border: "1px solid #ccc", padding: "3px 5px" }}>{it.type}</td>
                        <td style={{ border: "1px solid #ccc", padding: "3px 5px", textAlign: "center" }}>{it.percentage}%</td>
                        <td style={{ border: "1px solid #ccc", padding: "3px 5px", textAlign: "center" }}>
                          {it.score === null ? "—" : `${it.score} / ${it.maxScore}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: "11px", margin: "4px 0 0" }}>
                  Faltas: {t.absences.absent} · Retrasos: {t.absences.late} · Negativos: {t.absences.negative}
                </p>
              </section>
            ))}

            <footer style={{ marginTop: "14px", borderTop: "1px solid #999", paddingTop: "8px", fontSize: "12px" }}>
              <p style={{ margin: "0" }}>
                <strong>Media final:</strong> {fmt(finalAverage)}
              </p>
              {annotations.firma && (
                <p style={{ margin: "14px 0 0", whiteSpace: "pre-wrap" }}>{annotations.firma}</p>
              )}
            </footer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}