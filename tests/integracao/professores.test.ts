/** Professores: CT20–CT26 (Quadros A.6 a A.8). */
import { describe, it, expect, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { salvarProfessor, excluirProfessor } from "@/app/(dashboard)/professores/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, professorPorNome, usuarioPorEmail } from "../support/helpers"

const novo = { nome: "Helena Duarte", email: "helena.duarte@exemplo.com", cpf: "123.456.789-09", telefone: "(11) 97000-0000", endereco: "Rua das Flores, 10 - São Paulo/SP", senha: "Abc12345" }

describe("Professores (RF008–RF013)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT20 cadastrar professor sem registro profissional e minicurrículo → “Professor cadastrado com sucesso.”", async () => {
    const r = await executar(() => salvarProfessor(null, {}, form(novo)))
    expect(r.ok).toBe("Professor cadastrado com sucesso.")
    const u = usuarioPorEmail(novo.email)
    expect(u?.role).toBe("PROFESSOR")
    const p = tabela("professor").find((x) => x.usuarioId === u?.id)
    expect(p?.cpf).toBe("12345678909")
    expect(p?.endereco).toBe(novo.endereco)
    expect(p?.registroProfissional).toBeNull()
  })
  it("CT21 CPF já cadastrado (Mariana) → “CPF já vinculado a um professor existente.”", async () => {
    const r = await executar(() => salvarProfessor(null, {}, form({ ...novo, cpf: "529.982.247-25" })))
    expect(mensagem(r)).toBe("CPF já vinculado a um professor existente.")
    expect(usuarioPorEmail(novo.email)).toBeUndefined()
  })
  it("CT21b falha no cadastro não deixa login órfão (usuário sem professor)", async () => {
    await executar(() => salvarProfessor(null, {}, form({ ...novo, cpf: "529.982.247-25" })))
    expect(tabela("usuario").filter((u) => u.role === "PROFESSOR" && !tabela("professor").some((p) => p.usuarioId === u.id))).toHaveLength(0)
  })
  it("CT22 sem nome e telefone → campos destacados e “Preencha todos os campos obrigatórios.”", async () => {
    const r = await executar(() => salvarProfessor(null, {}, form({ ...novo, nome: "", telefone: "" })))
    expect(r.estado?.fieldErrors?.nome).toBeDefined()
    expect(r.estado?.fieldErrors?.telefone).toBeDefined()
    expect(mensagem(r)).toBe("Preencha todos os campos obrigatórios.")
  })
  it("CT23 alterar minicurrículo de Camila Oliveira → “Dados do professor atualizados com sucesso.”", async () => {
    const camila = professorPorNome("Camila Oliveira")
    const u = tabela("usuario").find((x) => x.id === camila.usuarioId)
    const r = await executar(() => salvarProfessor(camila.id, {}, form({ nome: u.nome, email: u.email, cpf: camila.cpf, telefone: camila.telefone, endereco: camila.endereco, bio: "Cantora lírica, 15 anos de experiência." })))
    expect(r.ok).toBe("Dados do professor atualizados com sucesso.")
    expect(professorPorNome("Camila Oliveira").bio).toBe("Cantora lírica, 15 anos de experiência.")
  })
  it("CT24 a lista de professores tem campo de busca (buscar “Mendes”)", () => {
    // A página /professores lista todos, mas não tem filtro; a página /alunos usa name="q".
    expect(readFileSync("src/app/(dashboard)/professores/page.tsx", "utf8").includes('name="q"')).toBe(true)
  })
  it("CT25 excluir Mariana Costa (com turmas) → mensagem de vínculos ativos", async () => {
    const r = await executar(() => excluirProfessor(professorPorNome("Mariana Costa").id))
    expect(mensagem(r)).toBe("Não é possível excluir o professor. Existem vínculos ativos associados a este registro.")
    expect(professorPorNome("Mariana Costa")).toBeDefined()
  })
  it("CT26 excluir o professor do CT20 → “Professor excluído com sucesso.” (login removido)", async () => {
    await executar(() => salvarProfessor(null, {}, form(novo)))
    const u = usuarioPorEmail(novo.email)
    const p = tabela("professor").find((x) => x.usuarioId === u.id)
    const r = await executar(() => excluirProfessor(p.id))
    expect(r.ok).toBe("Professor excluído com sucesso.")
    expect(usuarioPorEmail(novo.email)).toBeUndefined()
  })
  it("cadastro sem senha inicial é recusado", async () => {
    const r = await executar(() => salvarProfessor(null, {}, form({ ...novo, senha: undefined })))
    expect(r.estado?.fieldErrors?.senha).toBeDefined()
  })
})
