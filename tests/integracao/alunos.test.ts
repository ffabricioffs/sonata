/** Alunos: CT09–CT19, NF06, NF09 (Quadros A.3 a A.5). */
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { salvarAluno, excluirAluno } from "@/app/(dashboard)/alunos/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, alunoPorNome } from "../support/helpers"

// Atualizado em 15/11/2026 para as regras corrigidas depois de 09/11 (R05 CPF com dígito verificador, R02, D03 senha forte, reposição com aula perdida, R09, D05).
const adulto = { nome: "Carlos Teste", email: "carlos.teste@exemplo.com", telefone: "(11) 91234-0000", dataNasc: "2000-04-10", cpf: "987.654.321-00" }
const camposDe = (a: { nome: string; email: string; telefone: string | null; dataNasc: Date | null; cpf: string | null; responsavelNome?: string | null; responsavelTelefone?: string | null }) => ({
  nome: a.nome, email: a.email, telefone: a.telefone ?? undefined, dataNasc: a.dataNasc?.toISOString().slice(0, 10), cpf: a.cpf ?? undefined,
  responsavelNome: a.responsavelNome ?? undefined, responsavelTelefone: a.responsavelTelefone ?? undefined,
})

describe("Cadastro de aluno (RF001, RF005, RF006, RF007 · Quadro A.3)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT09 cadastrar aluno maior de idade → “Aluno cadastrado com sucesso.” e aluno na lista", async () => {
    const r = await executar(() => salvarAluno(null, {}, form(adulto)))
    expect(r.ok).toBe("Aluno cadastrado com sucesso.")
    expect(r.redirect?.startsWith("/alunos")).toBe(true)
    const a = tabela("aluno").find((x) => x.email === adulto.email)
    expect(a?.cpf).toBe("98765432100")
    expect(a?.ativo).toBe(true)
  })
  it("CT09b com senha inicial, cria também o login do aluno (perfil ALUNO, senha com hash)", async () => {
    await executar(() => salvarAluno(null, {}, form({ ...adulto, senha: "Abc12345" })))
    const u = tabela("usuario").find((x) => x.email === adulto.email)
    expect(u?.role).toBe("ALUNO")
    expect(u?.senhaHash.startsWith("$2")).toBe(true)
  })
  it("CT10 CPF já cadastrado (12345670320, Pedro) → “CPF já vinculado a um aluno existente.”", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ ...adulto, cpf: "123.456.703-20" })))
    expect(mensagem(r)).toBe("CPF já vinculado a um aluno existente.")
    expect(tabela("aluno").some((x) => x.email === adulto.email)).toBe(false)
  })
  it("CT11 nome e e-mail em branco → campos destacados e “Preencha todos os campos obrigatórios.”", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ nome: "", email: "", telefone: "11999990000" })))
    expect(r.estado?.fieldErrors?.nome).toBeDefined()
    expect(r.estado?.fieldErrors?.email).toBeDefined()
    expect(mensagem(r)).toBe("Preencha todos os campos obrigatórios.")
  })
  it("CT11b mensagens de campo em português (não “Required”)", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ telefone: "11999990000" })))
    expect(r.estado?.fieldErrors?.nome).not.toBe("Required")
    expect(r.estado?.fieldErrors?.email).not.toBe("Required")
  })
  it("CT12 menor (2012) sem responsável → cadastro bloqueado, campos do responsável exigidos", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ ...adulto, dataNasc: "2012-06-01" })))
    expect(r.redirect).toBeUndefined()
    expect(r.estado?.fieldErrors?.responsavelNome).toBeDefined()
    expect(r.estado?.fieldErrors?.responsavelTelefone).toBeDefined()
    expect(tabela("aluno").some((x) => x.email === adulto.email)).toBe(false)
  })
  it("CT13 menor com responsável → cadastro concluído com o responsável salvo", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ ...adulto, dataNasc: "2012-06-01", responsavelNome: "Rita Teste", responsavelTelefone: "(11) 97777-0000" })))
    expect(r.ok).toBe("Aluno cadastrado com sucesso.")
    const a = tabela("aluno").find((x) => x.email === adulto.email)
    expect(a?.responsavelNome).toBe("Rita Teste")
    expect(a?.responsavelTelefone).toBe("(11) 97777-0000")
  })
  it("e-mail já usado por outro login → mensagem clara", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ ...adulto, email: "admin@exemplo.com", senha: "Abc12345" })))
    expect(mensagem(r)).toBe("Este e-mail já está em uso.")
  })
  it("NF06 envio direto à action com e-mail inválido e campos vazios → erro de validação, nada gravado", async () => {
    const antes = tabela("aluno").length
    const r = await executar(() => salvarAluno(null, {}, form({ nome: "", email: "nao-e-email", cpf: "12" })))
    expect(r.estado?.error).toBeDefined()
    expect(r.estado?.fieldErrors?.email).toBe("E-mail inválido")
    expect(r.estado?.fieldErrors?.cpf).toBe("CPF inválido (11 dígitos)")
    expect(tabela("aluno").length).toBe(antes)
  })
})

