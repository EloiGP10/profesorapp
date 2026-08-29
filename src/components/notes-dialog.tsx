"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface StudentNote {
  id: string;
  content: string;
  createdAt: string;
}

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  studentName: string;
}

export function NotesDialog({ open, onOpenChange, studentId, studentName }: NotesDialogProps) {
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && studentId) loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notes?studentId=${studentId}`);
      if (res.ok) setNotes(await res.json());
    } catch {
      toast.error("Error al cargar las notas");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, content }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes((prev) => [note, ...prev]);
        setContent("");
      } else {
        toast.error("Error al guardar la nota");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error("Error al eliminar la nota");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notas de {studentName}</DialogTitle>
          <DialogDescription>
            Registra observaciones sobre el alumno
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Escribe una nota..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            <Button
              onClick={handleAdd}
              className="w-full"
              disabled={saving || !content.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Añadir nota
            </Button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sin notas todavía
              </p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="rounded-lg border p-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(note.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}