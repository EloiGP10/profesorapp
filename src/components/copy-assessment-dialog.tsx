"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

export interface CopyAssessmentSource {
  id: string;
  name: string;
  type: string;
  percentage: number;
  maxScore: number;
  studentId?: string | null;
  hasRubric?: boolean;
}

interface TargetGroup {
  id: string;
  name: string;
  trimesters: { id: string; name: string; order: number }[];
}

interface CopyAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: CopyAssessmentSource | null;
  sourceGroupId: string;
  sourceTrimesterId: string;
  onCopied?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  EXAM: "Examen",
  NOTEBOOK: "Libreta",
  WORK: "Trabajo",
  RUBRIC_WORK: "Trabajo con rúbrica",
  OTHER: "Otro",
};

export function CopyAssessmentDialog({
  open,
  onOpenChange,
  assessment,
  sourceGroupId,
  sourceTrimesterId,
  onCopied,
}: CopyAssessmentDialogProps) {
  const [groups, setGroups] = useState<TargetGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState(sourceGroupId);
  const [targetTrimesterId, setTargetTrimesterId] = useState(sourceTrimesterId);
  const [name, setName] = useState(assessment?.name ?? "");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetGroupId(sourceGroupId);
      setTargetTrimesterId(sourceTrimesterId);
      setName(assessment?.name ?? "");
      setLoadingGroups(true);
      fetch("/api/groups")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: TargetGroup[]) => {
          const valid = (Array.isArray(data) ? data : []).filter(
            (g) => g.trimesters && g.trimesters.length > 0
          );
          setGroups(valid);
        })
        .catch(() => toast.error("No se pudieron cargar los grupos"))
        .finally(() => setLoadingGroups(false));
    }
  }, [open, sourceGroupId, sourceTrimesterId, assessment]);

  const targetGroup = useMemo(
    () => groups.find((g) => g.id === targetGroupId) ?? null,
    [groups, targetGroupId]
  );

  useEffect(() => {
    if (targetGroup && !targetGroup.trimesters.some((t) => t.id === targetTrimesterId)) {
      setTargetTrimesterId(targetGroup.trimesters[0].id);
    }
  }, [targetGroup, targetTrimesterId]);

  const isSameTrimester = targetTrimesterId === sourceTrimesterId;

  const handleCopy = async () => {
    if (!assessment || !targetTrimesterId) return;
    if (!name.trim()) {
      toast.error("Pon un nombre al elemento copiado");
      return;
    }
    setCopying(true);
    try {
      const res = await fetch("/api/assessments/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: assessment.id,
          targetTrimesterId,
          name: name.trim(),
        }),
      });
      if (res.ok) {
        const dest = targetGroup
          ? `${targetGroup.name} · ${targetGroup.trimesters.find((t) => t.id === targetTrimesterId)?.name ?? ""}`
          : "";
        toast.success(`Elemento copiado a ${dest}`);
        onOpenChange(false);
        onCopied?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al copiar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!copying) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar elemento de evaluación</DialogTitle>
          <DialogDescription>
            Copia la configuración de «{assessment?.name}» a otro grupo o trimestre. Las notas no se copian, solo la configuración.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {assessment && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground">{TYPE_LABELS[assessment.type] ?? assessment.type}</span>
                {" · "}vale {assessment.percentage}% · sobre {assessment.maxScore}
                {assessment.hasRubric ? " · incluye rúbrica" : ""}
              </p>
              {assessment.studentId && (
                <p>Es una evaluación personal: al copiarla a otro grupo pasará a ser general.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Grupo de destino</Label>
            <Select
              value={targetGroupId}
              onValueChange={(v) => setTargetGroupId(v)}
              disabled={loadingGroups || copying}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingGroups ? "Cargando grupos…" : "Elige grupo"} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    {g.id === sourceGroupId ? " (actual)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trimestre de destino</Label>
            <Select
              value={targetTrimesterId}
              onValueChange={(v) => setTargetTrimesterId(v)}
              disabled={!targetGroup || copying}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elige trimestre" />
              </SelectTrigger>
              <SelectContent>
                {(targetGroup?.trimesters ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.id === sourceTrimesterId ? " (actual)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre en el destino</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={copying}
              maxLength={80}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleCopy}
            disabled={copying || loadingGroups || !targetTrimesterId || isSameTrimester}
          >
            {copying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copiar elemento
          </Button>
          {isSameTrimester && (
            <p className="text-xs text-muted-foreground text-center">
              Para duplicar dentro del mismo trimestre usa «Duplicar evaluación».
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
