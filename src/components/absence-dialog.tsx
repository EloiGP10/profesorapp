"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2, CalendarDays, Clock, AlertTriangle } from "lucide-react";

interface Absence {
  id: string;
  date: string;
  type: string;
  notes: string | null;
  trimesterId: string | null;
}

interface AbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  currentTrimesterId?: string;
  trimesters?: Array<{ id: string; name: string }>;
  absences?: Absence[];
  onSaved?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  ABSENT: "Falta de asistencia",
  LATE: "Retraso",
  NEGATIVE: "Parte negativo",
};

const TYPE_COLORS: Record<string, string> = {
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  LATE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  NEGATIVE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function AbsenceDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  currentTrimesterId,
  trimesters = [],
  absences = [],
  onSaved,
}: AbsenceDialogProps) {
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [type, setType] = useState("ABSENT");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [trimesterId, setTrimesterId] = useState(currentTrimesterId ?? "");

  useEffect(() => {
    if (open) {
      setTrimesterId(currentTrimesterId ?? "");
      setType("ABSENT");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [open, currentTrimesterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type,
          date: date || new Date().toISOString(),
          notes: notes || null,
          trimesterId: trimesterId || null,
        }),
      });
      if (res.ok) {
        toast.success("Falta registrada");
        onSaved?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al registrar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch("/api/absences", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Falta eliminada");
        onSaved?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Faltas — {studentName}</DialogTitle>
          <DialogDescription>
            Registra y gestiona faltas, retrasos y amonestaciones
          </DialogDescription>
        </DialogHeader>

        {absences.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Faltas registradas ({absences.length})
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded border bg-muted/30 p-2">
              {absences.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`text-xs shrink-0 ${TYPE_COLORS[a.type] ?? "bg-gray-100 text-gray-800"}`}>
                      {TYPE_LABELS[a.type] ?? a.type}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {new Date(a.date).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {a.trimesterId && trimesters.length > 0 && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="truncate">
                            {trimesters.find((t) => t.id === a.trimesterId)?.name ?? ""}
                          </span>
                        </>
                      )}
                    </div>
                    {a.notes && (
                      <div className="flex items-center gap-0.5 text-xs text-muted-foreground/70">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate italic max-w-[80px]">{a.notes}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    title="Eliminar falta"
                  >
                    {deletingId === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {absences.length === 0 && (
          <div className="flex items-center gap-2 rounded border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            No hay faltas registradas
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Registrar nueva falta</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            {trimesters.length > 0 && (
              <div className="space-y-1">
                <Label>Trimestre</Label>
                <Select value={trimesterId} onValueChange={setTrimesterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar trimestre" />
                  </SelectTrigger>
                  <SelectContent>
                    {trimesters.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABSENT">Falta de asistencia</SelectItem>
                  <SelectItem value="LATE">Retraso</SelectItem>
                  <SelectItem value="NEGATIVE">Parte negativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="absence-date">Fecha</Label>
              <Input
                id="absence-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="absence-notes">Notas</Label>
              <Textarea
                id="absence-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar falta
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
