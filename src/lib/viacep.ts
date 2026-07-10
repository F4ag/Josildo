// Busca de endereço a partir do CEP via ViaCEP (viacep.com.br) — serviço
// gratuito dos próprios Correios/comunidade, sem chave de API, usado nos
// formulários de Liderança e Demanda para autopreencher rua/bairro/
// cidade/UF assim que a pessoa termina de digitar o CEP (evento onBlur).
// Roda no NAVEGADOR (não em Server Action) porque é só uma conveniência de
// preenchimento — o valor final que vai pro banco é o que estiver nos
// campos do formulário na hora do submit, então dá pra corrigir à mão se o
// ViaCEP acertar algo errado.
export type ViaCepAddress = {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export async function fetchAddressByZipCode(rawZipCode: string): Promise<ViaCepAddress | null> {
  const digits = rawZipCode.replace(/\D/g, "")
  if (digits.length !== 8) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null

    const data = await response.json()
    if (data.erro) return null

    return {
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      localidade: data.localidade ?? "",
      uf: data.uf ?? "",
    }
  } catch {
    // CEP não encontrado, rede fora do ar, etc. — quem está preenchendo o
    // formulário digita o endereço à mão, sem travar o cadastro.
    return null
  }
}
