"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

const MAX_LENGTH = 3000;

export function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setSending(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      toast.error("El nombre y el mensaje son obligatorios");
      return;
    }
    if (message.length > MAX_LENGTH) {
      toast.error(`El mensaje no puede superar ${MAX_LENGTH} caracteres`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `website` es un campo trampa para bots: vacío para una persona real.
        body: JSON.stringify({ name, email, subject, message, website: "" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || "No se pudo enviar el mensaje");
        return;
      }

      toast.success("Mensaje enviado. Te responderemos lo antes posible.");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Error de conexión. Inténtalo de nuevo.");
      setSending(false);
    }
  };

  const remaining = MAX_LENGTH - message.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contactar
          </DialogTitle>
          <DialogDescription>
            ¿Has encontrado un fallo o echas algo en falta? Cuéntanoslo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Nombre</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email (opcional)</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                placeholder="para poder responderte"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-subject">Asunto (opcional)</Label>
            <Input
              id="contact-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder="Ej: Error al exportar a PDF"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-message">Mensaje</Label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={5}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder="Cuéntanos qué has hecho y qué ha pasado."
            />
            <p className="text-right text-xs text-muted-foreground">{remaining} caracteres restantes</p>
          </div>

          <div aria-hidden className="hidden">
            <label htmlFor="contact-website">No rellenes este campo</label>
            <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" readOnly />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={sending}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}