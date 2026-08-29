"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CloudDownload, FileSpreadsheet, FileText, Loader2, Radio } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  hasAssessments: boolean;
}

export function ExportDialog({ open, onOpenChange, groupId, groupName, hasAssessments }: ExportDialogProps) {
  const router = useRouter();
  const [format, setFormat] = useState<string>("excel");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, format }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al exportar");
        return;
      }

      // Descargar el archivo
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `export_${groupName}`;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Exportación completada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {groupName}</DialogTitle>
        </DialogHeader>

        {!hasAssessments && (
          <p className="text-sm text-muted-foreground">
            Crea evaluaciones primero para poder exportar calificaciones.
          </p>
        )}

        <div className="space-y-2">
          {[
            { id: "excel", label: "Excel (.xlsx)", desc: "Hoja completa con notas y medias", icon: FileSpreadsheet },
            { id: "itaca-csv", label: "Itaca CSV", desc: "Delimitado por ; con BOM, listo para Itaca", icon: FileText },
            { id: "itaca-xml", label: "Itaca XML (Calima)", desc: "Formato XML para importar en Calima/EducamosCLM", icon: Radio },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFormat(opt.id)}
              className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                format === opt.id ? "border-primary bg-muted/50" : ""
              }`}
            >
              <opt.icon className="h-5 w-5 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <Button onClick={handleExport} className="w-full" disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CloudDownload className="mr-2 h-4 w-4" />
          )}
          Exportar
        </Button>
      </DialogContent>
    </Dialog>
  );
}