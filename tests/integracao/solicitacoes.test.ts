/** Solicitações de aulas extras: CT55–CT62, RN12, RN13 (Quadros A.17 e A.18). */
import { describe, it, expect, beforeEach } from "vitest"
import { todayStr, nowMinutes } from "@/lib/dates"
import { conflita, ocupacoesDoDia } from "@/lib/conflitos"
import { solicitarAula, aprovarSolicitacao, rejeitarSolicitacao } from "@/app/(dashboard)/solicitacoes/actions"
import { criarReserva } from "@/app/(dashboard)/reservas/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, salaPorNome, professorPorNome, usuarioPorEmail, proximo, alunoPorNome } from "../support/helpers"

const MSG_ENVIADA = "Solicitação enviada com sucesso. Aguarde a aprovação do professor."
const pedido = (extra: Record<string, string | number> = {}) => ({
  professorId: professorPorNome("Rafael Mendes").id, tipo: "REPOSICAO", data: proximo("SEXTA"), inicio: "17:00", duracaoMin: 60,
  motivo: "Faltei na última aula por doença", ...extra,
})
const pendentesDoPedro = () => tabela("solicitacaoAula").filter((s) => s.alunoId === alunoPorNome("Pedro Almeida").id && s.status === "PENDENTE")

describe("Solicitação (RF028, RF029, RF031–RF033 · Quadro A.17)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("pedro.almeida@exemplo.com")
  })

  it("CT55 Pedro pede reposição com Rafael → mensagem de envio e status Pendente", async () => {
    const antes = pendentesDoPedro().length
    const r = await executar(() => solicitarAula({}, form(pedido())))
    expect(r.ok).toBe(MSG_ENVIADA)
    expect(pendentesDoPedro().length).toBe(antes + 1)
    expect(tabela("solicitacaoAula").at(-1)?.status).toBe("PENDENTE")
  })
  it("CT56 Rafael e a administração recebem a notificação", async () => {
    await executar(() => solicitarAula({}, form(pedido())))
    const para = (email: string) => tabela("notificacao").filter((n) => n.usuarioId === usuarioPorEmail(email).id && /Nova solicitação de reposição de Pedro Almeida/.test(n.mensagem))
    expect(para("rafael.mendes@exemplo.com")).toHaveLength(1)
    expect(para("admin@exemplo.com")).toHaveLength(1)
    expect(para("secretaria@exemplo.com")).toHaveLength(1)
    expect(para("mariana.costa@exemplo.com")).toHaveLength(0)
  })
  it("CT58 / RN12 ao passar do limite de pendentes (3) → “Você atingiu o limite de solicitações pendentes…”", async () => {
    // Pedro já tem 1 pendente no seed
    expect(pendentesDoPedro()).toHaveLength(1)
    expect((await executar(() => solicitarAula({}, form(pedido({ inicio: "17:00" }))))).ok).toBe(MSG_ENVIADA)
    expect((await executar(() => solicitarAula({}, form(pedido({ inicio: "19:00" }))))).ok).toBe(MSG_ENVIADA)
    const r = await executar(() => solicitarAula({}, form(pedido({ inicio: "20:00" }))))
    expect(mensagem(r)).toMatch(/^Você atingiu o limite de solicitações pendentes/)
    expect(pendentesDoPedro()).toHaveLength(3)
  })
  it("RN13 uma pendente aprovada ou rejeitada libera vaga no limite", async () => {
    await executar(() => solicitarAula({}, form(pedido({ inicio: "17:00" }))))
    await executar(() => solicitarAula({}, form(pedido({ inicio: "19:00" }))))
    entrarComo("rafael.mendes@exemplo.com")
    expect(mensagem(await executar(() => rejeitarSolicitacao(pendentesDoPedro()[0]!.id, "Horário indisponível")))).toBe("Solicitação rejeitada com sucesso.")
    entrarComo("pedro.almeida@exemplo.com")
    expect((await executar(() => solicitarAula({}, form(pedido({ inicio: "20:00" }))))).ok).toBe(MSG_ENVIADA)
  })
  it("CT59 horário em que o professor já dá aula (terça 14:00) → sugere horários alternativos livres", async () => {
    const ter = proximo("TERCA")
    const r = await executar(() => solicitarAula({}, form(pedido({ data: ter, inicio: "14:00" }))))
    expect(r.estado?.error).toMatch(/não está disponível na agenda do professor/)
    const sugestoes: string[] = r.estado?.sugestoes ?? []
    expect(sugestoes.length).toBeGreaterThan(0)
    expect(sugestoes.includes("14:00")).toBe(false)
    const ocs = await ocupacoesDoDia(ter)
    for (const h of sugestoes) expect(conflita(ocs, { professorId: professorPorNome("Rafael Mendes").id }, h, 60)).toBe(false)
  })
  it("solicitação para data passada é recusada", async () => {
    const r = await executar(() => solicitarAula({}, form(pedido({ data: "2026-01-05" }))))
    expect(mensagem(r)).toBe("A data da aula não pode ser anterior a hoje.")
  })
  it("solicitação para hoje em horário que já passou é recusada", async () => {
    if (nowMinutes() < 60) return // perto da meia-noite 00:15 ainda não passou
    const r = await executar(() => solicitarAula({}, form(pedido({ data: todayStr(), inicio: "00:15", duracaoMin: 30 }))))
    expect(r.redirect).toBeUndefined()
  })
  it("professor não pode criar solicitação de aluno", async () => {
    entrarComo("rafael.mendes@exemplo.com")
    expect(mensagem(await executar(() => solicitarAula({}, form(pedido()))))).toBe("Você não tem permissão para esta ação.")
  })
})

