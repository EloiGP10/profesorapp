"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileUp, Loader2, Table2, Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
}

interface RowData {
  listNumber: number | null;
  name: string;
  surname1: string;
  surname2: string;
  nia: string;
  email: string;
  phone: string;
}

const FIELD_LABELS: Record<string, string> = {
  listNumber: "Nº lista",
  name: "Nombre",
  surname1: "Apellido 1",
  surname2: "Apellido 2",
  nia: "NIA",
  email: "Email",
  phone: "Teléfono",
};

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  for (const h of headers) {
    const nh = normalize(h);
    // Number
    if (!mapping.listNumber && (nh === "n" || nh === "no" || nh === "num" || nh === "numero" || nh === "n lista" || nh === "no lista" || nh === "numero lista" || nh === "ordre" || nh === "orden" || nh === "#")) {
      mapping.listNumber = h;
    }
    // Name
    else if (!mapping.name && (nh === "nombre" || nh === "nom" || nh === "first name" || nh === "firstname" || nh === "nombre alumno" || nh === "nombre de pila")) {
      mapping.name = h;
    }
    // Surname 1
    else if (!mapping.surname1 && (nh === "apellido 1" || nh === "primer apellido" || nh === "apellido1" || nh === "primer_apellido" || nh === "apellidos" || nh === "cognom 1" || nh === "primer cognom" || nh === "cognoms" || nh === "surname" || nh === "last name" || nh === "lastname")) {
      mapping.surname1 = h;
    }
    // Surname 2
    else if (!mapping.surname2 && (nh === "apellido 2" || nh === "segundo apellido" || nh === "apellido2" || nh === "segundo_apellido" || nh === "segon cognom" || nh === "cognom 2")) {
      mapping.surname2 = h;
    }
    // NIA / DNI
    else if (!mapping.nia && (nh === "nia" || nh === "dni" || nh === "nif" || nh === "id" || nh === "codigo" || nh === "identificador" || nh === "matricula")) {
      mapping.nia = h;
    }
    // Email
    else if (!mapping.email && (nh === "email" || nh === "correo" || nh === "e-mail" || nh === "correo electronico" || nh === "mail")) {
      mapping.email = h;
    }
    // Phone
    else if (!mapping.phone && (nh === "telefono" || nh === "movil" || nh === "tel" || nh === "phone" || nh === "celular")) {
      mapping.phone = h;
    }
  }

  // Fallbacks if not matched exactly
  if (!mapping.name) {
    const found = headers.find((h) => normalize(h).includes("nom"));
    if (found && found !== mapping.surname1 && found !== mapping.surname2) mapping.name = found;
  }
  if (!mapping.surname1) {
    const found = headers.find((h) => normalize(h).includes("apell") || normalize(h).includes("cognom"));
    if (found && found !== mapping.name && found !== mapping.surname2) mapping.surname1 = found;
  }

  return mapping;
}

