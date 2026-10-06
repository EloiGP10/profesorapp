"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, FileUp, Loader2, Percent, Plus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface RubricRowDraft {
  id?: string;
  title: string;
  percentage: number | string;
  poorText: string;
  fairText: string;
  goodText: string;
  excellentText: string;
}

const LEVEL_COLUMNS = [
  { field: "poorText", label: "Mal" },
  { field: "fairText", label: "Regular" },
  { field: "goodText", label: "Bien" },
  { field: "excellentText", label: "Genial" },
] as const;

const EXCEL_HEADERS = ["Criterio", "Porcentaje", "Mal", "Regular", "Bien", "Genial"];

const normalizeHeader = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["criterio", "apartado", "criterion", "criteria"],
  percentage: ["porcentaje", "%", "peso", "percent", "percentage", "porcentaje (%)"],
  poorText: ["mal", "poor"],
  fairText: ["regular", "fair"],
  goodText: ["bien", "good"],
  excellentText: ["genial", "excelente", "excellent"],
};

function parsePercentage(value: unknown): number {
  if (typeof value === "number") return Number(value.toFixed(2));
  const cleaned = String(value ?? "").trim().replace("%", "").replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Number(n.toFixed(2));
}

function downloadRubricWorkbook(filename: string, dataRows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...dataRows]);
  ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 26 }, { wch: 26 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rúbrica");
  XLSX.writeFile(wb, filename);
}

interface RubricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentId: string;
  assessmentName: string;
  maxScore: number;
  rubric?: {
    id: string;
    rows: RubricRowDraft[];
  } | null;
  /** Nº de alumnos ya evaluados con esta rúbrica (si > 0 se muestra aviso) */
  evaluatedCount?: number;
}

