"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";

export interface TrimesterConfig {
  id?: string;
  name: string;
  percentage: number;
  order: number;
  studentCount?: number;
}

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  trimesters: TrimesterConfig[];
  penaltyAbsence?: number;
  penaltyLate?: number;
  penaltyNegative?: number;
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  groupId,
  trimesters,
  penaltyAbsence = 0,
  penaltyLate = 0,
  penaltyNegative = 0,
}: GroupSettingsDialogProps) {
  const router = useRouter();
  const [items, setItems] = useState<TrimesterConfig[]>(
    trimesters.map((t) => ({ ...t }))
  );
  const [penAbsence, setPenAbsence] = useState<number>(penaltyAbsence);
  const [penLate, setPenLate] = useState<number>(penaltyLate);
  const [penNegative, setPenNegative] = useState<number>(penaltyNegative);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(trimesters.map((t) => ({ ...t })));
      setPenAbsence(penaltyAbsence);
      setPenLate(penaltyLate);
      setPenNegative(penaltyNegative);
    }
  }, [open, trimesters, penaltyAbsence, penaltyLate, penaltyNegative]);

  const update = (idx: number, field: keyof TrimesterConfig, value: string | number) => {
    setItems((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const addTrimester = () => {
    setItems((prev) => [
      ...prev,
      { name: `Trimestre ${prev.length + 1}`, percentage: 0, order: prev.length + 1 },
    ]);
  };

  const removeTrimester = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const totalPct = items.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPct !== 100) {
      toast.error(`Los porcentajes deben sumar 100%. Actualmente suman ${totalPct}%.`);
      return;
    }
    setSaving(true);
    try {
      // 1. Guardar trimestres
      const resTrimesters = await fetch("/api/trimesters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          trimesters: items.map((t, i) => ({
            id: t.id,
            name: t.name,
            percentage: Number(t.percentage),
            order: i + 1,
          })),
        }),
      });

      // 2. Guardar penalizaciones del grupo
      const resGroup = await fetch("/api/groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: groupId,
          penaltyAbsence: Number(penAbsence) || 0,
          penaltyLate: Number(penLate) || 0,
          penaltyNegative: Number(penNegative) || 0,
        }),
      });

      if (resTrimesters.ok && resGroup.ok) {
        toast.success("Ajustes del grupo guardados");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("Error al guardar los ajustes");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustes del Grupo</DialogTitle>
          <DialogDescription>
            Configura los trimestres, porcentajes y deducciones de disciplina.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Trimestres (% sobre la nota final)</h4>
            <div className="space-y-2">
              {items.map((t, idx) => (
                <div key={idx} className="flex items-end gap-2 rounded-lg border p-2.5 bg-card/60">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={t.name}
                      onChange={(e) => update(idx, "name", e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">% Nota</Label>
                    <Input
                      type="number"
                      min={0}
                      value={t.percentage}
                      onChange={(e) => update(idx, "percentage", Number(e.target.value))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={items.length <= 1}
                    onClick={() => removeTrimester(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-2">
              <Button type="button" variant="outline" size="sm" onClick={addTrimester}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir trimestre
              </Button>
              <span className={`text-xs font-semibold ${totalPct === 100 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                Total: {totalPct}% (debe ser 100%)
              </span>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold">Descuento por Faltas y Disciplina (puntos)</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Resta puntos automáticamente de la nota final por cada incidencia (0.0 = desactivado).
            </p>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Falta injustificada</Label>
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  value={penAbsence}
                  onChange={(e) => setPenAbsence(Number(e.target.value))}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retraso</Label>
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  value={penLate}
                  onChange={(e) => setPenLate(Number(e.target.value))}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Parte negativo</Label>
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  value={penNegative}
                  onChange={(e) => setPenNegative(Number(e.target.value))}
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}