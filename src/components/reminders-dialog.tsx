"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Trash2, Mail } from "lucide-react";

interface Reminder {
  id: string;
  title: string;
  message: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

interface RemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
}

export function RemindersDialog({ open, onOpenChange, groupId }: RemindersDialogProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scope, setScope] = useState<string>(groupId ? "group" : "all");
  const [sendEmail, setSendEmail] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open) loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, groupId]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const qs = scope === "group" && groupId ? `?groupId=${groupId}` : "";
      const res = await fetch(`/api/reminders${qs}`);
      if (res.ok) setReminders(await res.json());
    } catch {
      toast.error("Error al cargar recordatorios");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    if (sendEmail && !email.trim()) {
      toast.error("Introduce un email para enviar el recordatorio");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: scope === "group" && groupId ? groupId : null,
          title,
          message: message || null,
          dueDate: dueDate || null,
          sendEmail,
          email: sendEmail ? email : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.emailSent ? "Recordatorio creado y email enviado" : "Recordatorio creado");
        setTitle(""); setMessage(""); setDueDate(""); setSendEmail(false);
        loadReminders();
      } else {
        toast.error("Error al crear el recordatorio");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: Reminder) => {
    try {
      await fetch("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, completed: !r.completed }),
      });
      setReminders((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, completed: !x.completed } : x))
      );
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setReminders((prev) => prev.filter((x) => x.id !== id));
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recordatorios</DialogTitle>
        </DialogHeader>

        {groupId && (
          <div className="flex items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Ámbito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">Este grupo</SelectItem>
                <SelectItem value="all">Todos mis grupos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reminder-title">Título</Label>
          <Input
            id="reminder-title"
            placeholder="ej: Corregir exámenes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Label htmlFor="reminder-message">Mensaje</Label>
          <Textarea
            id="reminder-message"
            placeholder="Detalles..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="reminder-date">Fecha</Label>
              <Input
                id="reminder-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(v) => setSendEmail(v === true)}
              />
              <Label htmlFor="send-email" className="flex items-center gap-1.5 cursor-pointer">
                <Mail className="h-4 w-4" /> Enviar por email
              </Label>
            </div>
            {sendEmail && (
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </div>

          <Button
            onClick={handleAdd}
            disabled={saving || !title.trim()}
            className="w-full"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Añadir recordatorio
          </Button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : reminders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Sin recordatorios
            </p>
          ) : (
            reminders.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3 ${r.completed ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Checkbox
                      checked={r.completed}
                      onCheckedChange={() => handleToggle(r)}
                    />
                    <span className={`text-sm font-medium ${r.completed ? "line-through" : ""}`}>
                      {r.title}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {r.message && (
                  <p className="text-xs text-muted-foreground mt-1 ml-6">{r.message}</p>
                )}
                {r.dueDate && (
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    📅 {new Date(r.dueDate).toLocaleDateString("es-ES")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
