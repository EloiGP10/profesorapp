"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface RubricRowDraft {
  id?: string;
  title: string;
  percentage: number;
  poorText: string;
  fairText: string;
  goodText: string;
  excellentText: string;
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
}

export function RubricDialog({ open, onOpenChange, assessmentId, assessmentName, maxScore, rubric }: RubricDialogProps) {
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
        toast.success("Rúbrica guardada");
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2 font-medium">Criterio</th>
                  {["poor", "fair", "good", "excellent"].map((level) => (
                    <th key={level} className="py-2 px-2 font-medium whitespace-nowrap capitalize">
                      {level}
                    </th>
                  ))}
                  <th className="py-2 pl-2 font-medium whitespace-nowrap">%</th>
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
                    {(["poorText", "fairText", "goodText", "excellentText"] as const).map((field) => (
                      <td key={field} className="py-2 px-1 min-w-[110px]">
                        <Textarea
                          value={row[field]}
                          onChange={(e) => updateRow(idx, field, e.target.value)}
                          rows={2}
                          className="text-sm min-h-[56px]"
                        />
                      </td>
                    ))}
                    <td className="py-2 pl-2 w-20">
                      <Input
                        type="number"
                        min={0}
                        value={row.percentage}
                        onChange={(e) => updateRow(idx, "percentage", Number(e.target.value))}
                        className="text-sm"
                      />
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

          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Añadir criterio
          </Button>

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