/** Turmas, matrículas e aulas: CT36–CT47 (Quadros A.12 e A.13). */
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { salvarTurma } from "@/app/(dashboard)/turmas/actions"
import { matricularAluno, desmatricularAluno, alternarAluno } from "@/app/(dashboard)/alunos/actions"
import * as acoesAgenda from "@/app/(dashboard)/agenda/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, alunoPorNome, salaPorNome, turmaPorNome, professorPorNome, instrumentoPorNome, REF } from "../support/helpers"

const MSG_CONFLITO = "Conflito de horário: o professor ou a sala não está disponível no período selecionado."
const turmaFlauta = () => ({
  nome: "Flauta Doce - Quarta", instrumentoId: instrumentoPorNome("Flauta").id, professorId: professorPorNome("Rafael Mendes").id,
  salaId: salaPorNome("Sala 2").id, diaSemana: "QUARTA", horario: "10:00", duracaoMin: 60, vagas: 6,
})
const ocupadas = (turmaId: string) => tabela("matricula").filter((m) => m.turmaId === turmaId && m.ativo).length

describe("Cadastro de turma (RF020 / RF024 / RF018 · Quadro A.12)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT36 Flauta, Rafael Mendes, Sala 2, quarta 10:00, 60 min, 6 vagas → “Turma cadastrada com sucesso.”", async () => {
    const r = await executar(() => salvarTurma(null, {}, form(turmaFlauta())))
    expect(r.ok).toBe("Turma cadastrada com sucesso.")
    const t = turmaPorNome("Flauta Doce - Quarta")
    expect([t.diaSemana, t.horario, t.duracaoMin, t.vagas, t.ativo]).toEqual(["QUARTA", "10:00", 60, 6, true])
  })
  it("CT37 duração 0 → “Informe uma duração e um número de vagas maiores que zero.”", async () => {
    const r = await executar(() => salvarTurma(null, {}, form({ ...turmaFlauta(), duracaoMin: 0 })))
    expect(r.redirect).toBeUndefined()
    expect(r.estado?.fieldErrors?.duracaoMin).toBe("Informe uma duração e um número de vagas maiores que zero.")
  })
  it("CT38 Mariana na segunda 09:30, Sala 2 (ela já dá aula 09:00–10:00) → conflito", async () => {
    const r = await executar(() => salvarTurma(null, {}, form({ ...turmaFlauta(), nome: "Teoria Musical", professorId: professorPorNome("Mariana Costa").id, diaSemana: "SEGUNDA", horario: "09:30" })))
    expect(mensagem(r)).toBe(MSG_CONFLITO)
  })
  it("CT39 Camila na segunda 09:00, Sala 1 (sala da turma de piano) → mesma mensagem", async () => {
    const r = await executar(() => salvarTurma(null, {}, form({ ...turmaFlauta(), nome: "Canto Infantil", professorId: professorPorNome("Camila Oliveira").id, salaId: salaPorNome("Sala 1").id, diaSemana: "SEGUNDA", horario: "09:00" })))
    expect(mensagem(r)).toBe(MSG_CONFLITO)
  })
  it("CT40 turma na Sala 4 dentro da manutenção → cadastro bloqueado", async () => {
    const r = await executar(() => salvarTurma(null, {}, form({ ...turmaFlauta(), salaId: salaPorNome("Sala 4").id })))
    expect(r.redirect).toBeUndefined()
    expect(r.estado?.fieldErrors?.salaId).toBe("Sala em manutenção")
    expect(turmaPorNome("Flauta Doce - Quarta")).toBeUndefined()
  })
  it("editar a própria turma no mesmo horário não acusa conflito com ela mesma", async () => {
    const t = turmaPorNome("Piano Iniciante - Manhã")
    const r = await executar(() => salvarTurma(t.id, {}, form({ nome: t.nome, instrumentoId: t.instrumentoId, professorId: t.professorId, salaId: t.salaId, diaSemana: t.diaSemana, horario: t.horario, duracaoMin: t.duracaoMin, vagas: t.vagas })))
    expect(r.ok).toBe("Dados da turma atualizados com sucesso.")
  })
  it("vagas não podem ficar abaixo do número de matriculados", async () => {
    const t = turmaPorNome("Piano Iniciante - Manhã") // 3 alunos
    const r = await executar(() => salvarTurma(t.id, {}, form({ nome: t.nome, instrumentoId: t.instrumentoId, professorId: t.professorId, salaId: t.salaId, diaSemana: t.diaSemana, horario: t.horario, duracaoMin: t.duracaoMin, vagas: 2 })))
    expect(r.estado?.fieldErrors?.vagas).toBe("Mínimo 3")
  })
  it("número de vagas não pode passar da capacidade da sala (RF014: capacidade máxima)", async () => {
    // Sala 3 tem capacidade 3
    const r = await executar(() => salvarTurma(null, {}, form({ ...turmaFlauta(), salaId: salaPorNome("Sala 3").id, vagas: 10 })))
    expect(r.redirect).toBeUndefined()
  })
})

