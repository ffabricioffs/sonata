/**
 * Regras de negócio críticas (roteiro, seção "Regras de negócio críticas"): RN01–RN11.
 * Funções reais de src/lib/dates.ts e src/lib/conflitos.ts.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { overlaps, addDays, diaSemanaOf, weekStart, todayStr } from "@/lib/dates"
import { conflita, ocupacoesDoDia, salaEmManutencao, type Ocupacao } from "@/lib/conflitos"
import { prisma } from "@/lib/prisma"
import { prepararBanco, proximo, salaPorNome, turmaPorNome, professorPorNome } from "../support/helpers"

const oc = (inicio: string, dur: number, salaId: string | null, professorId: string | null): Ocupacao => ({ origem: "turma", id: "x", salaId, professorId, inicio, dur })

describe("Detecção de conflitos (RF024)", () => {
  it("RN01 sobreposição parcial (09:00–10:00 × 09:30–10:30, Sala 1) → conflito", () => {
    expect(conflita([oc("09:00", 60, "sala1", "mariana")], { salaId: "sala1" }, "09:30", 60)).toBe(true)
  })
  it("RN02 um período dentro do outro (09:00–11:00 × 09:30–10:00) → conflito", () => {
    expect(conflita([oc("09:00", 120, "sala1", "mariana")], { salaId: "sala1" }, "09:30", 30)).toBe(true)
  })
  it("RN03 horários encostados (09:00–10:00 × 10:00–11:00) → sem conflito", () => {
    expect(conflita([oc("09:00", 60, "sala1", "mariana")], { salaId: "sala1" }, "10:00", 60)).toBe(false)
  })
  it("RN04 um minuto de sobreposição (09:00–10:00 × 09:59–10:59) → conflito", () => {
    expect(conflita([oc("09:00", 60, "sala1", "mariana")], { salaId: "sala1" }, "09:59", 60)).toBe(true)
  })
  it("RN05 dias diferentes (segunda × terça, mesma sala e horário) → sem conflito", async () => {
    await prepararBanco()
    const seg = proximo("SEGUNDA")
    const ter = addDays(seg, 1)
    const sala1 = salaPorNome("Sala 1").id
    // na segunda a Sala 1 tem a turma de piano às 09:00; na terça, não
    expect(conflita(await ocupacoesDoDia(seg), { salaId: sala1 }, "09:00", 60)).toBe(true)
    expect(conflita(await ocupacoesDoDia(ter), { salaId: sala1 }, "09:00", 60)).toBe(false)
  })
  it("RN06 mesmo horário sem nada em comum (Sala 1/Mariana × Sala 2/Camila) → sem conflito", () => {
    expect(conflita([oc("09:00", 60, "sala1", "mariana")], { salaId: "sala2", professorId: "camila" }, "09:00", 60)).toBe(false)
  })
  it("RN07 mesmo professor em salas diferentes (09:00 Sala 1 × 09:30 Sala 2, Mariana) → conflito", () => {
    expect(conflita([oc("09:00", 60, "sala1", "mariana")], { salaId: "sala2", professorId: "mariana" }, "09:30", 60)).toBe(true)
  })

  describe("com o banco do seed", () => {
    beforeEach(prepararBanco)

    it("RN08 turma inativa não ocupa a sala", async () => {
      const seg = proximo("SEGUNDA")
      const sala1 = salaPorNome("Sala 1").id
      await prisma.turma.update({ where: { id: turmaPorNome("Piano Iniciante - Manhã").id }, data: { ativo: false } })
      expect(conflita(await ocupacoesDoDia(seg), { salaId: sala1 }, "09:00", 60)).toBe(false)
    })

    it("RN09 reserva cancelada não ocupa a sala (sexta 15:00, Sala 3)", async () => {
      const sex = proximo("SEXTA")
      const sala3 = salaPorNome("Sala 3").id
      const admin = await prisma.usuario.findUnique({ where: { email: "admin@exemplo.com" } })
      const r = await prisma.reserva.create({ data: { salaId: sala3, criadoPorId: admin!.id, tipo: "AULA", data: new Date(`${sex}T15:00:00.000Z`), duracaoMin: 60 } })
      expect(conflita(await ocupacoesDoDia(sex), { salaId: sala3 }, "15:00", 60)).toBe(true)
      await prisma.reserva.update({ where: { id: r.id }, data: { status: "CANCELADA" } })
      expect(conflita(await ocupacoesDoDia(sex), { salaId: sala3 }, "15:00", 60)).toBe(false)
    })

    it("reserva de professor também ocupa o professor (mesmo em outra sala)", async () => {
      const sex = proximo("SEXTA")
      const mariana = professorPorNome("Mariana Costa").id
      const admin = await prisma.usuario.findUnique({ where: { email: "admin@exemplo.com" } })
      await prisma.reserva.create({ data: { salaId: salaPorNome("Sala 3").id, professorId: mariana, criadoPorId: admin!.id, tipo: "AULA", data: new Date(`${sex}T15:00:00.000Z`), duracaoMin: 60 } })
      expect(conflita(await ocupacoesDoDia(sex), { professorId: mariana }, "15:30", 30)).toBe(true)
    })
  })
})

describe("Sala em manutenção (RF018)", () => {
  const D = "2026-12-07"
  const sala4 = { status: "MANUTENCAO", manutencaoAte: new Date(`${D}T00:00:00.000Z`) }
  it("RN10 uso no dia D − 1 → bloqueado", () => {
    expect(salaEmManutencao(sala4, addDays(D, -1))).toBe(true)
  })
  it("RN10b uso no próprio dia D (último dia da manutenção) → bloqueado", () => {
    expect(salaEmManutencao(sala4, D)).toBe(true)
  })
  it("RN11 uso no dia D + 1 → liberado", () => {
    expect(salaEmManutencao(sala4, addDays(D, 1))).toBe(false)
  })
  it("sala disponível nunca está em manutenção", () => {
    expect(salaEmManutencao({ status: "DISPONIVEL", manutencaoAte: null }, D)).toBe(false)
  })
  it("manutenção sem data de término bloqueia sempre", () => {
    expect(salaEmManutencao({ status: "MANUTENCAO", manutencaoAte: null }, "2030-01-01")).toBe(true)
  })
})

describe("Datas (base da grade e dos conflitos)", () => {
  it("diaSemanaOf e weekStart usam o calendário, sem depender do fuso do servidor", () => {
    expect(diaSemanaOf("2026-11-30")).toBe("SEGUNDA")
    expect(diaSemanaOf("2026-12-06")).toBe("DOMINGO")
    expect(weekStart("2026-12-06")).toBe("2026-11-30")
    expect(weekStart("2026-12-02")).toBe("2026-11-30")
  })
  it("overlaps é simétrica", () => {
    expect(overlaps("09:30", 60, "09:00", 60)).toBe(overlaps("09:00", 60, "09:30", 60))
  })
  it("todayStr devolve a data de São Paulo no formato yyyy-MM-dd", () => {
    // 02:00 UTC de 10/11 ainda é 09/11 em São Paulo (UTC−3)
    expect(todayStr(new Date("2026-11-10T02:00:00Z"))).toBe("2026-11-09")
  })
})
