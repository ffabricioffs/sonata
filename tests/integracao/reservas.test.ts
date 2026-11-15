/** Reservas de sala: CT48–CT54 (Quadros A.14 a A.16). */
import { describe, it, expect, beforeEach } from "vitest"
import { addDays, todayStr } from "@/lib/dates"
import { criarReserva, cancelarReserva, reagendarReserva, ocupacaoDaSala } from "@/app/(dashboard)/reservas/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, salaPorNome, proximo } from "../support/helpers"

const MSG_SALA = "Conflito de horário: a sala não está disponível neste período."
const ultimaReserva = () => tabela("reserva").at(-1)

describe("Reservas (RF024–RF027)", () => {
  beforeEach(prepararBanco)

  it("CT48 professor reserva a Sala 3 na sexta 15:00–16:00 → sucesso e horário ocupado na grade", async () => {
    entrarComo("mariana.costa@exemplo.com")
    const sex = proximo("SEXTA")
    const sala3 = salaPorNome("Sala 3").id
    const r = await executar(() => criarReserva({}, form({ salaId: sala3, data: sex, inicio: "15:00", fim: "16:00", tipo: "ENSAIO_INDIVIDUAL" })))
    expect(r.ok).toBe("Reserva realizada com sucesso.")
    expect(ultimaReserva().status).toBe("ATIVA")
    expect((await ocupacaoDaSala(sala3, sex)).some((o) => o.inicio === "15:00" && o.fim === "16:00")).toBe(true)
  })
  it("CT49 Sala 1 na segunda 09:00–10:00 (turma de piano) → “Conflito de horário: a sala não está disponível neste período.”", async () => {
    entrarComo("rafael.mendes@exemplo.com")
    const r = await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 1").id, data: proximo("SEGUNDA"), inicio: "09:00", fim: "10:00", tipo: "AULA" })))
    expect(mensagem(r)).toBe(MSG_SALA)
  })
  it("CT50 início 16:00 e término 15:00 → “O horário de término deve ser posterior ao horário de início.”", async () => {
    entrarComo("mariana.costa@exemplo.com")
    const r = await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 3").id, data: proximo("SEXTA"), inicio: "16:00", fim: "15:00", tipo: "AULA" })))
    expect(mensagem(r)).toBe("O horário de término deve ser posterior ao horário de início.")
  })
  it("reserva com data passada é recusada", async () => {
    entrarComo("mariana.costa@exemplo.com")
    const r = await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 3").id, data: addDays(todayStr(), -1), inicio: "15:00", fim: "16:00", tipo: "AULA" })))
    expect(mensagem(r)).toBe("A data da reserva não pode ser anterior a hoje.")
  })
  it("aluno não pode reservar sala", async () => {
    entrarComo("pedro.almeida@exemplo.com")
    const r = await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 3").id, data: proximo("SEXTA"), inicio: "15:00", fim: "16:00", tipo: "AULA" })))
    expect(mensagem(r)).toBe("Você não tem permissão para esta ação.")
  })

  describe("cancelamento e reagendamento", () => {
    let id = ""
    beforeEach(async () => {
      entrarComo("mariana.costa@exemplo.com")
      await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 3").id, data: proximo("SEXTA"), inicio: "15:00", fim: "16:00", tipo: "ENSAIO_INDIVIDUAL" })))
      id = ultimaReserva().id
    })

    it("CT51 cancelar a própria reserva → “Reserva cancelada com sucesso.”, status Cancelada e horário livre", async () => {
      const r = await executar(() => cancelarReserva(id))
      expect(mensagem(r)).toBe("Reserva cancelada com sucesso.")
      expect(tabela("reserva").find((x) => x.id === id)?.status).toBe("CANCELADA")
      expect(await ocupacaoDaSala(salaPorNome("Sala 3").id, proximo("SEXTA"))).toHaveLength(0)
    })
    it("CT52 outro professor tenta cancelar → “Você não possui permissão para cancelar esta reserva.”", async () => {
      entrarComo("rafael.mendes@exemplo.com")
      const r = await executar(() => cancelarReserva(id))
      expect(mensagem(r)).toBe("Você não possui permissão para cancelar esta reserva.")
      expect(tabela("reserva").find((x) => x.id === id)?.status).toBe("ATIVA")
    })
    it("CT53 admin move a reserva para a sexta 17:00–18:00 → “Reserva reagendada com sucesso.”", async () => {
      entrarComo("admin@exemplo.com")
      const sex = proximo("SEXTA")
      const r = await executar(() => reagendarReserva(id, {}, form({ data: sex, inicio: "17:00", fim: "18:00" })))
      expect(r.ok).toBe("Reserva reagendada com sucesso.")
      const atual = tabela("reserva").find((x) => x.id === id)
      expect(atual.data.toISOString()).toBe(`${sex}T17:00:00.000Z`)
      expect(atual.duracaoMin).toBe(60)
    })
    it("CT54 reagendar reserva da Sala 1 para a segunda 09:00 → mensagem de conflito do CT49", async () => {
      entrarComo("admin@exemplo.com")
      await executar(() => criarReserva({}, form({ salaId: salaPorNome("Sala 1").id, data: proximo("SEXTA"), inicio: "15:00", fim: "16:00", tipo: "ENSAIO_COLETIVO" })))
      const daSala1 = ultimaReserva().id
      const r = await executar(() => reagendarReserva(daSala1, {}, form({ data: proximo("SEGUNDA"), inicio: "09:00", fim: "10:00" })))
      expect(mensagem(r)).toBe(MSG_SALA)
    })
    it("CT54b reagendar a reserva da Mariana (Sala 3) para segunda 09:00 → conflito com a turma dela", async () => {
      entrarComo("admin@exemplo.com")
      const r = await executar(() => reagendarReserva(id, {}, form({ data: proximo("SEGUNDA"), inicio: "09:00", fim: "10:00" })))
      expect(mensagem(r)).toBe("Conflito de horário: o professor não está disponível neste período.")
    })
    it("professor não reagenda (somente administração)", async () => {
      const r = await executar(() => reagendarReserva(id, {}, form({ data: proximo("SEXTA"), inicio: "17:00", fim: "18:00" })))
      expect(mensagem(r)).toBe("Você não tem permissão para esta ação.")
    })
    it("reagendamento para data passada é recusado", async () => {
      entrarComo("admin@exemplo.com")
      const r = await executar(() => reagendarReserva(id, {}, form({ data: addDays(todayStr(), -2), inicio: "17:00", fim: "18:00" })))
      expect(r.redirect).toBeUndefined()
    })
  })
})
