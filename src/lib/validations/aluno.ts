import { z } from "zod"
import { senhaForte } from "./senha"
import { ageFrom } from "@/lib/dates"
import { mascaraTelefone } from "@/lib/mascaras"

const onlyDigits = (s: string) => s.replace(/\D/g, "")

/** Confere os dois dígitos verificadores do CPF e recusa sequências repetidas (111.111.111-11). */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const dv = (base: string) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = dv(cpf.slice(0, 9))
  const d2 = dv(cpf.slice(0, 9) + d1)
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10])
}

/** CPF: aceita com ou sem máscara, grava só os 11 dígitos e valida os dígitos verificadores (RF005/RF012). */
export const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 11, "CPF inválido (11 dígitos)")
  .refine((v) => v.length !== 11 || cpfValido(v), "CPF inválido")

/** Telefone: DDD + 8 ou 9 dígitos, gravado sempre no formato (11) 90000-0000. */
export const telefoneSchema = z
  .string()
  .refine((v) => [10, 11].includes(onlyDigits(v).length), "Telefone inválido: informe DDD e número")
  .transform(mascaraTelefone)

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")

export const alunoFormSchema = z
  .object({
    nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
    email: z.string().email("E-mail inválido").transform((v) => v.toLowerCase()),
    telefone: telefoneSchema.optional(),
    dataNasc: dataISO.optional(),
    cpf: cpfSchema.optional(),
    responsavelNome: z.string().optional(),
    responsavelTelefone: telefoneSchema.optional(),
    observacoes: z.string().max(500, "Máximo de 500 caracteres").optional(),
    senha: senhaForte.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.dataNasc) {
      const d = new Date(`${v.dataNasc}T00:00:00.000Z`)
      if (d > new Date()) ctx.addIssue({ code: "custom", path: ["dataNasc"], message: "A data não pode ser futura" })
      else if (ageFrom(d) < 18) {
        if (!v.responsavelNome?.trim()) ctx.addIssue({ code: "custom", path: ["responsavelNome"], message: "Informe o responsável (aluno menor de 18 anos)" })
        if (!v.responsavelTelefone?.trim()) ctx.addIssue({ code: "custom", path: ["responsavelTelefone"], message: "Informe o telefone do responsável (aluno menor de 18 anos)" })
      }
    }
  })

export type AlunoFormInput = z.infer<typeof alunoFormSchema>

// Compatibilidade com o código anterior
export const createAlunoSchema = alunoFormSchema
export type CreateAlunoInput = AlunoFormInput
export const updateAlunoSchema = alunoFormSchema
export type UpdateAlunoInput = AlunoFormInput
