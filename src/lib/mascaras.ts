/** Máscaras de exibição e digitação (puras: servem no servidor e no navegador). */

const digitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "")

/** 52998224725 → 529.982.247-25 (formata o que já foi digitado, até 11 dígitos). */
export function mascaraCpf(v: string | null | undefined): string {
  const d = digitos(v).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** 11900001234 → (11) 90000-1234; 1133334444 → (11) 3333-4444. */
export function mascaraTelefone(v: string | null | undefined): string {
  const d = digitos(v).slice(0, 11)
  if (d.length === 0) return ""
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  // 9 dígitos (celular) → 5+4; 8 dígitos (fixo) → 4+4
  const corte = resto.length > 8 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

export const MASCARAS = { cpf: mascaraCpf, telefone: mascaraTelefone } as const
export type TipoMascara = keyof typeof MASCARAS
