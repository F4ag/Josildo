// Monta as linhas de endereço da etiqueta de correspondência (Nome +
// Endereço completo, 15x5cm) — usado tanto na pré-visualização em tela
// (relatorios/etiquetas/page.tsx) quanto na geração do PDF
// (relatorios/etiquetas/pdf/route.tsx), a partir da mesma função.

export type MailingLabelPerson = {
  name: string
  address?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
}

export type MailingLabel = {
  name: string
  /** Linhas do endereço já formatadas e sem linhas vazias — pronto pra
   * renderizar uma por uma na etiqueta (tela ou PDF). */
  addressLines: string[]
}

export function buildMailingLabel(person: MailingLabelPerson): MailingLabel {
  const line1 = [person.address, person.complement].filter(Boolean).join(", ")
  const line2 = person.neighborhood ?? ""
  const cityState = [person.city, person.state].filter(Boolean).join(" - ")
  const line3 = [cityState, person.zip_code ? `CEP ${person.zip_code}` : ""].filter(Boolean).join(" · ")

  const addressLines = [line1, line2, line3].filter((line) => line.trim().length > 0)

  return { name: person.name, addressLines }
}
