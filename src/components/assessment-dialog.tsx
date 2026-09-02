"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker, parseColorString, colorToString, type ColumnColor } from "@/components/color-picker";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ASSESSMENT_TYPES = [
  { id: "EXAM", label: "Examen" },
  { id: "NOTEBOOK", label: "Libreta" },
  { id: "WORK", label: "Trabajo" },
  { id: "RUBRIC_WORK", label: "Trabajo con rúbrica" },
  { id: "OTHER", label: "Otro" },
];

interface Assessment {
  id: string;
  name: string;
  type: string;
  percentage: number;
  maxScore: number;
  isExtra: boolean;
  columnColor?: string | null;
}

interface AssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trimesterId: string;
  assessment?: Assessment | null;
  existingAssessments?: Array<{ id: string; name: string; type: string }>;
  onCreated?: (assessment: Assessment) => void;
  onSaved?: () => void;
}

export function AssessmentDialog({
  open,
  onOpenChange,
  trimesterId,
  assessment,
  existingAssessments = [],
  onCreated,
  onSaved,
}: AssessmentDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("EXAM");
  const [percentage, setPercentage] = useState(10);
  const [maxScore, setMaxScore] = useState(10);
  const [isExtra, setIsExtra] = useState(false);
  const [color, setColor] = useState<ColumnColor | null>(null);

  const getSuggestedName = useCallback(
    (selectedType: string) => {
      const typeLabel = ASSESSMENT_TYPES.find((t) => t.id === selectedType)?.label || "Evaluación";
      const count = existingAssessments.filter((a) => a.type === selectedType).length;
      if (selectedType === "EXAM" || selectedType === "WORK" || selectedType === "RUBRIC_WORK") {
        return `${typeLabel} ${count + 1}`;
      }
      return typeLabel;
    },
    [existingAssessments]
  );

  useEffect(() => {
    if (open && assessment) {
      setName(assessment.name);
      setType(assessment.type);
      setPercentage(assessment.percentage);
      setMaxScore(assessment.maxScore);
      setIsExtra(assessment.isExtra);
      setColor(parseColorString(assessment.columnColor));
    } else if (open) {
      setType("EXAM");
      setName(getSuggestedName("EXAM"));
      setPercentage(10);
      setMaxScore(10);
      setIsExtra(false);
      setColor(null);
    }
  }, [open, assessment, getSuggestedName]);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    // Si el nombre actual está vacío o coincide con una sugerencia automática previa
    const currentIsDefault =
      !name.trim() ||
      ASSESSMENT_TYPES.some((t) => name.startsWith(t.label));
    if (currentIsDefault && !assessment) {
      setName(getSuggestedName(newType));
    }
  };

  const handleDefaultName = () => {
    if (name.trim()) return;
    setName(getSuggestedName(type));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/assessments", {
        method: assessment ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(assessment ? { id: assessment.id } : { trimesterId }),
          name: name.trim(),
          type,
          percentage: Number(percentage) || 0,
          maxScore: Number(maxScore) || 10,
          isExtra,
          columnColor: colorToString(color),
        }),
      });
      if (res.ok) {
        toast.success(assessment ? "Evaluación actualizada" : "Evaluación creada");
        onOpenChange(false);
        onSaved?.();
        // Trabajo con rúbrica: abrir el editor automáticamente tras crearlo
        if (!assessment && type === "RUBRIC_WORK" && onCreated) {
          const data = await res.json();
          onCreated({
            id: data.id,
            name: data.name,
            type: data.type,
            percentage: data.percentage,
            maxScore: data.maxScore,
            isExtra: data.isExtra,
            columnColor: data.columnColor,
          });
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{assessment ? "Editar evaluación" : "Nueva evaluación"}</DialogTitle>
          <DialogDescription>
            {assessment ? "Actualiza los datos de esta evaluación" : "Añade una evaluación al trimestre"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assessment-name">Nombre</Label>
            <Input
              id="assessment-name"
              placeholder="ej: Examen 1, Trabajo 1..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleDefaultName}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de evaluación" />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="assessment-percentage">% del trimestre</Label>
              <Input
                id="assessment-percentage"
                type="number"
                min={0}
                value={percentage}
                onChange={(e) => setPercentage(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-max">Nota máxima</Label>
              <Input
                id="assessment-max"
                type="number"
                min={1}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
              />
            </div>
          </div>

          {type === "RUBRIC_WORK" && (
            <p className="text-sm text-muted-foreground">
              Al crear la evaluación se abrirá el editor de rúbricas para que
              configures los criterios y niveles.
            </p>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="assessment-extra"
              checked={isExtra}
              onCheckedChange={(v) => setIsExtra(Boolean(v))}
            />
            <Label htmlFor="assessment-extra" className="text-sm">
              Trabajo voluntario (no baja la media)
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Color de columna</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {assessment ? "Guardar cambios" : "Crear evaluación"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}