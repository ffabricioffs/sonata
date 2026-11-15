import { z } from "zod"

/** "150", "150,00", "1.500,00" ou "150.50" → 150.5 (duas casas no máximo). */
export function lerValor(v: string | undefined): number | undefined {
  if (!v) return undefined
  const s = v.replace(/\s|R\$/g, "")
  const n = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s
  return /^\d+(\.\d{1,2})?$/.test(n) ? Number(n) : NaN
}

const valor = z
  .string({ required_error: "Informe o valor" })
  .transform((v) => lerValor(v))
  .refine((n) => n !== undefined && !Number.isNaN(n), "Valor inválido (ex.: 150,00)")
  .refine((n) => (n ?? 0) > 0, "O valor deve ser maior que zero")
  .refine((n) => (n ?? 0) <= 100000, "Valor acima do permitido")
  .transform((n) => n as number)

const competencia = {
  mes: z.coerce.number({ required_error: "Informe o mês" }).int().min(1, "Mês inválido").max(12, "Mês inválido"),
  ano: z.coerce.number({ required_error: "Informe o ano" }).int().min(2020, "Ano inválido").max(2100, "Ano inválido"),
}

export const mensalidadeSchema = z.object({
  alunoId: z.string({ required_error: "Selecione o aluno" }).min(1, "Selecione o aluno"),
  ...competencia,
  valor,
  vencimento: z.string({ required_error: "Informe o vencimento" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  observacao: z.string().max(200, "Máximo de 200 caracteres").optional(),
})

export const gerarMesSchema = z.object({
  ...competencia,
  valor,
  diaVencimento: z.coerce.number({ required_error: "Informe o dia do vencimento" }).int().min(1, "Dia entre 1 e 28").max(28, "Dia entre 1 e 28"),
})

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
export const competenciaLabel = (mes: number, ano: number) => `${String(mes).padStart(2, "0")}/${ano}`
export const fmtBRL = (v: number | { toString(): string }) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v.toString()))
