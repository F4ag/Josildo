"use client"

import { Printer } from "lucide-react"

/** Impressão via CSS print (Módulo 11) — .no-print já esconde Sidebar/Topbar. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Imprimir
    </button>
  )
}