describe("Edição e consulta de aluno (RF002, RF004 · Quadro A.4)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT14 alterar telefone de Sofia Martins → “Dados do aluno atualizados com sucesso.”", async () => {
    const sofia = alunoPorNome("Sofia Martins")
    const r = await executar(() => salvarAluno(sofia.id, {}, form({ ...camposDe(sofia), telefone: "(11) 95555-1234" })))
    expect(r.ok).toBe("Dados do aluno atualizados com sucesso.")
    expect(alunoPorNome("Sofia Martins").telefone).toBe("(11) 95555-1234")
  })
  it("CT15 trocar o CPF de Sofia pelo do Lucas (12345670169) → mensagem do CT10 e nada salvo", async () => {
    const sofia = alunoPorNome("Sofia Martins")
    const r = await executar(() => salvarAluno(sofia.id, {}, form({ ...camposDe(sofia), cpf: "12345670169", telefone: "(11) 90000-0000" })))
    expect(mensagem(r)).toBe("CPF já vinculado a um aluno existente.")
    expect(alunoPorNome("Sofia Martins").cpf).toBe("12345670673")
    expect(alunoPorNome("Sofia Martins").telefone).toBe("(11) 90000-1006")
  })
  it("editar e-mail de aluno com login atualiza também o login", async () => {
    const pedro = alunoPorNome("Pedro Almeida")
    await executar(() => salvarAluno(pedro.id, {}, form({ ...camposDe(pedro), email: "pedro.novo@exemplo.com" })))
    expect(tabela("usuario").some((u) => u.email === "pedro.novo@exemplo.com" && u.role === "ALUNO")).toBe(true)
  })
  it("CT16 buscar “Lima” na lista (mesma consulta da página /alunos) → Gabriel Lima", async () => {
    const q = "Lima"
    const lista = await prisma.aluno.findMany({ where: { ativo: true, OR: [{ nome: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } })
    expect(lista.map((a) => a.nome)).toEqual(["Gabriel Lima"])
  })
})

describe("Exclusão de aluno (RF003 · Quadro A.5)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT17 excluir aluno sem vínculos → “Aluno excluído com sucesso.”", async () => {
    await executar(() => salvarAluno(null, {}, form({ ...adulto, senha: "Abc12345" })))
    const novo = tabela("aluno").find((x) => x.email === adulto.email)
    const r = await executar(() => excluirAluno(novo.id))
    expect(r.ok).toBe("Aluno excluído com sucesso.")
    expect(tabela("aluno").some((x) => x.id === novo.id)).toBe(false)
    expect(tabela("usuario").some((u) => u.email === adulto.email)).toBe(false)
  })
  it("CT18 excluir Lucas Ferreira (com matrícula) → mensagem de vínculos ativos", async () => {
    const lucas = alunoPorNome("Lucas Ferreira")
    const r = await executar(() => excluirAluno(lucas.id))
    expect(mensagem(r)).toBe("Não é possível excluir o aluno. Existem vínculos ativos associados a este registro.")
    expect(alunoPorNome("Lucas Ferreira")).toBeDefined()
  })
  it("aluno com solicitação pendente também não pode ser excluído", async () => {
    const pedro = alunoPorNome("Pedro Almeida")
    await prisma.matricula.updateMany({ where: { alunoId: pedro.id }, data: { ativo: false } })
    const r = await executar(() => excluirAluno(pedro.id))
    expect(mensagem(r)).toBe("Não é possível excluir o aluno. Existem vínculos ativos associados a este registro.")
  })
  it("secretaria pode excluir; professor não", async () => {
    await executar(() => salvarAluno(null, {}, form(adulto)))
    const novo = tabela("aluno").find((x) => x.email === adulto.email)
    entrarComo("mariana.costa@exemplo.com")
    expect(mensagem(await executar(() => excluirAluno(novo.id)))).toBe("Você não tem permissão para esta ação.")
    entrarComo("secretaria@exemplo.com")
    expect((await executar(() => excluirAluno(novo.id))).ok).toBe("Aluno excluído com sucesso.")
  })
})
