import { prisma } from "@/lib/prisma"
import type { DiaSemanaKey } from "@/lib/dates"
import { dayRange, diaSemanaOf, fmtDateBR, fmtTime, fromMin, overlaps, toInputDate, toMin, todayStr } from "@/lib/dates"

export { MSG_CONFLITO_SALA, MSG_CONFLITO_PROF_OU_SALA, MSG_HORARIO_INVALIDO } from "@/lib/mensagens"

export type Ocupacao = { origem: "turma" | "reserva"; id: string; salaId: string | null; professorId: string | null; inicio: string; dur: number }

/** Tudo que ocupa sala/professor em uma data: turmas ativas do dia da semana e reservas ativas. */
export async function ocupacoesDoDia(dateStr: string, ignore?: { reservaId?: string; turmaId?: string }): Promise<Ocupacao[]> {
  const [turmas, reservas] = await Promise.all([
    prisma.turma.findMany({ where: { ativo: true, diaSemana: diaSemanaOf(dateStr), ...(ignore?.turmaId ? { id: { not: ignore.turmaId } } : {}) } }),
    prisma.reserva.findMany({ where: { status: "ATIVA", data: dayRange(dateStr), ...(ignore?.reservaId ? { id: { not: ignore.reservaId } } : {}) } }),
  ])
  return [
    ...turmas.map((t) => ({ origem: "turma" as const, id: t.id, salaId: t.salaId, professorId: t.professorId, inicio: t.horario, dur: t.duracaoMin })),
    ...reservas.map((r) => ({ origem: "reserva" as const, id: r.id, salaId: r.salaId, professorId: r.professorId, inicio: fmtTime(r.data), dur: r.duracaoMin })),
  ]
}

/** Função pura: há ocupação conflitante para a sala e/ou o professor no intervalo? */
export function conflita(ocs: Ocupacao[], alvo: { salaId?: string | null; professorId?: string | null }, inicio: string, dur: number) {
  return ocs.some(
    (o) =>
      overlaps(o.inicio, o.dur, inicio, dur) &&
      ((alvo.salaId && o.salaId === alvo.salaId) || (alvo.professorId && o.professorId === alvo.professorId))
  )
}

/** Sala em manutenção na data? (sem data de término, considera indisponível) */
export function salaEmManutencao(sala: { status: string; manutencaoAte: Date | null }, dateStr: string) {
  if (sala.status !== "MANUTENCAO") return false
  return !sala.manutencaoAte || dateStr <= toInputDate(sala.manutencaoAte)
}

export async function salaDisponivel(salaId: string, dateStr: string, inicio: string, dur: number, ignore?: { reservaId?: string }) {
  const sala = await prisma.sala.findUnique({ where: { id: salaId } })
  if (!sala || salaEmManutencao(sala, dateStr)) return false
  const ocs = await ocupacoesDoDia(dateStr, ignore)
  return !conflita(ocs, { salaId }, inicio, dur)
}

export async function professorDisponivel(professorId: string, dateStr: string, inicio: string, dur: number, ignore?: { reservaId?: string }) {
  const ocs = await ocupacoesDoDia(dateStr, ignore)
  return !conflita(ocs, { professorId }, inicio, dur)
}

/** Um compromisso do aluno em um dia: o que é, a hora de início e a duração em minutos. */
export type Compromisso = { descricao: string; inicio: string; dur: number }

/**
 * Compromissos do próprio aluno em uma data (R19–R20): turmas em que está matriculado
 * (com a matrícula valendo nessa data) e aulas extras/reposições já aprovadas, com reserva ativa.
 */
