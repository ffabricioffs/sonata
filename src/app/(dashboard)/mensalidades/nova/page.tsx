import { prisma } from "@/lib/prisma"
import { requireUser, STAFF } from "@/lib/session"
import { todayStr } from "@/lib/dates"
import { PageHeader } from "@/components/page-header"
import { MensalidadeForm } from "../mensalidade-form"

export default async function NovaMensalidadePage({ searchParams }: { searchParams: Promise<{ mes?: string; ano?: string }> }) {
  await requireUser(STAFF)
  const sp = await searchParams
  const [anoHoje, mesHoje] = todayStr().split("-")
  const mes = sp.mes ?? String(Number(mesHoje))
  const ano = sp.ano ?? anoHoje
  const alunos = await prisma.aluno.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
  return (
    <div className="space-y-6">
      <PageHeader title="Nova mensalidade" description="Registre a mensalidade de um aluno. Cada aluno tem no máximo uma mensalidade por mês." />
      <MensalidadeForm id={null} alunos={alunos} defaults={{ mes, ano, vencimento: `${ano}-${mes.padStart(2, "0")}-10` }} />
    </div>
  )
}
