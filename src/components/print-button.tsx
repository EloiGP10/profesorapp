"use client";

import { Printer } from "lucide-react";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
      }
    >
      <Printer className="mr-2 h-4 w-4" />
      Imprimir / Guardar PDF
    </button>
  );
}