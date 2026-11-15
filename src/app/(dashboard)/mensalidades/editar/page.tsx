import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireUser, STAFF } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { MensalidadeForm } from "../mensalidade-form"
import { urlMensalidades } from "@/lib/validations/mensalidade"

export default async function EditarMensalidadePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireUser(STAFF)
  const { id } = await searchParams
  if (!id) notFound()
  const p = await prisma.pagamento.findUnique({ where: { id }, include: { aluno: true } })
  if (!p) notFound()
  if (p.pago) redirect(urlMensalidades(p.mes, p.ano))
  const ativos = await prisma.aluno.findMany({ where: { OR: [{ ativo: true }, { id: p.alunoId }] }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
  return (
    <div className="space-y-6">
      <PageHeader title="Editar mensalidade" description={`${p.aluno.nome} · ${String(p.mes).padStart(2, "0")}/${p.ano}`} />
      <MensalidadeForm
        id={p.id}
        alunos={ativos}
        defaults={{
          alunoId: p.alunoId,
          mes: String(p.mes),
          ano: String(p.ano),
          valor: Number(p.valor).toFixed(2).replace(".", ","),
          vencimento: p.vencimento.toISOString().slice(0, 10),
          observacao: p.observacao ?? "",
        }}
      />
    </div>
  )
}
