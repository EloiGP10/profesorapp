"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Student {
  id: string;
  listNumber: number;
  name: string;
  surname1: string;
  surname2: string | null;
  nia: string | null;
  email: string | null;
  phone: string | null;
}

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  student?: Student | null;
  nextListNumber?: number;
  onSaved?: () => void;
}

export function StudentDialog({
  open,
  onOpenChange,
  groupId,
  student,
  nextListNumber,
  onSaved,
}: StudentDialogProps) {
  const [saving, setSaving] = useState(false);

  const [listNumber, setListNumber] = useState(student?.listNumber ?? nextListNumber ?? 1);
  const [name, setName] = useState(student?.name ?? "");
  const [surname1, setSurname1] = useState(student?.surname1 ?? "");
  const [surname2, setSurname2] = useState(student?.surname2 ?? "");
  const [nia, setNia] = useState(student?.nia ?? "");
  const [email, setEmail] = useState(student?.email ?? "");
  const [phone, setPhone] = useState(student?.phone ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !surname1.trim()) {
      toast.error("El nombre y el primer apellido son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/students", {
        method: student ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(student ? { id: student.id } : { groupId }),
          listNumber: Number(listNumber) || 1,
          name: name.trim(),
          surname1: surname1.trim(),
          surname2: surname2.trim() || null,
          nia: nia.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success(student ? "Alumno actualizado" : "Alumno añadido");
        onOpenChange(false);
        onSaved?.();
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
          <DialogTitle>{student ? "Editar alumno" : "Añadir alumno"}</DialogTitle>
          <DialogDescription>
            {student ? "Actualiza los datos del alumno" : "Registra un nuevo alumno en el grupo"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="listNumber">Nº Lista</Label>
              <Input
                id="listNumber"
                type="number"
                min={1}
                value={listNumber}
                onChange={(e) => setListNumber(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="nia">NIA (opcional)</Label>
              <Input
                id="nia"
                placeholder="Número de identificación"
                value={nia}
                onChange={(e) => setNia(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="surname1">Primer apellido <span className="text-destructive">*</span></Label>
              <Input
                id="surname1"
                value={surname1}
                onChange={(e) => setSurname1(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname2">Segundo apellido</Label>
              <Input
                id="surname2"
                value={surname2}
                onChange={(e) => setSurname2(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {student ? "Guardar cambios" : "Añadir alumno"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}