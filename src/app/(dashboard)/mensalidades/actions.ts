"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { assertRole, STAFF } from "@/lib/session"
import { todayStr } from "@/lib/dates"
import { actionError, erroValidacao, formToObject, type FormState } from "@/lib/form-state"
import { redirectOk } from "@/lib/flash"
import { competenciaLabel, gerarMesSchema, mensalidadeSchema, urlMensalidades } from "@/lib/validations/mensalidade"

const dia = (s: string) => new Date(`${s}T00:00:00.000Z`)
const MSG_REPETIDA = (mes: number, ano: number) => `Já existe uma mensalidade deste aluno para ${competenciaLabel(mes, ano)}.`

function revalidar() {
  revalidatePath("/mensalidades")
}

/** RF036 — registra (ou edita) uma mensalidade; uma por aluno por mês (CT64). */
export async function salvarMensalidade(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  let mes = 0
  let ano = 0
  try {
    await assertRole(STAFF)
    const parsed = mensalidadeSchema.safeParse(formToObject(fd))
    if (!parsed.success) return erroValidacao(parsed.error)
    const v = parsed.data
    mes = v.mes
    ano = v.ano

    const aluno = await prisma.aluno.findUnique({ where: { id: v.alunoId } })
    if (!aluno) return { error: "Aluno não encontrado.", fieldErrors: { alunoId: "Aluno não encontrado" } }

    const repetida = await prisma.pagamento.findUnique({ where: { alunoId_mes_ano: { alunoId: v.alunoId, mes: v.mes, ano: v.ano } } })
    if (repetida && repetida.id !== id) return { error: MSG_REPETIDA(v.mes, v.ano), fieldErrors: { mes: "Competência já registrada" } }

    const data = { alunoId: v.alunoId, mes: v.mes, ano: v.ano, valor: v.valor.toFixed(2), vencimento: dia(v.vencimento), observacao: v.observacao ?? null }
    if (id) {
      const atual = await prisma.pagamento.findUnique({ where: { id } })
      if (!atual) return { error: "Mensalidade não encontrada." }
      if (atual.pago) return { error: "Mensalidade já quitada: desfaça a quitação antes de editar." }
      await prisma.pagamento.update({ where: { id }, data })
    } else {
      if (!aluno.ativo) return { error: "O aluno está inativo.", fieldErrors: { alunoId: "Aluno inativo" } }
      await prisma.pagamento.create({ data })
    }
  } catch (e) {
    const err = e as { code?: string }
    if (err?.code === "P2002") return { error: MSG_REPETIDA(mes, ano), fieldErrors: { mes: "Competência já registrada" } }
    return actionError(e)
  }
  revalidar()
  redirectOk(urlMensalidades(mes, ano), id ? "Mensalidade atualizada com sucesso." : "Mensalidade registrada com sucesso.")
}

/** Gera a mensalidade do mês para cada aluno ativo com matrícula ativa; pula quem já tem. */
export async function gerarMensalidadesDoMes(_prev: FormState, fd: FormData): Promise<FormState> {
  let criadas = 0
  let existentes = 0
  let comp = ""
  let destino = "/mensalidades"
  try {
    await assertRole(STAFF)
    const parsed = gerarMesSchema.safeParse(formToObject(fd))
    if (!parsed.success) return erroValidacao(parsed.error)
    const v = parsed.data
    comp = competenciaLabel(v.mes, v.ano)
    destino = urlMensalidades(v.mes, v.ano)
    const alunos = await prisma.aluno.findMany({ where: { ativo: true, matriculas: { some: { ativo: true } } }, select: { id: true } })
    if (alunos.length === 0) return { error: "Nenhum aluno ativo com matrícula ativa." }
    const vencimento = dia(`${v.ano}-${String(v.mes).padStart(2, "0")}-${String(v.diaVencimento).padStart(2, "0")}`)
    const r = await prisma.pagamento.createMany({
      data: alunos.map((a) => ({ alunoId: a.id, mes: v.mes, ano: v.ano, valor: v.valor.toFixed(2), vencimento })),
      skipDuplicates: true,
    })
    criadas = r.count
    existentes = alunos.length - r.count
  } catch (e) {
    return actionError(e)
  }
  revalidar()
  redirectOk(
    destino,
    `${criadas} mensalidade(s) gerada(s) para ${comp}${existentes ? `; ${existentes} aluno(s) já tinham mensalidade neste mês` : ""}.`
  )
}

/**
 * Quita a mensalidade com a data de hoje (CT63).
 * As ações da linha (quitar, desfazer, excluir) voltam à competência da mensalidade
 * e ao filtro que estava aberto (situacao), em vez de cair no mês atual.
 */
export async function quitarMensalidade(id: string, situacao?: string): Promise<FormState> {
  let destino = "/mensalidades"
  try {
    await assertRole(STAFF)
    const p = await prisma.pagamento.findUnique({ where: { id } })
    if (!p) return { error: "Mensalidade não encontrada." }
    destino = urlMensalidades(p.mes, p.ano, situacao)
    if (p.pago) return { error: "Esta mensalidade já está quitada." }
    await prisma.pagamento.update({ where: { id }, data: { pago: true, dataPagto: dia(todayStr()) } })
  } catch (e) {
    return actionError(e)
  }
  revalidar()
  redirectOk(destino, "Mensalidade quitada com sucesso.")
}

export async function desfazerQuitacao(id: string, situacao?: string): Promise<FormState> {
  let destino = "/mensalidades"
  try {
    await assertRole(STAFF)
    const p = await prisma.pagamento.update({ where: { id }, data: { pago: false, dataPagto: null } })
    destino = urlMensalidades(p.mes, p.ano, situacao)
  } catch (e) {
    return actionError(e)
  }
  revalidar()
  redirectOk(destino, "Quitação desfeita: a mensalidade voltou para em aberto.")
}

export async function excluirMensalidade(id: string, situacao?: string): Promise<FormState> {
  let destino = "/mensalidades"
  try {
    await assertRole(STAFF)
    const p = await prisma.pagamento.findUnique({ where: { id } })
    if (!p) return { error: "Mensalidade não encontrada." }
    destino = urlMensalidades(p.mes, p.ano, situacao)
    if (p.pago) return { error: "Não é possível excluir uma mensalidade quitada. Desfaça a quitação antes." }
    await prisma.pagamento.delete({ where: { id } })
  } catch (e) {
    return actionError(e)
  }
  revalidar()
  redirectOk(destino, "Mensalidade excluída com sucesso.")
}