export function RubricDialog({ open, onOpenChange, assessmentId, assessmentName, maxScore, rubric, evaluatedCount = 0 }: RubricDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RubricRowDraft[]>(
    rubric?.rows?.map((r) => ({ ...r })) ?? [
      { title: "Contenido", percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
      { title: "Expresión", percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
      { title: "Participación", percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
    ]
  );

  useEffect(() => {
    if (open) {
      setRows(
        rubric?.rows?.map((r) => ({ ...r })) ?? [
          { title: "Contenido", percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
          { title: "Expresión", percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
          { title: "Participación", percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
        ]
      );
    }
  }, [open, rubric]);

  const updateRow = (idx: number, field: keyof RubricRowDraft, value: string | number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { title: `Apartado ${prev.length + 1}`, percentage: 25, poorText: "Mal", fairText: "Regular", goodText: "Bien", excellentText: "Genial" },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const splitEvenly = () => {
    setRows((prev) => {
      if (prev.length === 0) return prev;
      const n = prev.length;
      const each = Math.floor((100 / n) * 100) / 100;
      const last = Number((100 - each * (n - 1)).toFixed(2));
      return prev.map((r, i) => ({ ...r, percentage: i === n - 1 ? last : each }));
    });
    toast.success("Porcentajes repartidos equitativamente");
  };

  const totalPct = rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      toast.error("Añade al menos una fila a la rúbrica");
      return;
    }
    if (totalPct !== 100) {
      toast.error(`Los porcentajes deben sumar 100%. Actualmente suman ${totalPct}%.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rubrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          rows: rows.map((r, i) => ({
            id: r.id,
            title: r.title.trim() || `Apartado ${i + 1}`,
            percentage: Number(r.percentage) || 0,
            poorText: r.poorText || "Mal",
            fairText: r.fairText || "Regular",
            goodText: r.goodText || "Bien",
            excellentText: r.excellentText || "Genial",
            order: i + 1,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          data.preservedStudents > 0
            ? `Rúbrica guardada · notas de ${data.preservedStudents} ${data.preservedStudents === 1 ? "alumno conservadas" : "alumnos conservadas"}`
            : "Rúbrica guardada"
        );
        onOpenChange(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar la rúbrica");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);

  const sanitizeFilename = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim() || "rubrica";

  const handleDownloadTemplate = () => {
    downloadRubricWorkbook("Plantilla-Rubrica.xlsx", [
      ["Contenido", 34, "Mal", "Regular", "Bien", "Genial"],
      ["Expresión", 33, "Mal", "Regular", "Bien", "Genial"],
      ["Participación", 33, "Mal", "Regular", "Bien", "Genial"],
    ]);
    toast.success("Plantilla descargada. Edítala en Excel y vuelve a importarla aquí.");
  };

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.error("No hay criterios que exportar");
      return;
    }
    downloadRubricWorkbook(
      `Rubrica-${sanitizeFilename(assessmentName)}.xlsx`,
      rows.map((r) => [
        r.title,
        Number(r.percentage) || 0,
        r.poorText,
        r.fairText,
        r.goodText,
        r.excellentText,
      ])
    );
    toast.success("Rúbrica exportada a Excel");
  };

  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) {
          toast.error("El archivo no tiene hojas");
          return;
        }
        const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          blankrows: false,
        });
        if (matrix.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        // Localizar la fila de cabeceras (permite filas de título/instrucciones arriba)
        const normRow = (row: unknown[]) => row.map((c) => normalizeHeader(c));
        let headerIdx = -1;
        for (let i = 0; i < Math.min(matrix.length, 6); i++) {
          const cells = normRow(matrix[i]);
          if (cells.some((c) => HEADER_ALIASES.title.includes(c))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          toast.error("No se encontró la columna «Criterio». Usa la plantilla descargada desde aquí.");
          return;
        }
        const headerCells = normRow(matrix[headerIdx]);
        const colOf = (field: keyof RubricRowDraft) =>
          headerCells.findIndex((c) => HEADER_ALIASES[field].includes(c));

        const titleCol = colOf("title");
        if (titleCol === -1) {
          toast.error("No se encontró la columna «Criterio»");
          return;
        }
        const pctCol = colOf("percentage");
        const poorCol = colOf("poorText");
        const fairCol = colOf("fairText");
        const goodCol = colOf("goodText");
        const excellentCol = colOf("excellentText");

        const imported: RubricRowDraft[] = [];
        for (const row of matrix.slice(headerIdx + 1)) {
          if (imported.length >= 30) break;
          const title = String(row[titleCol] ?? "").trim();
          if (!title) continue;
          imported.push({
            title,
            percentage: pctCol === -1 ? 0 : parsePercentage(row[pctCol]),
            poorText: poorCol === -1 ? "Mal" : String(row[poorCol] ?? "").trim() || "Mal",
            fairText: fairCol === -1 ? "Regular" : String(row[fairCol] ?? "").trim() || "Regular",
            goodText: goodCol === -1 ? "Bien" : String(row[goodCol] ?? "").trim() || "Bien",
            excellentText:
              excellentCol === -1 ? "Genial" : String(row[excellentCol] ?? "").trim() || "Genial",
          });
        }

        if (imported.length === 0) {
          toast.error("No se encontraron criterios con nombre en el archivo");
          return;
        }
        setRows(imported);
        const total = imported.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
        toast.success(
          `${imported.length} criterios importados (suman ${Number(total.toFixed(2))}%). Revisa y guarda.`
        );
      } catch {
        toast.error("Error al leer el archivo. Asegúrate de que sea un .xlsx válido");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rúbrica — {assessmentName}</DialogTitle>
          <DialogDescription>
            Define los criterios con sus niveles (Mal / Regular / Bien / Genial) sobre {maxScore} puntos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {evaluatedCount > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
              Esta rúbrica ya evalúa a {evaluatedCount} {evaluatedCount === 1 ? "alumno" : "alumnos"}: al guardar
              se conservan sus notas. Solo se pierden las de los criterios que elimines.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2 font-medium">Criterio</th>
                  {LEVEL_COLUMNS.map(({ field, label }) => (
                    <th key={field} className="py-2 px-2 font-medium whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                  <th className="py-2 pl-2 font-medium whitespace-nowrap">% del total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b align-top">
                    <td className="py-2 pr-2 min-w-[140px]">
                      <Input
                        value={row.title}
                        onChange={(e) => updateRow(idx, "title", e.target.value)}
                        className="text-sm"
                      />
                    </td>
                    {LEVEL_COLUMNS.map(({ field }) => (
                      <td key={field} className="py-2 px-1 min-w-[100px]">
                        <Textarea
                          value={row[field]}
                          onChange={(e) => updateRow(idx, field, e.target.value)}
                          rows={2}
                          className="text-sm min-h-[56px]"
                        />
                      </td>
                    ))}
                    <td className="py-2 pl-2 w-28">
                      <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={row.percentage}
                          onChange={(e) =>
                            updateRow(idx, "percentage", e.target.value === "" ? "" : Number(e.target.value))
                          }
                          aria-label={`Porcentaje del criterio ${row.title || idx + 1}`}
                          className="h-9 w-14 border-0 bg-transparent px-1 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
                        />
                        <span className="text-sm font-semibold text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="py-2 px-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={rows.length <= 1}
                        onClick={() => removeRow(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir criterio
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={splitEvenly}
              disabled={rows.length === 0}
            >
              <Percent className="mr-2 h-4 w-4" />
              Repartir equitativamente
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <FileDown className="mr-2 h-4 w-4" />
              Plantilla Excel
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Importar Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportExcel(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Descarga la plantilla, edítala en Excel y vuelve a importarla: se reconocen las columnas
            Criterio, Porcentaje, Mal, Regular, Bien y Genial.
          </p>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Suma de porcentajes</span>
            <span className={`font-semibold ${totalPct === 100 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {totalPct}%
            </span>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar rúbrica
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}