/** Validações no servidor (Zod) e senhas: RF005, RF006, RF007/RN14, RF012–RF014, RF020, RF025, RNF004, RNF006. */
import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import { cpfSchema, alunoFormSchema } from "@/lib/validations/aluno"
import { professorFormSchema } from "@/lib/validations/professor"
import { salaFormSchema } from "@/lib/validations/sala"
import { turmaFormSchema } from "@/lib/validations/turma"
import { reservaFormSchema, solicitacaoFormSchema, LIMITE_PENDENTES } from "@/lib/validations/reserva"
import { ageFrom, todayStr } from "@/lib/dates"
import { hashPassword, verifyPassword, isLegacyHash } from "@/lib/password"
import { MSG_HORARIO_INVALIDO } from "@/lib/mensagens"

const hojeMenosAnos = (anos: number, dias = 0) => {
  const [y, m, d] = todayStr().split("-").map(Number)
  const dt = new Date(Date.UTC(y! - anos, m! - 1, d! + dias))
  return dt.toISOString().slice(0, 10)
}
const alunoBase = { nome: "Teste da Silva", email: "teste@exemplo.com" }

describe("CPF (RF005 / RF012)", () => {
  it("aceita com ou sem máscara e grava só os dígitos", () => {
    expect(cpfSchema.parse("529.982.247-25")).toBe("52998224725")
    expect(cpfSchema.parse("52998224725")).toBe("52998224725")
  })
  it("recusa CPF com quantidade errada de dígitos", () => {
    expect(cpfSchema.safeParse("123.456.789").success).toBe(false)
    expect(cpfSchema.safeParse("1234567890123").success).toBe(false)
  })
  it("recusa CPF com dígitos verificadores inválidos (111.111.111-11, 123.456.789-00)", () => {
    // Se o RF005 da monografia exigir validação dos dígitos verificadores, este teste deve passar.
    expect(cpfSchema.safeParse("111.111.111-11").success).toBe(false)
    expect(cpfSchema.safeParse("123.456.789-00").success).toBe(false)
  })
})

describe("Aluno: obrigatórios e responsável (RF006 / RF007)", () => {
  it("nome e e-mail são obrigatórios", () => {
    const r = alunoFormSchema.safeParse({})
    expect(r.success).toBe(false)
    const campos = r.success ? [] : r.error.issues.map((i) => i.path[0])
    expect(campos).toContain("nome")
    expect(campos).toContain("email")
  })
  it("e-mail inválido é recusado", () => {
    expect(alunoFormSchema.safeParse({ ...alunoBase, email: "naoeemail" }).success).toBe(false)
  })
  it("menor de idade sem responsável é recusado nos dois campos do responsável", () => {
    const r = alunoFormSchema.safeParse({ ...alunoBase, dataNasc: hojeMenosAnos(14) })
    expect(r.success).toBe(false)
    const campos = r.success ? [] : r.error.issues.map((i) => i.path[0])
    expect(campos).toContain("responsavelNome")
    expect(campos).toContain("responsavelTelefone")
  })
  it("menor de idade com responsável é aceito", () => {
    expect(alunoFormSchema.safeParse({ ...alunoBase, dataNasc: hojeMenosAnos(14), responsavelNome: "Maria", responsavelTelefone: "11999990000" }).success).toBe(true)
  })
  it("RN14 quem completa 18 anos hoje é maior: cadastro sem responsável aceito", () => {
    const nasc = hojeMenosAnos(18)
    expect(ageFrom(new Date(`${nasc}T00:00:00.000Z`))).toBe(18)
    expect(alunoFormSchema.safeParse({ ...alunoBase, dataNasc: nasc }).success).toBe(true)
  })
  it("quem completa 18 anos amanhã ainda é menor: exige responsável", () => {
    expect(alunoFormSchema.safeParse({ ...alunoBase, dataNasc: hojeMenosAnos(18, 1) }).success).toBe(false)
  })
  it("data de nascimento futura é recusada", () => {
    expect(alunoFormSchema.safeParse({ ...alunoBase, dataNasc: hojeMenosAnos(-1) }).success).toBe(false)
  })
})

