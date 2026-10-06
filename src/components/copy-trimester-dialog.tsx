"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

interface TrimesterOption {
  id: string;
  name: string;
  assessmentsCount: number;
}

interface GroupOption {
  id: string;
  name: string;
}

interface CopyTrimesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceGroupId: string;
  sourceGroupName: string;
  trimesters: TrimesterOption[];
  defaultTrimesterId: string;
  onCopied?: () => void;
}

export function CopyTrimesterDialog({
  open,
  onOpenChange,
  sourceGroupId,
  sourceGroupName,
  trimesters,
  defaultTrimesterId,
  onCopied,
}: CopyTrimesterDialogProps) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sourceTrimesterId, setSourceTrimesterId] = useState(defaultTrimesterId);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (open) {
      setSourceTrimesterId(defaultTrimesterId);
      setTargetGroupId("");
      setLoadingGroups(true);
      fetch("/api/groups")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: GroupOption[]) => {
          setGroups(Array.isArray(data) ? data : []);
        })
        .catch(() => toast.error("No se pudieron cargar los grupos"))
        .finally(() => setLoadingGroups(false));
    }
  }, [open, defaultTrimesterId]);

  const sourceTrimester = trimesters.find((t) => t.id === sourceTrimesterId) ?? null;
  const targetGroup = groups.find((g) => g.id === targetGroupId) ?? null;

  const handleCopy = async () => {
    if (!sourceTrimesterId || !targetGroupId) return;
    setCopying(true);
    try {
      const res = await fetch("/api/trimesters/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTrimesterId, targetGroupId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Trimestre copiado a ${targetGroup?.name ?? ""}: ${data.copied} ${data.copied === 1 ? "elemento" : "elementos"}` +
            (data.skippedPersonal > 0 ? ` (${data.skippedPersonal} personales omitidos)` : "")
        );
        onOpenChange(false);
        onCopied?.();
      } else {
        toast.error(data.error || "Error al copiar el trimestre");
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
          <DialogTitle>Copiar trimestre entero</DialogTitle>
          <DialogDescription>
            Copia todas las evaluaciones de un trimestre (con sus rúbricas y configuración) a otro grupo.
            Las notas no se copian y las evaluaciones personales de alumnos se omiten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trimestre de {sourceGroupName}</Label>
            <Select value={sourceTrimesterId} onValueChange={setSourceTrimesterId} disabled={copying}>
              <SelectTrigger>
                <SelectValue placeholder="Elige trimestre" />
              </SelectTrigger>
              <SelectContent>
                {trimesters.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.assessmentsCount} {t.assessmentsCount === 1 ? "elemento" : "elementos"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Grupo de destino</Label>
            <Select value={targetGroupId} onValueChange={setTargetGroupId} disabled={loadingGroups || copying}>
              <SelectTrigger>
                <SelectValue placeholder={loadingGroups ? "Cargando grupos…" : "Elige grupo"} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    {g.id === sourceGroupId ? " (actual: se añadirá como trimestre nuevo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={handleCopy}
            disabled={copying || loadingGroups || !sourceTrimesterId || !targetGroupId}
          >
            {copying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copiar {sourceTrimester ? `${sourceTrimester.assessmentsCount} elementos` : "trimestre"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
