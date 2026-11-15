/** Mensalidades (RF036): CT63–CT64, com o comportamento das Server Actions (15/11/2026). */
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { todayStr } from "@/lib/dates"
import { salvarMensalidade, gerarMensalidadesDoMes, quitarMensalidade, desfazerQuitacao, excluirMensalidade } from "@/app/(dashboard)/mensalidades/actions"
import { excluirAluno } from "@/app/(dashboard)/alunos/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, alunoPorNome } from "../support/helpers"

const mens = (extra: Record<string, string> = {}) => ({ alunoId: alunoPorNome("Lucas Ferreira").id, mes: "12", ano: "2030", valor: "250,00", vencimento: "2030-12-10", ...extra })
const doLucas = () => tabela("pagamento").filter((p) => p.alunoId === alunoPorNome("Lucas Ferreira").id && p.mes === 12 && p.ano === 2030)

describe("Mensalidades (RF036)", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("secretaria@exemplo.com")
  })

  it("CT63 registrar mensalidade → “Mensalidade registrada com sucesso.” e volta para a competência dela", async () => {
    const r = await executar(() => salvarMensalidade(null, {}, form(mens())))
    expect(r.ok).toBe("Mensalidade registrada com sucesso.")
    expect(r.redirect).toMatch(/^\/mensalidades\?mes=12&ano=2030/)
    expect(doLucas()).toHaveLength(1)
    expect([Number(doLucas()[0].valor), doLucas()[0].pago]).toEqual([250, false])
  })
  it("CT63 quitar → paga com a data de hoje; desfazer volta para em aberto, mantendo mês e filtro", async () => {
    await executar(() => salvarMensalidade(null, {}, form(mens())))
    const id = doLucas()[0].id
    const q = await executar(() => quitarMensalidade(id, "aberta"))
    expect(q.ok).toBe("Mensalidade quitada com sucesso.")
    expect(q.redirect).toMatch(/^\/mensalidades\?mes=12&ano=2030&situacao=aberta/)
    expect(doLucas()[0].pago).toBe(true)
    expect(new Date(doLucas()[0].dataPagto).toISOString().slice(0, 10)).toBe(todayStr())
    expect(mensagem(await executar(() => quitarMensalidade(id)))).toBe("Esta mensalidade já está quitada.")
    const d = await executar(() => desfazerQuitacao(id, "paga"))
    expect(d.ok).toBe("Quitação desfeita: a mensalidade voltou para em aberto.")
    expect(d.redirect).toMatch(/situacao=paga/)
    expect([doLucas()[0].pago, doLucas()[0].dataPagto]).toEqual([false, null])
  })
  it("CT64 mensalidade repetida no mesmo mês → “Já existe uma mensalidade deste aluno para 12/2030.”", async () => {
    await executar(() => salvarMensalidade(null, {}, form(mens())))
    const r = await executar(() => salvarMensalidade(null, {}, form(mens({ valor: "300,00" }))))
    expect(mensagem(r)).toBe("Já existe uma mensalidade deste aluno para 12/2030.")
    expect(doLucas()).toHaveLength(1)
  })
  it("valor inválido, zero ou vazio é recusado", async () => {
    expect((await executar(() => salvarMensalidade(null, {}, form(mens({ valor: "abc" }))))).estado?.fieldErrors?.valor).toBe("Valor inválido (ex.: 150,00)")
    expect((await executar(() => salvarMensalidade(null, {}, form(mens({ valor: "0" }))))).estado?.fieldErrors?.valor).toBe("O valor deve ser maior que zero")
    expect(doLucas()).toHaveLength(0)
  })
  it("mensalidade quitada não pode ser excluída nem editada; em aberto pode ser excluída", async () => {
    await executar(() => salvarMensalidade(null, {}, form(mens())))
    const id = doLucas()[0].id
    await executar(() => quitarMensalidade(id))
    expect(mensagem(await executar(() => excluirMensalidade(id)))).toBe("Não é possível excluir uma mensalidade quitada. Desfaça a quitação antes.")
    expect(mensagem(await executar(() => salvarMensalidade(id, {}, form(mens({ valor: "300,00" })))))).toBe("Mensalidade já quitada: desfaça a quitação antes de editar.")
    await executar(() => desfazerQuitacao(id))
    expect((await executar(() => excluirMensalidade(id))).ok).toBe("Mensalidade excluída com sucesso.")
    expect(doLucas()).toHaveLength(0)
  })
  it("gerar o mês cria uma mensalidade por aluno ativo matriculado e, na segunda vez, nenhuma", async () => {
    const gerar = () => executar(() => gerarMensalidadesDoMes({}, form({ mes: "12", ano: "2030", valor: "250,00", diaVencimento: "10" })))
    const primeira = await gerar()
    const n = tabela("pagamento").filter((p) => p.mes === 12 && p.ano === 2030).length
    expect(n).toBeGreaterThan(0)
    expect(primeira.ok).toBe(`${n} mensalidade(s) gerada(s) para 12/2030.`)
    const segunda = await gerar()
    expect(segunda.ok).toBe(`0 mensalidade(s) gerada(s) para 12/2030; ${n} aluno(s) já tinham mensalidade neste mês.`)
    expect(tabela("pagamento").filter((p) => p.mes === 12 && p.ano === 2030)).toHaveLength(n)
  })
  it("dia de vencimento 31 é recusado (1 a 28)", async () => {
    const r = await executar(() => gerarMensalidadesDoMes({}, form({ mes: "12", ano: "2030", valor: "250,00", diaVencimento: "31" })))
    expect(r.estado?.fieldErrors?.diaVencimento).toBe("Dia entre 1 e 28")
  })
  it("aluno e professor não registram mensalidade", async () => {
    entrarComo("lucas.ferreira@exemplo.com")
    expect(mensagem(await executar(() => salvarMensalidade(null, {}, form(mens()))))).toBe("Você não tem permissão para esta ação.")
    entrarComo("mariana.costa@exemplo.com")
    expect(mensagem(await executar(() => gerarMensalidadesDoMes({}, form({ mes: "12", ano: "2030", valor: "250,00", diaVencimento: "10" }))))).toBe("Você não tem permissão para esta ação.")
    expect(doLucas()).toHaveLength(0)
  })
  it("aluno com mensalidade em aberto não pode ser excluído", async () => {
    const enzo = alunoPorNome("Enzo Ribeiro")
    // sem matrícula ativa, o único vínculo é a mensalidade
    await prisma.matricula.updateMany({ where: { alunoId: enzo.id }, data: { ativo: false } })
    await executar(() => salvarMensalidade(null, {}, form(mens({ alunoId: enzo.id }))))
    entrarComo("admin@exemplo.com")
    expect(mensagem(await executar(() => excluirAluno(enzo.id)))).toBe("Não é possível excluir o aluno. Existem vínculos ativos associados a este registro.")
    expect(alunoPorNome("Enzo Ribeiro")).toBeDefined()
  })
})