describe("Matrícula (RF021 / RF024 · Quadro A.13)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT41 Isabela Rocha em “Violão Intermediário” → “Aluno matriculado com sucesso.” e uma vaga a menos", async () => {
    const t = turmaPorNome("Violão Intermediário")
    const antes = ocupadas(t.id)
    const r = await executar(() => matricularAluno(alunoPorNome("Isabela Rocha").id, t.id))
    expect(mensagem(r)).toBe("Aluno matriculado com sucesso.")
    expect(ocupadas(t.id)).toBe(antes + 1)
  })
  it("CT42 repetir o CT41 → “O aluno já está matriculado nesta turma.”", async () => {
    const t = turmaPorNome("Violão Intermediário")
    await executar(() => matricularAluno(alunoPorNome("Isabela Rocha").id, t.id))
    const r = await executar(() => matricularAluno(alunoPorNome("Isabela Rocha").id, t.id))
    expect(mensagem(r)).toBe("O aluno já está matriculado nesta turma.")
  })
  it("CT43 lotar a turma do CT36 (6 vagas) e tentar mais um → “Não há vagas disponíveis nesta turma.”", async () => {
    await executar(() => salvarTurma(null, {}, form(turmaFlauta())))
    const t = turmaPorNome("Flauta Doce - Quarta")
    const alunos = tabela("aluno").slice(0, 7)
    for (const a of alunos.slice(0, 6)) expect(mensagem(await executar(() => matricularAluno(a.id, t.id)))).toBe("Aluno matriculado com sucesso.")
    expect(mensagem(await executar(() => matricularAluno(alunos[6]!.id, t.id)))).toBe("Não há vagas disponíveis nesta turma.")
    expect(ocupadas(t.id)).toBe(6)
  })
  it("CT44 aluno da segunda 09:00 entrando numa turma da segunda 09:30 → conflito do aluno", async () => {
    await executar(() => salvarTurma(null, {}, form({ ...turmaFlauta(), nome: "Canto Matinal", professorId: professorPorNome("Camila Oliveira").id, diaSemana: "SEGUNDA", horario: "09:30" })))
    const nova = turmaPorNome("Canto Matinal")
    expect(nova).toBeDefined()
    const r = await executar(() => matricularAluno(alunoPorNome("Lucas Ferreira").id, nova.id))
    expect(mensagem(r)).toBe("Conflito de horário: o aluno já está matriculado em outra turma neste horário.")
  })
  it("desmatricular e matricular de novo reativa a matrícula (sem duplicar)", async () => {
    const lucas = alunoPorNome("Lucas Ferreira").id
    const t = turmaPorNome("Piano Iniciante - Manhã").id
    await executar(() => desmatricularAluno(lucas, t))
    expect(ocupadas(t)).toBe(2)
    expect(mensagem(await executar(() => matricularAluno(lucas, t)))).toBe("Aluno matriculado com sucesso.")
    expect(tabela("matricula").filter((m) => m.alunoId === lucas && m.turmaId === t)).toHaveLength(1)
  })
  it("aluno inativo não pode ser matriculado; inativar encerra as matrículas", async () => {
    const lucas = alunoPorNome("Lucas Ferreira").id
    await alternarAluno(lucas)
    expect(tabela("matricula").filter((m) => m.alunoId === lucas && m.ativo)).toHaveLength(0)
    expect(mensagem(await executar(() => matricularAluno(lucas, turmaPorNome("Violão Intermediário").id)))).toBe("O aluno está inativo.")
  })
  it("professor não pode matricular", async () => {
    entrarComo("mariana.costa@exemplo.com")
    expect(mensagem(await executar(() => matricularAluno(alunoPorNome("Isabela Rocha").id, turmaPorNome("Violão Intermediário").id)))).toBe("Você não tem permissão para esta ação.")
  })
})

describe("Aulas realizadas (RF023)", () => {
  beforeEach(prepararBanco)
  const aulaPiano = () => `aula_seed_turma_001_${REF().replace(/-/g, "")}`

  it("CT46 Mariana marca a aula de segunda como realizada", async () => {
    entrarComo("mariana.costa@exemplo.com")
    const r = await executar(() => acoesAgenda.alternarRealizada(aulaPiano()))
    expect(r.estado?.ok).toBe(true)
    expect(tabela("aula").find((a) => a.id === aulaPiano())?.realizada).toBe(true)
  })
  it("CT46 a observação da aula pode ser registrada junto (RF023)", async () => {
    entrarComo("mariana.costa@exemplo.com")
    const nomes = Object.keys(acoesAgenda)
    // hoje só existem: criarAula, gerarSemana, alternarRealizada(aulaId), excluirAula — nenhuma recebe observação
    expect(nomes.some((n) => /observ|registrar/i.test(n)) || acoesAgenda.alternarRealizada.length > 1).toBe(true)
  })
  it("outro professor não marca aula que não é dele", async () => {
    entrarComo("rafael.mendes@exemplo.com")
    const r = await executar(() => acoesAgenda.alternarRealizada(aulaPiano()))
    expect(mensagem(r)).toBe("Você só pode atualizar aulas das suas turmas.")
  })
  it("aluno não marca aula", async () => {
    entrarComo("lucas.ferreira@exemplo.com")
    expect(mensagem(await executar(() => acoesAgenda.alternarRealizada(aulaPiano())))).toBe("Você não tem permissão para esta ação.")
  })
})

describe("Secretaria (CT47)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("secretaria@exemplo.com")
  })
  it("CT47 secretaria repete CT36 e CT41 com o mesmo resultado do administrador", async () => {
    expect((await executar(() => salvarTurma(null, {}, form(turmaFlauta())))).ok).toBe("Turma cadastrada com sucesso.")
    expect(mensagem(await executar(() => matricularAluno(alunoPorNome("Isabela Rocha").id, turmaPorNome("Violão Intermediário").id)))).toBe("Aluno matriculado com sucesso.")
  })
  it("gerar aulas da semana não duplica aulas já existentes", async () => {
    const antes = tabela("aula").length
    await acoesAgenda.gerarSemana(REF())
    expect(tabela("aula").length).toBe(antes)
    const prox = await prisma.aula.count()
    expect(prox).toBe(antes)
  })
})