export async function compromissosDoAluno(alunoId: string, dateStr: string, ignore?: { solicitacaoId?: string }): Promise<Compromisso[]> {
  const dia = dayRange(dateStr)
  const [mats, aprovadas] = await Promise.all([
    prisma.matricula.findMany({
      where: {
        alunoId,
        ativo: true,
        dataInicio: { lte: dia.lte },
        OR: [{ dataFim: null }, { dataFim: { gte: dia.gte } }],
        turma: { ativo: true, diaSemana: diaSemanaOf(dateStr) },
      },
      include: { turma: true },
    }),
    prisma.solicitacaoAula.findMany({
      where: { alunoId, status: "APROVADA", data: dia, reserva: { status: "ATIVA" }, ...(ignore?.solicitacaoId ? { id: { not: ignore.solicitacaoId } } : {}) },
    }),
  ])
  return [
    ...mats.map((m) => ({ descricao: `aula da turma ${m.turma.nome}`, inicio: m.turma.horario, dur: m.turma.duracaoMin })),
    ...aprovadas.map((s) => ({ descricao: `outra aula ${s.tipo === "REPOSICAO" ? "de reposição" : "extra"} aprovada`, inicio: fmtTime(s.data), dur: s.duracaoMin })),
  ]
}

/** Mensagem de conflito com a agenda do aluno, ou null se ele estiver livre no intervalo. */
export async function conflitoDoAluno(alunoId: string, dateStr: string, inicio: string, dur: number, ignore?: { solicitacaoId?: string }, sujeito = "o aluno") {
  const cs = await compromissosDoAluno(alunoId, dateStr, ignore)
  const c = cs.find((x) => overlaps(x.inicio, x.dur, inicio, dur))
  return c ? `Conflito de horário: ${sujeito} já tem ${c.descricao} neste horário (${c.inicio}).` : null
}

/**
 * R21 — reservas ativas, de hoje em diante, que caem no dia da semana e no horário de uma turma
 * e usam a mesma sala ou o mesmo professor. Devolve a primeira encontrada (ou null).
 */
export async function reservaQueConflitaComTurma(t: { diaSemana: DiaSemanaKey; horario: string; duracaoMin: number; salaId: string | null; professorId: string }) {
  const reservas = await prisma.reserva.findMany({
    where: {
      status: "ATIVA",
      data: { gte: dayRange(todayStr()).gte },
      OR: [{ professorId: t.professorId }, ...(t.salaId ? [{ salaId: t.salaId }] : [])],
    },
    orderBy: { data: "asc" },
  })
  return (
    reservas.find(
      (r) => diaSemanaOf(r.data.toISOString().slice(0, 10)) === t.diaSemana && overlaps(fmtTime(r.data), r.duracaoMin, t.horario, t.duracaoMin)
    ) ?? null
  )
}

/** Texto curto de uma reserva para mensagens ("18/11/2026 às 10:00"). */
export const quandoReserva = (r: { data: Date }) => `${fmtDateBR(r.data)} às ${fmtTime(r.data)}`

/** Até 3 horários alternativos no mesmo dia, com o professor livre, ao menos uma sala disponível e (se informado) o aluno livre. */
export async function sugerirHorarios(professorId: string, dateStr: string, inicio: string, dur: number, alunoId?: string) {
  const [ocs, salas, doAluno] = await Promise.all([ocupacoesDoDia(dateStr), prisma.sala.findMany(), alunoId ? compromissosDoAluno(alunoId, dateStr) : Promise.resolve([] as Compromisso[])])
  const salasOk = salas.filter((s) => !salaEmManutencao(s, dateStr))
  const alvo = toMin(inicio)
  const candidatos: string[] = []
  for (let m = 8 * 60; m + dur <= 21 * 60; m += 30) {
    const h = fromMin(m)
    if (h === inicio) continue
    if (conflita(ocs, { professorId }, h, dur)) continue
    if (doAluno.some((c) => overlaps(c.inicio, c.dur, h, dur))) continue
    if (!salasOk.some((s) => !conflita(ocs, { salaId: s.id }, h, dur))) continue
    candidatos.push(h)
  }
  return candidatos.sort((a, b) => Math.abs(toMin(a) - alvo) - Math.abs(toMin(b) - alvo)).slice(0, 3).sort()
}
