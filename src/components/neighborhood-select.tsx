"use client"

// Seletor de bairro sobre `neighborhoods` (cadastrados por organização) —
// usado nos cadastros de Liderança e Apoiador. Quando a organização já tem
// bairros cadastrados, escolher da lista é obrigatório (não texto livre): o
// texto salvo junto (input hidden ao lado do <select>) é o que a Edge
// Function notifica_dashboard_sync -> sync-lideramais usa pra casar contra os
// bairros do Dashboard (comparação sem acento/maiúsculas) — por isso precisa
// bater exatamente com neighborhoods.name, nunca digitado à mão. Sem nenhum
// bairro cadastrado ainda (a maioria das organizações, hoje), volta a ser
// texto livre — ver o bloco abaixo.
import { forwardRef, useImperativeHandle, useRef, useState } from "react"

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
  /** Texto livre já salvo (leaders.neighborhood / supporters.neighborhood) —
   * valor inicial do campo de texto usado como fallback quando a
   * organização ainda não tem nenhum bairro cadastrado em `neighborhoods`
   * (ver abaixo). Sem isso, editar um cadastro antigo (de antes deste
   * componente existir) mostraria o campo em branco mesmo com bairro salvo. */
  defaultText?: string | null
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
    { neighborhoods, defaultId, defaultText, idFieldName = "neighborhood_id", textFieldName = "neighborhood" },
    ref,
  ) {
    const [selectedId, setSelectedId] = useState(defaultId ?? "")
    const textFallbackRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      trySelectByName(name: string) {
        const target = normalize(name)
        const match = neighborhoods.find((n) => normalize(n.name) === target)
        if (match) {
          setSelectedId(match.id)
        } else if (textFallbackRef.current) {
          // Organização sem território cadastrado ainda: sem lista pra casar,
          // preenche o campo de texto livre normalmente (mesmo comportamento
          // de antes deste componente existir).
          textFallbackRef.current.value = name
        }
      },
    }))

    // Território ainda não cadastrado pra esta organização: sem lista pra
    // escolher, volta a ser texto livre (mesmo campo/nome de antes deste
    // componente existir) — sem isso, cadastrar liderança/apoiador ficaria
    // impossível pra qualquer organização que ainda não tenha bairros
    // cadastrados em `neighborhoods` (a maioria, hoje).
    if (neighborhoods.length === 0) {
      return (
        <div>
          <label htmlFor={textFieldName} className="mb-1 block text-sm font-medium">Bairro</label>
          <input
            id={textFieldName} name={textFieldName} ref={textFallbackRef}
            defaultValue={defaultText ?? undefined}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-foreground/50">
            Território ainda não cadastrado pra esta organização — texto livre por enquanto. Assim que o
            Admin Geral cadastrar os bairros, este campo vira uma lista pra escolher.
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