describe("Professor (RF008 / RF013)", () => {
  const prof = { nome: "Ana Prof", cpf: "52998224725", email: "ana@exemplo.com", telefone: "11999990000", endereco: "Rua A, 10 - SP" }
  it("aceita sem registro profissional e sem minicurrículo", () => {
    expect(professorFormSchema.safeParse(prof).success).toBe(true)
  })
  it("CPF, telefone e endereço são obrigatórios", () => {
    const r = professorFormSchema.safeParse({ nome: "Ana Prof", email: "ana@exemplo.com" })
    const campos = r.success ? [] : r.error.issues.map((i) => i.path[0])
    expect(campos).toContain("cpf")
    expect(campos).toContain("telefone")
    expect(campos).toContain("endereco")
  })
})

describe("Sala (RF014 / RF018)", () => {
  it("manutenção exige data de término", () => {
    expect(salaFormSchema.safeParse({ nome: "Sala X", capacidade: "4", status: "MANUTENCAO" }).success).toBe(false)
    expect(salaFormSchema.safeParse({ nome: "Sala X", capacidade: "4", status: "MANUTENCAO", manutencaoAte: "2026-12-01" }).success).toBe(true)
  })
  it("capacidade precisa ser ao menos 1", () => {
    expect(salaFormSchema.safeParse({ nome: "Sala X", capacidade: "0" }).success).toBe(false)
  })
})

describe("Turma (RF020)", () => {
  const t = { nome: "Flauta Doce", instrumentoId: "i", professorId: "p", diaSemana: "QUARTA", horario: "10:00", duracaoMin: "60", vagas: "6" }
  it("turma válida é aceita", () => {
    expect(turmaFormSchema.safeParse(t).success).toBe(true)
  })
  it("CT37 duração 0 → “Informe uma duração e um número de vagas maiores que zero.”", () => {
    const r = turmaFormSchema.safeParse({ ...t, duracaoMin: "0" })
    expect(r.success).toBe(false)
    expect(r.success ? "" : r.error.issues[0]!.message).toBe("Informe uma duração e um número de vagas maiores que zero.")
  })
  it("vagas 0 → mesma mensagem", () => {
    const r = turmaFormSchema.safeParse({ ...t, vagas: "0" })
    expect(r.success ? "" : r.error.issues[0]!.message).toBe("Informe uma duração e um número de vagas maiores que zero.")
  })
  it("horário fora do formato HH:mm é recusado", () => {
    expect(turmaFormSchema.safeParse({ ...t, horario: "25:00" }).success).toBe(false)
  })
})

describe("Reserva e solicitação (RF025 / RF028 / RF031)", () => {
  const r = { salaId: "s", data: "2026-12-04", inicio: "16:00", fim: "15:00", tipo: "AULA" }
  it("CT50 término antes do início → “O horário de término deve ser posterior ao horário de início.”", () => {
    const p = reservaFormSchema.safeParse(r)
    expect(p.success).toBe(false)
    expect(p.success ? "" : p.error.issues[0]!.message).toBe(MSG_HORARIO_INVALIDO)
  })
  it("término igual ao início também é recusado", () => {
    expect(reservaFormSchema.safeParse({ ...r, fim: "16:00" }).success).toBe(false)
  })
  it("solicitação exige motivo com ao menos 5 caracteres", () => {
    expect(solicitacaoFormSchema.safeParse({ professorId: "p", tipo: "EXTRA", data: "2026-12-04", inicio: "15:00", motivo: "ok" }).success).toBe(false)
  })
  it("limite de pendentes definido no código (RF031)", () => {
    expect(LIMITE_PENDENTES).toBe(3)
  })
})

describe("Senhas (RNF004)", () => {
  it("hashPassword gera hash bcrypt ($2…) e verifyPassword confere", async () => {
    const h = await hashPassword("Segredo123")
    expect(h.startsWith("$2")).toBe(true)
    expect(h.includes("Segredo123")).toBe(false)
    expect(await verifyPassword("Segredo123", h)).toBe(true)
    expect(await verifyPassword("errada", h)).toBe(false)
  })
  it("hash legado SHA-256 é reconhecido (para migrar no 1º login)", async () => {
    const legado = createHash("sha256").update("123456").digest("hex")
    expect(isLegacyHash(legado)).toBe(true)
    expect(await verifyPassword("123456", legado)).toBe(true)
    expect(await verifyPassword("1234567", legado)).toBe(false)
  })
  it("texto puro na coluna de senha nunca é aceito", async () => {
    expect(await verifyPassword("123456", "123456")).toBe(false)
  })
})