export function ImportDialog({ open, onOpenChange, groupId }: ImportDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [autoMatchedCount, setAutoMatchedCount] = useState(0);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (matrix.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }
        const headerRow = hasHeaderRow ? matrix[0] : matrix.map((_, i) => `Columna ${i + 1}`);
        const cleanHeaders = headerRow.map((h) => String(h).trim() || `Columna ${headerRow.indexOf(h) + 1}`);
        setHeaders(cleanHeaders);
        const dataRows = hasHeaderRow ? matrix.slice(1) : matrix;
        setParsedRows(
          dataRows.map((row) => {
            const obj: Record<string, string> = {};
            cleanHeaders.forEach((h, i) => {
              const key = String(h).trim() || `col${i}`;
              obj[key] = String(row[i] ?? "").trim();
            });
            return obj;
          })
        );

        // Auto-detect column mapping
        const detected = autoDetectMapping(cleanHeaders);
        setMapping(detected);
        const matched = Object.keys(detected).length;
        setAutoMatchedCount(matched);
        if (matched > 0) {
          toast.success(`Mapeo automático: ${matched} columnas detectadas`);
        }

        setStep(2);
      } catch {
        toast.error("Error al leer el archivo. Asegúrate de que sea un .xlsx válido");
      }
    };
    reader.readAsBinaryString(file);
  };

  const mappingDone = useMemo(() => {
    const m = Object.values(mapping);
    return m.includes("name") && m.includes("surname1");
  }, [mapping]);

  const previewRows = useMemo(() => {
    if (!mappingDone) return [];
    return parsedRows.filter((row) => {
      const nameKey = Object.keys(mapping).find((k) => mapping[k] === "name")!;
      const surnameKey = Object.keys(mapping).find((k) => mapping[k] === "surname1")!;
      return String(row[nameKey] || "").trim() && String(row[surnameKey] || "").trim();
    });
  }, [mappingDone, parsedRows, mapping]);

  const handleImport = async () => {
    if (!mappingDone) return;
    setImporting(true);
    try {
      const students: RowData[] = previewRows.map((row) => {
        const get = (field: string) =>
          Object.keys(mapping).find((k) => mapping[k] === field)
            ? row[Object.keys(mapping).find((k) => mapping[k] === field)!] ?? ""
            : "";
        return {
          listNumber: get("listNumber") ? Number(get("listNumber")) || null : null,
          name: get("name"),
          surname1: get("surname1"),
          surname2: get("surname2"),
          nia: get("nia"),
          email: get("email"),
          phone: get("phone"),
        };
      });

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, students, replace: replaceExisting }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Importados ${data.created} alumnos${data.skipped ? ` (${data.skipped} duplicados)` : ""}`);
        onOpenChange(false);
        setStep(1);
        setMapping({});
        setFileName("");
        setReplaceExisting(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al importar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setMapping({});
    setFileName("");
    setHeaders([]);
    setParsedRows([]);
    setHasHeaderRow(true);
    setReplaceExisting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!importing) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar alumnos</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Sube un archivo Excel (.xlsx) con la lista de alumnos"
              : "Elige qué columna corresponde a cada campo"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-header"
                checked={hasHeaderRow}
                onCheckedChange={(v) => setHasHeaderRow(Boolean(v))}
              />
              <Label htmlFor="has-header" className="text-sm">
                La primera fila contiene los encabezados
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {fileName || "Seleccionar archivo .xlsx"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se importarán los alumnos con nombre y primer apellido. El campo Nº de lista se auto-completará si falta.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                Archivo: {fileName} · {parsedRows.length} filas
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Cambiar archivo
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              {(["listNumber", "name", "surname1", "surname2", "nia", "email", "phone"] as const).map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Label className="w-28 shrink-0 text-sm">
                    {FIELD_LABELS[field]}{field === "name" || field === "surname1" ? " *" : ""}
                  </Label>
                  <Select
                    value={mapping[field] ?? "none"}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [field]: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="No importar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No importar</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {mappingDone && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">
                    Vista previa ({previewRows.length} alumnos válidos)
                  </p>
                  <div className="rounded-lg border overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-2 py-1">Nombre</th>
                          <th className="text-left px-2 py-1">Apellido 1</th>
                          <th className="text-left px-2 py-1">Apellido 2</th>
                          {mapping.nia && <th className="text-left px-2 py-1">NIA</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">
                              {row[Object.keys(mapping).find((k) => mapping[k] === "name")!] ?? ""}
                            </td>
                            <td className="px-2 py-1">
                              {row[Object.keys(mapping).find((k) => mapping[k] === "surname1")!] ?? ""}
                            </td>
                            <td className="px-2 py-1">
                              {mapping.surname2 ? row[Object.keys(mapping).find((k) => mapping[k] === "surname2")!] ?? "" : ""}
                            </td>
                            {mapping.nia && (
                              <td className="px-2 py-1">
                                {row[Object.keys(mapping).find((k) => mapping[k] === "nia")!] ?? ""}
                              </td>
                            )}
                          </tr>
                        ))}
                        {previewRows.length > 5 && (
                          <tr className="border-t">
                            <td colSpan={4} className="px-2 py-1 text-muted-foreground">
                              … y {previewRows.length - 5} más
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="replace-existing"
                    checked={replaceExisting}
                    onCheckedChange={(v) => setReplaceExisting(Boolean(v))}
                  />
                  <Label htmlFor="replace-existing" className="text-sm">
                    Reemplazar alumnos existentes (borra la lista actual)
                  </Label>
                </div>

                <Button className="w-full" onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 h-4 w-4" />
                  )}
                  Importar {previewRows.length} alumnos
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}