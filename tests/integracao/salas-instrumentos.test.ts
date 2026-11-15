/** Salas e instrumentos: CT27–CT35, RF018 (Quadros A.9 a A.11). */
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { addDays, todayStr } from "@/lib/dates"
import { salaEmManutencao } from "@/lib/conflitos"
import { salvarSala, excluirSala } from "@/app/(dashboard)/salas/actions"
import { salvarInstrumento, excluirInstrumento } from "@/app/(dashboard)/instrumentos/actions"
import { criarReserva } from "@/app/(dashboard)/reservas/actions"
import { salvarTurma } from "@/app/(dashboard)/turmas/actions"
import { opcoesTurma } from "@/app/(dashboard)/turmas/form-data"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, salaPorNome, instrumentoPorNome, professorPorNome, proximo } from "../support/helpers"

describe("Salas (RF014–RF018)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT27 cadastrar “Sala 7”, capacidade 5, recursos “piano digital” → sucesso com os três dados", async () => {
    const r = await executar(() => salvarSala(null, {}, form({ nome: "Sala 7", capacidade: 5, recursos: "piano digital" })))
    expect(r.ok).toBe("Sala cadastrada com sucesso.")
    const s = salaPorNome("Sala 7")
    expect([s.capacidade, s.recursos, s.status]).toEqual([5, "piano digital", "DISPONIVEL"])
  })
  it("CT28 outra “Sala 1” → “Já existe uma sala com este nome.”", async () => {
    const r = await executar(() => salvarSala(null, {}, form({ nome: "Sala 1", capacidade: 4 })))
    expect(mensagem(r)).toBe("Já existe uma sala com este nome.")
  })
  it("CT29 salvar sem nome → “Preencha todos os campos obrigatórios.”", async () => {
    const r = await executar(() => salvarSala(null, {}, form({ nome: "", capacidade: 4 })))
    expect(r.redirect).toBeUndefined()
    expect(mensagem(r)).toBe("Preencha todos os campos obrigatórios.")
  })
  it("CT30 capacidade da Sala 7 para 6 → “Dados da sala atualizados com sucesso.”", async () => {
    await executar(() => salvarSala(null, {}, form({ nome: "Sala 7", capacidade: 5, recursos: "piano digital" })))
    const r = await executar(() => salvarSala(salaPorNome("Sala 7").id, {}, form({ nome: "Sala 7", capacidade: 6, recursos: "piano digital" })))
    expect(r.ok).toBe("Dados da sala atualizados com sucesso.")
    expect(salaPorNome("Sala 7").capacidade).toBe(6)
  })
  it("CT31 as 6 salas do seed aparecem, com a Sala 4 em manutenção", async () => {
    const salas = await prisma.sala.findMany({ orderBy: { nome: "asc" } })
    expect(salas).toHaveLength(6)
    expect(salas.find((s) => s.nome === "Sala 4")?.status).toBe("MANUTENCAO")
    expect(salas.find((s) => s.nome === "Auditório")?.capacidade).toBe(40)
  })
  it("CT32 excluir a Sala 1 (com turmas) → mensagem de vínculos ativos", async () => {
    const r = await executar(() => excluirSala(salaPorNome("Sala 1").id))
    expect(mensagem(r)).toBe("Não é possível excluir a sala. Existem vínculos ativos associados a este registro.")
  })
  it("CT33 excluir a Sala 7 → “Sala excluída com sucesso.”", async () => {
    await executar(() => salvarSala(null, {}, form({ nome: "Sala 7", capacidade: 5 })))
    const r = await executar(() => excluirSala(salaPorNome("Sala 7").id))
    expect(r.ok).toBe("Sala excluída com sucesso.")
    expect(salaPorNome("Sala 7")).toBeUndefined()
  })
  it("CT34 Sala 5 em manutenção até daqui a 3 dias: status e data salvos, sala indisponível no período", async () => {
    const ate = addDays(todayStr(), 3)
    const s5 = salaPorNome("Sala 5")
    const r = await executar(() => salvarSala(s5.id, {}, form({ nome: "Sala 5", capacidade: s5.capacidade, recursos: s5.recursos, status: "MANUTENCAO", manutencaoAte: ate })))
    expect(r.ok).toBe("Dados da sala atualizados com sucesso.")
    const atual = salaPorNome("Sala 5")
    expect(atual.status).toBe("MANUTENCAO")
    expect(atual.manutencaoAte.toISOString().slice(0, 10)).toBe(ate)
    expect(salaEmManutencao(atual, addDays(todayStr(), 1))).toBe(true)
    // no formulário de turma a sala aparece com o aviso "manutenção até dd/mm" (D05: a manutenção vale só no período)
    expect((await opcoesTurma()).salas.find((x) => x.nome.startsWith("Sala 5"))?.manutencao).toMatch(/^manutenção até \d\d\/\d\d$/)
    // reserva dentro do período é recusada
    const res = await executar(() => criarReserva({}, form({ salaId: s5.id, data: addDays(todayStr(), 1), inicio: "08:00", fim: "09:00", tipo: "ENSAIO_INDIVIDUAL" })))
    expect(mensagem(res)).toBe("Conflito de horário: a sala não está disponível neste período.")
  })
  it("CT34b depois do término, a Sala 5 volta a aceitar reservas", async () => {
    const s5 = salaPorNome("Sala 5")
    await executar(() => salvarSala(s5.id, {}, form({ nome: "Sala 5", capacidade: 4, status: "MANUTENCAO", manutencaoAte: addDays(todayStr(), 3) })))
    const depois = proximo("SEXTA", addDays(todayStr(), 4))
    const res = await executar(() => criarReserva({}, form({ salaId: s5.id, data: depois, inicio: "08:00", fim: "09:00", tipo: "ENSAIO_INDIVIDUAL" })))
    expect(res.ok).toBe("Reserva realizada com sucesso.")
  })
  it("CT34c depois do término da manutenção, a sala também volta a aceitar turmas", async () => {
    // Sala com status MANUTENCAO e término já vencido (ontem)
    const s4 = salaPorNome("Sala 4")
    await prisma.sala.update({ where: { id: s4.id }, data: { manutencaoAte: new Date(`${addDays(todayStr(), -1)}T00:00:00.000Z`) } })
    const r = await executar(() => salvarTurma(null, {}, form({ nome: "Bateria Avançada", instrumentoId: instrumentoPorNome("Bateria").id, professorId: professorPorNome("Camila Oliveira").id, salaId: s4.id, diaSemana: "TERCA", horario: "19:00", duracaoMin: 60, vagas: 4 })))
    expect(r.ok).toBe("Turma cadastrada com sucesso.")
  })
})

