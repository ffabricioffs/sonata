import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireUser, isStaff } from "@/lib/session"
import { fmtDateBR, fmtTime, todayStr, dayRange, proximaDataDoDia, DIA_LABEL } from "@/lib/dates"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TurmaForm } from "../turma-form"
import { opcoesTurma } from "../form-data"
import { MatricularAluno, DesmatricularBotao } from "./matricular-aluno"

export default async function TurmaPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser()
  const { id } = await searchParams
  if (!id) notFound()
  const turma = await prisma.turma.findUnique({
    where: { id },
    include: { instrumento: true, sala: true, professor: { include: { usuario: true } }, matriculas: { where: { ativo: true }, include: { aluno: true }, orderBy: { aluno: { nome: "asc" } } } },
  })
  if (!turma) notFound()

  // Escopo: professor só vê as suas; aluno só as que cursa
  if (user.role === "PROFESSOR" && turma.professor.usuarioId !== user.id) notFound()
  if (user.role === "ALUNO" && !turma.matriculas.some((m) => m.aluno.usuarioId === user.id)) notFound()

  const staff = isStaff(user.role)
  const hoje = todayStr()
  const [o, proximas] = await Promise.all([
    staff ? opcoesTurma() : Promise.resolve(null),
    prisma.aula.findMany({ where: { turmaId: turma.id, data: { gte: dayRange(hoje).gte } }, orderBy: { data: "asc" }, take: 4 }),
  ])
  const verAlunos = user.role !== "ALUNO"
  const opcoesAlunos = staff
    ? await prisma.aluno.findMany({
        where: { ativo: true, matriculas: { none: { turmaId: turma.id, ativo: true } } },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      })
    : []

  return (
    <div className="space-y-6">
      <PageHeader title={turma.nome} description={`${turma.matriculas.length}/${turma.vagas} vagas ocupadas`} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Informações da turma</CardTitle>
          <Badge variant={turma.ativo ? "default" : "outline"}>{turma.ativo ? "Ativa" : "Inativa"}</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-muted-foreground">Instrumento</dt><dd className="font-medium">{turma.instrumento.nome}</dd></div>
            <div><dt className="text-muted-foreground">Professor</dt><dd className="font-medium">{turma.professor.usuario.nome}</dd></div>
            <div><dt className="text-muted-foreground">Dia e horário</dt><dd className="font-medium">{DIA_LABEL[turma.diaSemana]}, {turma.horario} ({turma.duracaoMin} min)</dd></div>
            <div><dt className="text-muted-foreground">Sala</dt><dd className="font-medium">{turma.sala?.nome ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Vagas</dt><dd className="font-medium">{turma.matriculas.length} ocupadas de {turma.vagas}</dd></div>
            <div>
              <dt className="text-muted-foreground">Próximas aulas</dt>
              <dd className="font-medium">
                {proximas.length === 0
                  ? turma.ativo
                    ? `${proximaDataDoDia(turma.diaSemana, hoje).split("-").reverse().join("/")} ${turma.horario}`
                    : "Turma inativa"
                  : proximas.map((a) => `${fmtDateBR(a.data)} ${fmtTime(a.data)}`).join(" · ")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      {verAlunos && (
        <Card>
          <CardHeader><CardTitle className="text-base">Alunos matriculados</CardTitle></CardHeader>
          <CardContent>
            {turma.matriculas.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aluno matriculado.</p>}
            <ul className="divide-y">
              {turma.matriculas.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{m.aluno.nome}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">desde {fmtDateBR(m.dataInicio)}</span>
                    {staff && <DesmatricularBotao alunoId={m.alunoId} turmaId={turma.id} nome={m.aluno.nome} />}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {staff && (
        <Card>
          <CardHeader><CardTitle className="text-base">Matricular aluno</CardTitle></CardHeader>
          <CardContent>
            <MatricularAluno turmaId={turma.id} hoje={todayStr()} opcoes={opcoesAlunos} cheia={turma.matriculas.length >= turma.vagas} />
          </CardContent>
        </Card>
      )}
      {staff && o && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dados da turma</CardTitle></CardHeader>
          <CardContent>
            <TurmaForm
              id={turma.id}
              {...o}
              defaults={{ nome: turma.nome, instrumentoId: turma.instrumentoId, professorId: turma.professorId, salaId: turma.salaId ?? "", diaSemana: turma.diaSemana, horario: turma.horario, duracaoMin: turma.duracaoMin, vagas: turma.vagas }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
