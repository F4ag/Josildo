"use client"

// Autocomplete de "local de votação" — busca em polling_locations (dado
// aberto do TSE já importado) por nome/bairro/município e guarda o id
// selecionado num input hidden, pro Server Action ler do FormData como
// qualquer outro campo do formulário. Usado nos cadastros de liderança e
// apoiador (leader-form.tsx / supporter-form.tsx).
//
// Diferente do autopreenchimento de CEP (lib/viacep.ts), que só sobrescreve
// outros campos, aqui o próprio campo de texto é "não confiável" até o
// usuário escolher uma opção da lista: qualquer edição manual depois de
// selecionar invalida a seleção (limpa o id), pra nunca salvar um id que não
// corresponde mais ao texto exibido.
import { useEffect, useRef, useState } from "react"
import { searchPollingLocationsAction, type PollingLocationSuggestion } from "@/lib/actions/polling-locations"

type PollingLocationAutocompleteProps = {
  /** Nome do campo hidden com o id selecionado — é o que a Server Action lê do FormData. */
  name: string
  label?: string
  defaultId?: string | null
  /** Texto a exibir inicialmente (ex.: "Escola Municipal X — Bairro, Cidade"),
   * calculado pela página que renderiza o form a partir do polling_location_id
   * já salvo (ver services/polling-locations.ts#formatPollingLocationLabel). */
  defaultLabel?: string | null
  placeholder?: string
}

function formatSuggestion(loc: PollingLocationSuggestion): string {
  const local = [loc.bairro, loc.municipio_nome].filter(Boolean).join(", ")
  return local ? `${loc.nome} — ${local}` : loc.nome
}

export function PollingLocationAutocomplete({
  name,
  label = "Local de votação",
  defaultId,
  defaultLabel,
  placeholder = "Digite o nome do local, bairro ou cidade...",
}: PollingLocationAutocompleteProps) {
  const [query, setQuery] = useState(defaultLabel ?? "")
  const [selectedId, setSelectedId] = useState(defaultId ?? "")
  const [results, setResults] = useState<PollingLocationSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    // Qualquer edição manual invalida a seleção anterior — evita salvar um
    // id que não corresponde mais ao texto exibido no campo.
    setSelectedId("")

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      try {
        const found = await searchPollingLocationsAction(value)
        // Descarta respostas antigas que chegaram fora de ordem (digitação rápida).
        if (requestId !== requestIdRef.current) return
        setResults(found)
        setOpen(true)
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    }, 300)
  }

  function handleSelect(loc: PollingLocationSuggestion) {
    setSelectedId(loc.id)
    setQuery(formatSuggestion(loc))
    setResults([])
    setOpen(false)
  }

  function handleClear() {
    setSelectedId("")
    setQuery("")
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative sm:col-span-2">
      <label htmlFor={`${name}_search`} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={`${name}_search`}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-md border border-black/10 px-3 py-2 pr-8 text-sm focus:border-primary focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar local de votação"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70"
          >
            ×
          </button>
        )}
      </div>
      <input type="hidden" name={name} value={selectedId} />
      <p className="mt-1 text-xs text-foreground/50">
        {selectedId
          ? "Local selecionado — usado no relatório de expectativa x eleitorado por local."
          : "Busque pelo nome da escola/local, bairro ou cidade (mínimo 3 letras)."}
      </p>

      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-black/10 bg-white shadow-lg">
          {results.map((loc) => (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => handleSelect(loc)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5"
              >
                <span className="font-medium text-foreground">{loc.nome}</span>
                <br />
                <span className="text-xs text-foreground/50">
                  {[loc.bairro, loc.municipio_nome].filter(Boolean).join(", ")}
                  {loc.eleitores_total != null ? ` · ${loc.eleitores_total} eleitores` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim().length >= 3 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-black/10 bg-white p-3 text-xs text-foreground/50 shadow-lg">
          Nenhum local encontrado.
        </div>
      )}
    </div>
  )
}
