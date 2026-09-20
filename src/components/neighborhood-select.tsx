"use client"

// Seletor de bairro sobre `neighborhoods` (cadastrados por organização) —
// usado nos cadastros de Liderança e Apoiador. Diferente do campo de texto
// livre que existia antes, aqui é obrigatório escolher da lista: o texto
// exibido (guardado num input hidden ao lado do <select>) é o que a Edge
// Function notifica_dashboard_sync -> sync-lideramais usa pra casar contra os
// bairros do Dashboard (comparação sem acento/maiúsculas) — por isso o texto
// salvo tem que ser exatamente o nome cadastrado em neighborhoods.name, nunca
// digitado à mão.
import { forwardRef, useImperativeHandle, useState } from "react"

type NeighborhoodOption = { id: string; name: string }

export type NeighborhoodSelectHandle = {
  /** Usado pelo autopreenchimento de CEP (ViaCEP): tenta selecionar o bairro
   * cujo nome bate com o texto retornado, ignorando acento/maiúsculas — não
   * seleciona nada se não achar correspondência exata na lista. */
  trySelectByName: (name: string) => void
}

type NeighborhoodSelectProps = {
  neighborhoods: NeighborhoodOption[]
  defaultId?: string | null
  /** Nome do campo <select> com o id escolhido. */
  idFieldName?: string
  /** Nome do input hidden com o nome do bairro (texto), gravado ao lado do id. */
  textFieldName?: string
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

export const NeighborhoodSelect = forwardRef<NeighborhoodSelectHandle, NeighborhoodSelectProps>(
  function NeighborhoodSelect(
    { neighborhoods, defaultId, idFieldName = "neighborhood_id", textFieldName = "neighborhood" },
    ref,
  ) {
    const [selectedId, setSelectedId] = useState(defaultId ?? "")

    useImperativeHandle(ref, () => ({
      trySelectByName(name: string) {
        const target = normalize(name)
        const match = neighborhoods.find((n) => normalize(n.name) === target)
        if (match) setSelectedId(match.id)
      },
    }))

    if (neighborhoods.length === 0) {
      return (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Bairro</label>
          <p className="rounded-md border border-dashed border-black/15 bg-black/[0.02] px-3 py-2 text-xs text-foreground/60">
            Nenhum bairro cadastrado para esta organização ainda. Peça ao Admin Geral para cadastrar o
            território (bairros) antes de vincular este cadastro a um bairro específico.
          </p>
        </div>
      )
    }

    const selectedName = neighborhoods.find((n) => n.id === selectedId)?.name ?? ""

    return (
      <div>
        <label htmlFor={idFieldName} className="mb-1 block text-sm font-medium">Bairro</label>
        <select
          id={idFieldName}
          name={idFieldName}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">Selecione...</option>
          {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <input type="hidden" name={textFieldName} value={selectedName} />
      </div>
    )
  },
)
