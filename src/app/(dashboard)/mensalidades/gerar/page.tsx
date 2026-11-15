import { prisma } from "@/lib/prisma"
import { requireUser, STAFF } from "@/lib/session"
import { todayStr } from "@/lib/dates"
import { PageHeader } from "@/components/page-header"
import { GerarForm } from "./gerar-form"

export default async function GerarMensalidadesPage({ searchParams }: { searchParams: Promise<{ mes?: string; ano?: string }> }) {
  await requireUser(STAFF)
  const sp = await searchParams
  const [anoHoje, mesHoje] = todayStr().split("-")
  const mes = sp.mes ?? String(Number(mesHoje))
  const ano = sp.ano ?? anoHoje
  const n = await prisma.aluno.count({ where: { ativo: true, matriculas: { some: { ativo: true } } } })
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerar mensalidades do mês"
        description={`Cria a mensalidade do mês para os ${n} aluno(s) ativo(s) com matrícula ativa. Quem já tem mensalidade nesse mês é ignorado.`}
      />
      <GerarForm mes={mes} ano={ano} />
    </div>
  )
}
