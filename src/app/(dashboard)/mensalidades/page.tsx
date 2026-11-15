import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireUser, isStaff } from "@/lib/session"
import { fmtDateBR, todayStr } from "@/lib/dates"
import { PageHeader, DataTable, EmptyRow } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ActionButton } from "@/components/form-bits"
import { Flash } from "@/components/flash"
import { competenciaLabel, fmtBRL, MESES } from "@/lib/validations/mensalidade"
import { desfazerQuitacao, excluirMensalidade, quitarMensalidade } from "./actions"

type Situacao = "paga" | "atrasada" | "aberta"
const FILTROS = [
  { k: "", label: "Todas" },
  { k: "aberta", label: "Em aberto" },
  { k: "atrasada", label: "Em atraso" },
  { k: "paga", label: "Pagas" },
] as const

export default async function MensalidadesPage({ searchParams }: { searchParams: Promise<{ ok?: string; mes?: string; ano?: string; situacao?: string }> }) {
  const user = await requireUser(["ADMIN", "SECRETARIA", "ALUNO"])
  const sp = await searchParams
  const staff = isStaff(user.role)
  const hoje = todayStr()
  const [anoHoje, mesHoje] = hoje.split("-").map(Number)
  const mes = Math.min(12, Math.max(1, Number(sp.mes) || mesHoje))
  const ano = Number(sp.ano) || anoHoje
  const situacaoDe = (p: { pago: boolean; vencimento: Date }): Situacao =>
    p.pago ? "paga" : p.vencimento.toISOString().slice(0, 10) < hoje ? "atrasada" : "aberta"

  // Aluno: todas as suas mensalidades. Equipe: as do mês escolhido.
  const aluno = staff ? null : await prisma.aluno.findUnique({ where: { usuarioId: user.id } })
  const lista = await prisma.pagamento.findMany({
    where: staff ? { mes, ano } : { alunoId: aluno?.id ?? "-" },
    include: { aluno: true },
    orderBy: staff ? [{ aluno: { nome: "asc" } }] : [{ ano: "desc" }, { mes: "desc" }],
  })
  const total = (xs: typeof lista) => xs.reduce((s, p) => s + Number(p.valor), 0)
  const pagas = lista.filter((p) => p.pago)
  const atrasadas = lista.filter((p) => situacaoDe(p) === "atrasada")
  const abertas = lista.filter((p) => !p.pago)
  const filtro = FILTROS.some((f) => f.k === sp.situacao) ? (sp.situacao as Situacao) : ""
  const visiveis = filtro ? lista.filter((p) => situacaoDe(p) === filtro) : lista

  const anterior = mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano }
  const proxima = mes === 12 ? { mes: 1, ano: ano + 1 } : { mes: mes + 1, ano }
  const url = (m: number, a: number, s = filtro) => `/mensalidades?mes=${m}&ano=${a}${s ? `&situacao=${s}` : ""}`
  const badge = (s: Situacao) =>
    s === "paga" ? <Badge variant="default">Paga</Badge> : s === "atrasada" ? <Badge variant="destructive">Em atraso</Badge> : <Badge variant="outline">Em aberto</Badge>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensalidades"
        description={staff ? `Competência ${MESES[mes - 1]} de ${ano}.` : "Suas mensalidades."}
        action={staff ? { href: `/mensalidades/nova?mes=${mes}&ano=${ano}`, label: "Nova mensalidade" } : undefined}
      />
      <Flash msg={sp.ok} />

      {staff && (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href={url(anterior.mes, anterior.ano)}>← {competenciaLabel(anterior.mes, anterior.ano)}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={url(mesHoje, anoHoje)}>Mês atual</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={url(proxima.mes, proxima.ano)}>{competenciaLabel(proxima.mes, proxima.ano)} →</Link></Button>
          <span className="mx-1 text-muted-foreground">|</span>
          {FILTROS.map((f) => (
            <Button key={f.k} asChild variant={filtro === f.k ? "default" : "outline"} size="sm">
              <Link href={url(mes, ano, f.k)}>{f.label}</Link>
            </Button>
          ))}
          <span className="ml-auto" />
          <Button asChild variant="secondary" size="sm"><Link href={`/mensalidades/gerar?mes=${mes}&ano=${ano}`}>Gerar mensalidades do mês</Link></Button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { t: "Previsto", v: fmtBRL(total(lista)), d: `${lista.length} mensalidade(s)` },
          { t: "Recebido", v: fmtBRL(total(pagas)), d: `${pagas.length} paga(s)` },
          { t: "Em aberto", v: fmtBRL(total(abertas)), d: `${abertas.length} a receber` },
          { t: "Em atraso", v: fmtBRL(total(atrasadas)), d: `${atrasadas.length} vencida(s)` },
        ].map((k) => (
          <Card key={k.t} className="min-w-0">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{k.t}</p>
              <p className="text-xl font-bold tabular-nums truncate">{k.v}</p>
              <p className="text-xs text-muted-foreground">{k.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable head={staff ? ["Aluno", "Valor", "Vencimento", "Situação", "Pagamento", ""] : ["Competência", "Valor", "Vencimento", "Situação", "Pagamento"]}>
        {visiveis.length === 0 && (
          <EmptyRow colSpan={staff ? 6 : 5}>
            {staff ? "Nenhuma mensalidade nesta competência. Use \"Gerar mensalidades do mês\" ou \"Nova mensalidade\"." : "Nenhuma mensalidade registrada."}
          </EmptyRow>
        )}
        {visiveis.map((p) => {
          const s = situacaoDe(p)
          return (
            <tr key={p.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">
                {staff ? p.aluno.nome : competenciaLabel(p.mes, p.ano)}
                {p.observacao && <span className="block text-xs font-normal text-muted-foreground">{p.observacao}</span>}
              </td>
              <td className="px-4 py-3 tabular-nums">{fmtBRL(p.valor)}</td>
              <td className="px-4 py-3 tabular-nums">{fmtDateBR(p.vencimento)}</td>
              <td className="px-4 py-3">{badge(s)}</td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.dataPagto ? fmtDateBR(p.dataPagto) : "—"}</td>
              {staff && (
                <td className="px-4 py-3">
                  <div className="flex items-start justify-end gap-2">
                    {p.pago ? (
                      <ActionButton action={desfazerQuitacao.bind(null, p.id)} variant="ghost" confirmText="Desfazer a quitação? A mensalidade volta para em aberto.">Desfazer</ActionButton>
                    ) : (
                      <>
                        <ActionButton action={quitarMensalidade.bind(null, p.id)} variant="default" confirmText={`Quitar a mensalidade de ${p.aluno.nome} (${fmtBRL(p.valor)}) com a data de hoje?`}>Quitar</ActionButton>
                        <Button asChild variant="ghost" size="sm"><Link href={`/mensalidades/editar?id=${p.id}`}>Editar</Link></Button>
                        <ActionButton action={excluirMensalidade.bind(null, p.id)} variant="ghost" confirmText="Excluir esta mensalidade?">Excluir</ActionButton>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}
