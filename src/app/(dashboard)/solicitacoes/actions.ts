"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { assertRole } from "@/lib/session"
import { solicitacaoFormSchema, LIMITE_PENDENTES } from "@/lib/validations/reserva"
import { actionError, formToObject, zodFieldErrors, type FormState, erroValidacao } from "@/lib/form-state"
import { dayRange, fmtTime, toDbDateTime, todayStr, fmtDateBR, nowMinutes, toMin } from "@/lib/dates"
import { ocupacoesDoDia, conflita, salaEmManutencao, sugerirHorarios, conflitoDoAluno } from "@/lib/conflitos"
import { notificar, idsDaEquipe } from "@/lib/notificar"
import { redirectOk } from "@/lib/flash"

const MSG_LIMITE = "Você atingiu o limite de solicitações pendentes. Aguarde a análise das solicitações já enviadas."
const MSG_INDISPONIVEL_APROVACAO = "O horário selecionado não está mais disponível. Sugira um novo horário ao aluno."

export type SolicitacaoState = FormState & { sugestoes?: string[] }

/** RF028 — o aluno solicita aula extra ou reposição. */
export async function solicitarAula(_prev: SolicitacaoState, fd: FormData): Promise<SolicitacaoState> {
  try {
    const user = await assertRole(["ALUNO"])
    const aluno = await prisma.aluno.findUnique({ where: { usuarioId: user.id } })
    if (!aluno) return { error: "Seu usuário não está vinculado a um cadastro de aluno. Procure a secretaria." }

    const parsed = solicitacaoFormSchema.safeParse(formToObject(fd))
    if (!parsed.success) return erroValidacao(parsed.error)
    const v = parsed.data
    if (v.data < todayStr()) return { error: "A data da aula não pode ser anterior a hoje.", fieldErrors: { data: "Data anterior a hoje" } }

    if (v.data === todayStr() && toMin(v.inicio) <= nowMinutes()) return { error: "O horário solicitado já passou. Escolha um horário futuro.", fieldErrors: { inicio: "Horário já passou" } }

    // Reposição: a aula perdida é obrigatória, tem de ser de uma turma do aluno, já ter passado
    // e não pode ter outra reposição pendente ou aprovada (uma reposição por aula perdida)
    if (v.tipo === "REPOSICAO") {
      if (!v.aulaPerdidaId) return { error: "Selecione a aula perdida para pedir a reposição.", fieldErrors: { aulaPerdidaId: "Selecione a aula perdida" } }
      const perdida = await prisma.aula.findUnique({ where: { id: v.aulaPerdidaId } })
      const matriculado = perdida ? await prisma.matricula.findFirst({ where: { alunoId: aluno.id, turmaId: perdida.turmaId } }) : null
      if (!perdida || !matriculado) return { error: "A aula selecionada não é de uma turma sua.", fieldErrors: { aulaPerdidaId: "Aula inválida" } }
      if (perdida.data >= dayRange(todayStr()).gte) return { error: "A reposição só pode ser pedida para uma aula que já passou.", fieldErrors: { aulaPerdidaId: "Aula ainda não aconteceu" } }
      const ja = await prisma.solicitacaoAula.findFirst({ where: { alunoId: aluno.id, tipo: "REPOSICAO", aulaPerdidaId: perdida.id, status: { in: ["PENDENTE", "APROVADA"] } } })
      if (ja) {
        const msg = ja.status === "APROVADA" ? "Esta aula já tem uma reposição aprovada." : "Já existe um pedido de reposição pendente para esta aula."
        return { error: msg, fieldErrors: { aulaPerdidaId: msg } }
      }
    }

    // RF031 — limite de solicitações pendentes
    const pendentes = await prisma.solicitacaoAula.count({ where: { alunoId: aluno.id, status: "PENDENTE" } })
    if (pendentes >= LIMITE_PENDENTES) return { error: MSG_LIMITE }

    // R19 — o aluno não pode pedir aula no horário de uma turma em que está matriculado
    const choqueAluno = await conflitoDoAluno(aluno.id, v.data, v.inicio, v.duracaoMin, undefined, "você")
    if (choqueAluno) {
      const sugestoes = await sugerirHorarios(v.professorId, v.data, v.inicio, v.duracaoMin, aluno.id)
      return {
        error: choqueAluno + (sugestoes.length ? " Escolha um dos horários sugeridos." : " Tente outra data."),
        fieldErrors: { inicio: "Você já tem aula neste horário" },
        sugestoes,
      }
    }

    // RF032 — horário indisponível na agenda do professor (ou nenhuma sala livre): sugere alternativas
    const ocs = await ocupacoesDoDia(v.data)
    const salas = await prisma.sala.findMany()
    const professorLivre = !conflita(ocs, { professorId: v.professorId }, v.inicio, v.duracaoMin)
    const haSala = salas.some((s) => !salaEmManutencao(s, v.data) && !conflita(ocs, { salaId: s.id }, v.inicio, v.duracaoMin))
    if (!professorLivre || !haSala) {
      const sugestoes = await sugerirHorarios(v.professorId, v.data, v.inicio, v.duracaoMin, aluno.id)
      return {
        error: "O horário solicitado não está disponível na agenda do professor." + (sugestoes.length ? " Escolha um dos horários sugeridos." : " Não há horários alternativos neste dia; tente outra data."),
        fieldErrors: { inicio: "Horário indisponível" },
        sugestoes,
      }
    }

    const sol = await prisma.solicitacaoAula.create({
      data: {
        alunoId: aluno.id,
        professorId: v.professorId,
        tipo: v.tipo,
        data: toDbDateTime(v.data, v.inicio),
        duracaoMin: v.duracaoMin,
        motivo: v.motivo,
        aulaPerdidaId: v.tipo === "REPOSICAO" && v.aulaPerdidaId ? v.aulaPerdidaId : null,
      },
      include: { professor: true },
    })
    // RF029 — notificação ao professor e à administração
    const equipe = await idsDaEquipe()
    await notificar(
      [sol.professor.usuarioId, ...equipe],
      `Nova solicitação de ${v.tipo === "REPOSICAO" ? "reposição" : "aula extra"} de ${aluno.nome} para ${fmtDateBR(sol.data)} às ${fmtTime(sol.data)}.`,
      "/solicitacoes"
    )
  } catch (e) {
    return actionError(e)
  }
  revalidatePath("/solicitacoes")
  redirectOk("/solicitacoes", "Solicitação enviada com sucesso. Aguarde a aprovação do professor.")
}

