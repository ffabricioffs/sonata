/** Correções do teste com usuários (PR #7, 15/11/2026): máscaras, telefone, aviso de cancelamento e retorno ao mês. */
import { describe, it, expect, beforeEach } from "vitest"
import { mascaraCpf, mascaraTelefone } from "@/lib/mascaras"
import { urlMensalidades } from "@/lib/validations/mensalidade"
import { salvarAluno } from "@/app/(dashboard)/alunos/actions"
import { salvarProfessor } from "@/app/(dashboard)/professores/actions"
import { solicitarAula, aprovarSolicitacao } from "@/app/(dashboard)/solicitacoes/actions"
import { cancelarReserva } from "@/app/(dashboard)/reservas/actions"
import { prepararBanco, entrarComo, executar, form, mensagem, tabela, salaPorNome, professorPorNome, usuarioPorEmail, proximo } from "../support/helpers"

describe("Máscaras de CPF e telefone", () => {
  it("formata CPF enquanto se digita", () => {
    expect(mascaraCpf("529")).toBe("529")
    expect(mascaraCpf("5299822")).toBe("529.982.2")
    expect(mascaraCpf("52998224725")).toBe("529.982.247-25")
    expect(mascaraCpf("529.982.247-25999")).toBe("529.982.247-25")
  })
  it("formata celular (9 dígitos) e fixo (8 dígitos)", () => {
    expect(mascaraTelefone("11")).toBe("(11")
    expect(mascaraTelefone("11987654321")).toBe("(11) 98765-4321")
    expect(mascaraTelefone("1133334444")).toBe("(11) 3333-4444")
    expect(mascaraTelefone("")).toBe("")
  })
})

describe("Telefone validado e gravado num formato único", () => {
  beforeEach(async () => {
    await prepararBanco()
    entrarComo("secretaria@exemplo.com")
  })
  const aluno = { nome: "Telefone Teste", email: "telefone.teste@exemplo.com", dataNasc: "1999-01-01", cpf: "987.654.321-00" }

  it("telefone sem DDD é recusado", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ ...aluno, telefone: "91234" })))
    expect(r.estado?.fieldErrors?.telefone).toBe("Telefone inválido: informe DDD e número")
    expect(tabela("aluno").some((a) => a.email === aluno.email)).toBe(false)
  })
  it("telefone digitado só com números é gravado como (11) 91234-5678", async () => {
    const r = await executar(() => salvarAluno(null, {}, form({ ...aluno, telefone: "11912345678" })))
    expect(r.ok).toBe("Aluno cadastrado com sucesso.")
    expect(tabela("aluno").find((a) => a.email === aluno.email)?.telefone).toBe("(11) 91234-5678")
  })
  it("professor: telefone obrigatório e normalizado", async () => {
    const prof = { nome: "Telefone Professor", email: "tel.prof@exemplo.com", cpf: "135.792.468-28", endereco: "Rua A, 1 - São Paulo/SP", senha: "Abc12345" }
    expect((await executar(() => salvarProfessor(null, {}, form({ ...prof, telefone: "123" })))).estado?.fieldErrors?.telefone).toBe("Telefone inválido: informe DDD e número")
    expect((await executar(() => salvarProfessor(null, {}, form({ ...prof, telefone: "1133334444" })))).ok).toBe("Professor cadastrado com sucesso.")
    const u = usuarioPorEmail(prof.email)
    expect(tabela("professor").find((p) => p.usuarioId === u.id)?.telefone).toBe("(11) 3333-4444")
  })
})

describe("Cancelar a reserva de uma solicitação aprovada avisa o aluno", () => {
  beforeEach(prepararBanco)

  it("o aluno recebe a notificação e a reserva não pode ser cancelada duas vezes", async () => {
    entrarComo("pedro.almeida@exemplo.com")
    const data = proximo("SEXTA")
    await executar(() =>
      solicitarAula({}, form({ professorId: professorPorNome("Rafael Mendes").id, tipo: "EXTRA", data, inicio: "17:00", duracaoMin: 60, motivo: "Aula complementar" }))
    )
    const sol = tabela("solicitacaoAula").at(-1)
    entrarComo("rafael.mendes@exemplo.com")
    expect(mensagem(await executar(() => aprovarSolicitacao(sol.id, salaPorNome("Sala 3").id)))).toBe("Solicitação aprovada com sucesso.")
    const reservaId = tabela("solicitacaoAula").find((s) => s.id === sol.id).reservaId
    const r = await executar(() => cancelarReserva(reservaId))
    expect(r.ok).toBe("Reserva cancelada com sucesso.")
    const pedro = usuarioPorEmail("pedro.almeida@exemplo.com")
    const aviso = tabela("notificacao").filter((n) => n.usuarioId === pedro.id && /da sua solicitação aprovada, foi cancelada/.test(n.mensagem))
    expect(aviso).toHaveLength(1)
    expect(aviso[0].mensagem).toContain("(Sala 3)")
    expect(mensagem(await executar(() => cancelarReserva(reservaId)))).toBe("Esta reserva já está cancelada.")
  })
})

describe("Mensalidades voltam ao mês e ao filtro abertos (PR #6)", () => {
  it("urlMensalidades monta o endereço só com valores válidos", () => {
    expect(urlMensalidades(12, 2030)).toBe("/mensalidades?mes=12&ano=2030")
    expect(urlMensalidades(12, 2030, "paga")).toBe("/mensalidades?mes=12&ano=2030&situacao=paga")
    expect(urlMensalidades(12, 2030, "qualquer")).toBe("/mensalidades?mes=12&ano=2030")
    expect(urlMensalidades(13, 2030)).toBe("/mensalidades?ano=2030")
    expect(urlMensalidades()).toBe("/mensalidades")
  })
})