describe("Instrumentos (RF019)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("admin@exemplo.com")
  })

  it("CT35 “Flauta” já existe no seed: cadastrar de novo dá “Já existe um instrumento com este nome.”", async () => {
    expect(instrumentoPorNome("Flauta")).toBeDefined()
    const r = await executar(() => salvarInstrumento(null, {}, form({ nome: "Flauta" })))
    expect(mensagem(r)).toBe("Já existe um instrumento com este nome.")
  })
  it("CT35 cadastrar, renomear, consultar e excluir (com “Ukulele”, já que Flauta existe)", async () => {
    expect((await executar(() => salvarInstrumento(null, {}, form({ nome: "Ukulele" })))).ok).toBe("Instrumento cadastrado com sucesso.")
    const id = instrumentoPorNome("Ukulele").id
    expect((await executar(() => salvarInstrumento(id, {}, form({ nome: "Ukulele soprano" })))).ok).toBe("Instrumento atualizado com sucesso.")
    expect((await prisma.instrumento.findMany()).map((i) => i.nome)).toContain("Ukulele soprano")
    expect((await executar(() => excluirInstrumento(id))).ok).toBe("Instrumento excluído com sucesso.")
    expect(tabela("instrumento").some((i) => i.id === id)).toBe(false)
  })
  it("CT35 Piano, com turmas, não pode ser excluído", async () => {
    const r = await executar(() => excluirInstrumento(instrumentoPorNome("Piano").id))
    expect(mensagem(r)).toBe("Não é possível excluir o instrumento. Existem vínculos ativos associados a este registro.")
  })
})