async function carregarParaDecisao(id: string) {
  const user = await assertRole(["ADMIN", "SECRETARIA", "PROFESSOR"])
  const s = await prisma.solicitacaoAula.findUnique({ where: { id }, include: { aluno: true, professor: true } })
  if (!s) throw new Error("Solicitação não encontrada.")
  if (s.status !== "PENDENTE") throw new Error("Esta solicitação já foi analisada.")
  if (user.role === "PROFESSOR" && s.professor.usuarioId !== user.id) throw new Error("Você só pode analisar solicitações destinadas a você.")
  return { user, s }
}

/** RF030 — aprova a solicitação, gerando a reserva da sala escolhida. */
export async function aprovarSolicitacao(id: string, salaId: string): Promise<FormState> {
  try {
    const { user, s } = await carregarParaDecisao(id)
    if (!salaId) return { error: "Selecione a sala para a aula." }
    const dataStr = s.data.toISOString().slice(0, 10)
    const inicio = fmtTime(s.data)
    // Não aprova pedido cuja data já passou (a aula não pode ser marcada depois de acontecer)
    if (dataStr < todayStr() || (dataStr === todayStr() && toMin(inicio) <= nowMinutes())) {
      return { error: "A data desta solicitação já passou. Rejeite-a e peça ao aluno um novo horário." }
    }
    // Uma reposição aprovada por aula perdida
    if (s.tipo === "REPOSICAO" && s.aulaPerdidaId) {
      const outra = await prisma.solicitacaoAula.findFirst({ where: { id: { not: s.id }, alunoId: s.alunoId, tipo: "REPOSICAO", aulaPerdidaId: s.aulaPerdidaId, status: "APROVADA" } })
      if (outra) return { error: `Esta aula perdida já tem uma reposição aprovada (${fmtDateBR(outra.data)} às ${fmtTime(outra.data)}). Rejeite esta solicitação.` }
    }
    const sala = await prisma.sala.findUnique({ where: { id: salaId } })
    const ocs = await ocupacoesDoDia(dataStr)
    if (!sala || salaEmManutencao(sala, dataStr) || conflita(ocs, { salaId, professorId: s.professorId }, inicio, s.duracaoMin)) {
      return { error: MSG_INDISPONIVEL_APROVACAO }
    }
    // R20 — não aprova se o aluno já tiver aula de turma (ou outra aula aprovada) no mesmo horário
    const choqueAluno = await conflitoDoAluno(s.alunoId, dataStr, inicio, s.duracaoMin, { solicitacaoId: s.id })
    if (choqueAluno) return { error: `${choqueAluno} Rejeite a solicitação ou combine outro horário com o aluno.` }
    await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.create({
        data: {
          salaId,
          criadoPorId: user.id,
          professorId: s.professorId,
          tipo: "AULA",
          observacao: `${s.tipo === "REPOSICAO" ? "Reposição" : "Aula extra"} — ${s.aluno.nome}`,
          data: s.data,
          duracaoMin: s.duracaoMin,
        },
      })
      await tx.solicitacaoAula.update({ where: { id }, data: { status: "APROVADA", decididoPorId: user.id, decididoEm: new Date(), reservaId: reserva.id } })
    })
    if (s.aluno.usuarioId) {
      await notificar([s.aluno.usuarioId], `Sua solicitação para ${fmtDateBR(s.data)} às ${inicio} foi aprovada (sala ${sala.nome}).`, "/solicitacoes")
    }
  } catch (e) {
    return actionError(e)
  }
  revalidatePath("/solicitacoes")
  revalidatePath("/reservas")
  revalidatePath("/agenda")
  redirectOk("/solicitacoes", "Solicitação aprovada com sucesso.")
}

export async function rejeitarSolicitacao(id: string, justificativa: string): Promise<FormState> {
  try {
    const { user, s } = await carregarParaDecisao(id)
    if (!justificativa || justificativa.trim().length < 3) return { error: "Informe o motivo da rejeição." }
    await prisma.solicitacaoAula.update({ where: { id }, data: { status: "REJEITADA", decididoPorId: user.id, decididoEm: new Date(), justificativa: justificativa.trim() } })
    if (s.aluno.usuarioId) {
      await notificar([s.aluno.usuarioId], `Sua solicitação para ${fmtDateBR(s.data)} às ${fmtTime(s.data)} foi rejeitada. Motivo: ${justificativa.trim()}`, "/solicitacoes")
    }
  } catch (e) {
    return actionError(e)
  }
  revalidatePath("/solicitacoes")
  redirectOk("/solicitacoes", "Solicitação rejeitada com sucesso.")
}

export async function marcarNotificacoesLidas(): Promise<FormState> {
  const user = await assertRole(["ADMIN", "SECRETARIA", "PROFESSOR", "ALUNO"])
  await prisma.notificacao.updateMany({ where: { usuarioId: user.id, lida: false }, data: { lida: true } })
  revalidatePath("/notificacoes")
  revalidatePath("/dashboard")
  return { ok: true }
}

