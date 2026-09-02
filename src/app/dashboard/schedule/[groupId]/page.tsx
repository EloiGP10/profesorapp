"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Clock,
  BookOpen,
  Loader2,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface ScheduleSlot {
  id: string;
  day: number;
  startMinute: number;
  endMinute: number;
  subject: string;
  classroom?: string | null;
  teacher?: string | null;
  color?: string | null;
  note?: string | null;
  order: number;
}

interface Schedule {
  id: string;
  name: string;
  slots: ScheduleSlot[];
}

const DAYS = [
  { n: 1, label: "Lunes" },
  { n: 2, label: "Martes" },
  { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" },
  { n: 5, label: "Viernes" },
  { n: 6, label: "Sábado" },
  { n: 7, label: "Domingo" },
];

const COLORS = [
  { label: "Azul", value: "#3b82f6" },
  { label: "Verde", value: "#22c55e" },
  { label: "Rojo", value: "#ef4444" },
  { label: "Amarillo", value: "#eab308" },
  { label: "Morado", value: "#a855f7" },
  { label: "Naranja", value: "#f97316" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Cian", value: "#06b6d4" },
  { label: "Gris", value: "#6b7280" },
  { label: "Negro", value: "#1f2937" },
];

function parseColor(c: string | null | undefined): string {
  if (!c) return "#3b82f6";
  try {
    const [r, g, b] = c.split(",").map(Number);
    if (r !== undefined && g !== undefined && b !== undefined) {
      return `rgb(${r},${g},${b})`;
    }
    if (c.startsWith("#")) return c;
    return c;
  } catch {
    return "#3b82f6";
  }
}

function minuteToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinute(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getSlotsByDay(slots: ScheduleSlot[], day: number) {
  return slots.filter((s) => s.day === day).sort((a, b) => a.startMinute - b.startMinute);
}

function SlotCard({
  slot,
  onEdit,
  onDelete,
}: {
  slot: ScheduleSlot;
  onEdit: (s: ScheduleSlot) => void;
  onDelete: (id: string) => void;
}) {
  const bg = parseColor(slot.color);
  const r = parseInt(bg.match(/\d+/g)?.[0] ?? "59");
  const g = parseInt(bg.match(/\d+/g)?.[1] ?? "130");
  const b = parseInt(bg.match(/\d+/g)?.[2] ?? "246");
  const isDark = r * 0.299 + g * 0.587 + b * 0.114 < 128;
  const textColor = isDark ? "text-white" : "text-black";
  const timeColor = isDark ? "text-white/75" : "text-black/60";

  return (
    <div
      className="relative rounded-lg p-2.5 mb-2 border shadow-sm group"
      style={{ backgroundColor: bg }}
    >
      <div className={`text-xs font-bold ${textColor}`}>{slot.subject}</div>
      <div className={`text-[11px] ${timeColor} flex items-center gap-1 mt-0.5`}>
        <Clock className="h-2.5 w-2.5" />
        {minuteToTime(slot.startMinute)} – {minuteToTime(slot.endMinute)}
      </div>
      {slot.classroom && (
        <div className={`text-[11px] ${timeColor} flex items-center gap-1`}>
          <MapPin className="h-2.5 w-2.5" />
          {slot.classroom}
        </div>
      )}
      {slot.teacher && (
        <div className={`text-[11px] ${timeColor} mt-0.5`}>{slot.teacher}</div>
      )}
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(slot)}
          className="p-1 rounded bg-black/20 hover:bg-black/40"
          title="Editar"
        >
          <Pencil className="h-3 w-3 text-white" />
        </button>
        <button
          onClick={() => onDelete(slot.id)}
          className="p-1 rounded bg-black/20 hover:bg-black/40"
          title="Eliminar"
        >
          <Trash2 className="h-3 w-3 text-white" />
        </button>
      </div>
    </div>
  );
}

function SlotForm({
  groupId,
  slot,
  onSave,
  onCancel,
}: {
  groupId: string;
  slot?: ScheduleSlot | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const editing = Boolean(slot);

  const [day, setDay] = useState(String(slot?.day ?? 1));
  const [startTime, setStartTime] = useState(slot ? minuteToTime(slot.startMinute) : "09:00");
  const [endTime, setEndTime] = useState(slot ? minuteToTime(slot.endMinute) : "10:00");
  const [subject, setSubject] = useState(slot?.subject ?? "");
  const [classroom, setClassroom] = useState(slot?.classroom ?? "");
  const [teacher, setTeacher] = useState(slot?.teacher ?? "");
  const [color, setColor] = useState(slot?.color ?? COLORS[0].value);
  const [note, setNote] = useState(slot?.note ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error("La asignatura es obligatoria");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        groupId,
        slot: {
          day: Number(day),
          startMinute: timeToMinute(startTime),
          endMinute: timeToMinute(endTime),
          subject: subject.trim(),
          classroom: classroom.trim() || null,
          teacher: teacher.trim() || null,
          color: color,
          note: note.trim() || null,
        },
      };

      const res = editing
        ? await fetch("/api/schedules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload.slot, slotId: slot!.id, groupId }),
          })
        : await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(editing ? "Slot actualizado" : "Slot añadido");
        onSave();
      } else {
        const d = await res.json();
        toast.error(d.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {editing ? "Editar hora" : "Añadir hora"}
            </CardTitle>
            <button onClick={onCancel} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Día</Label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DAYS.map((d) => (
                    <option key={d.n} value={d.n}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Asignatura *</Label>
              <Input
                placeholder="Ej: Matemáticas"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Aula</Label>
                <Input
                  placeholder="Ej: 101"
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Profesor</Label>
                <Input
                  placeholder="Ej: García"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      color === c.value ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input
                placeholder="Ej: Solo 1º ESO A"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editing ? "Guardar" : "Añadir"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null | undefined>(undefined);
  const [visibleDays, setVisibleDays] = useState([1, 2, 3, 4, 5]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedules?groupId=${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch {
      toast.error("Error al cargar el horario");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
    const name = sessionStorage.getItem("groupName");
    if (name) setGroupName(name);
  }, [load]);

  const handleDelete = async (slotId: string) => {
    if (!confirm("¿Eliminar esta hora?")) return;
    try {
      const res = await fetch(`/api/schedules?slotId=${slotId}&groupId=${groupId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Hora eliminada");
        load();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const openEdit = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setShowForm(true);
  };

  const openNew = () => {
    setEditingSlot(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSlot(undefined);
  };

  const onSaved = () => {
    closeForm();
    load();
  };

  const toggleDay = (day: number) => {
    setVisibleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/group/${groupId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {schedule?.name ?? "Horario"}
                {groupName && <span className="text-sm font-normal text-muted-foreground">— {groupName}</span>}
              </h1>
            </div>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Añadir hora
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {DAYS.filter((d) => d.n <= 7).map((d) => (
                <button
                  key={d.n}
                  onClick={() => toggleDay(d.n)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    visibleDays.includes(d.n)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-transparent"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0,1fr))` }}>
              {visibleDays.map((dayNum) => {
                const dayInfo = DAYS.find((d) => d.n === dayNum)!;
                const daySlots = schedule ? getSlotsByDay(schedule.slots, dayNum) : [];

                return (
                  <Card key={dayNum}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold text-center">{dayInfo.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      {daySlots.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                          Sin horas
                        </div>
                      ) : (
                        daySlots.map((slot) => (
                          <SlotCard
                            key={slot.id}
                            slot={slot}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                          />
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      {showForm && (
        <SlotForm
          groupId={groupId}
          slot={editingSlot}
          onSave={onSaved}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}
