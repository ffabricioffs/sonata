import { redirect } from "next/navigation"

/** Endereço antigo da turma: a página de detalhe agora fica em /turmas/detalhe. */
export default async function TurmaPorId({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/turmas/detalhe?id=${encodeURIComponent(id)}`)
}