describe("Aprovação (RF030, RF032 · Quadro A.18)", () => {
  let solId = ""
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("pedro.almeida@exemplo.com")
    await executar(() => solicitarAula({}, form(pedido())))
    solId = tabela("solicitacaoAula").at(-1)!.id
    entrarComo("rafael.mendes@exemplo.com")
  })

  it("CT60 Rafael aprova → “Solicitação aprovada com sucesso.”, status Aprovada e reserva criada", async () => {
    const r = await executar(() => aprovarSolicitacao(solId, salaPorNome("Sala 3").id))
    expect(mensagem(r)).toBe("Solicitação aprovada com sucesso.")
    const s = tabela("solicitacaoAula").find((x) => x.id === solId)
    expect(s.status).toBe("APROVADA")
    const res = tabela("reserva").find((x) => x.id === s.reservaId)
    expect(res?.status).toBe("ATIVA")
    expect(res?.salaId).toBe(salaPorNome("Sala 3").id)
    // aluno é avisado
    expect(tabela("notificacao").some((n) => n.usuarioId === usuarioPorEmail("pedro.almeida@exemplo.com").id && /aprovada/.test(n.mensagem))).toBe(true)
  })
  it("CT61 rejeitar outra pendente → “Solicitação rejeitada com sucesso.” e status Rejeitada", async () => {
    const r = await executar(() => rejeitarSolicitacao("seed_sol_001", "Agenda cheia nesta semana"))
    expect(mensagem(r)).toBe("Solicitação rejeitada com sucesso.")
    const s = tabela("solicitacaoAula").find((x) => x.id === "seed_sol_001")
    expect([s.status, s.justificativa]).toEqual(["REJEITADA", "Agenda cheia nesta semana"])
  })
  it("rejeitar sem motivo é recusado", async () => {
    expect(mensagem(await executar(() => rejeitarSolicitacao(solId, "")))).toBe("Informe o motivo da rejeição.")
  })
  it("CT62 horário tomado antes da aprovação → “O horário selecionado não está mais disponível. Sugira um novo horário ao aluno.”", async () => {
    entrarComo("admin@exemplo.com")
    await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 3").id, data: proximo("SEXTA"), inicio: "17:00", fim: "18:00", tipo: "ENSAIO_COLETIVO" })))
    entrarComo("rafael.mendes@exemplo.com")
    const r = await executar(() => aprovarSolicitacao(solId, salaPorNome("Sala 3").id))
    expect(mensagem(r)).toBe("O horário selecionado não está mais disponível. Sugira um novo horário ao aluno.")
    expect(tabela("solicitacaoAula").find((x) => x.id === solId)?.status).toBe("PENDENTE")
  })
  it("outro professor não aprova solicitação que não é dele", async () => {
    entrarComo("mariana.costa@exemplo.com")
    expect(mensagem(await executar(() => aprovarSolicitacao(solId, salaPorNome("Sala 3").id)))).toBe("Você só pode analisar solicitações destinadas a você.")
  })
  it("solicitação já analisada não pode ser aprovada de novo", async () => {
    await executar(() => aprovarSolicitacao(solId, salaPorNome("Sala 3").id))
    expect(mensagem(await executar(() => aprovarSolicitacao(solId, salaPorNome("Sala 5").id)))).toBe("Esta solicitação já foi analisada.")
  })
  it("administração também pode aprovar", async () => {
    entrarComo("secretaria@exemplo.com")
    expect(mensagem(await executar(() => aprovarSolicitacao(solId, salaPorNome("Sala 5").id)))).toBe("Solicitação aprovada com sucesso.")
  })
})
