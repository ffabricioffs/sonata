import { prisma } from "@/lib/prisma"
import { requireUser, STAFF } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })

/** Caixa de saída: os e-mails que o sistema enviou (recuperação de senha). Só a equipe vê. */
export default async function EmailsPage() {
  const user = await requireUser(STAFF)
  // A Secretaria não vê os e-mails de contas de administrador (o link daria acesso à conta)
  const ocultos =
    user.role === "ADMIN" ? [] : (await prisma.usuario.findMany({ where: { role: "ADMIN" }, select: { email: true } })).map((u) => u.email)
  const lista = await prisma.emailEnviado.findMany({ where: { para: { notIn: ocultos } }, orderBy: { createdAt: "desc" }, take: 50 })
  const real = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  return (
    <div className="space-y-6">
      <PageHeader
        title="E-mails enviados"
        description={
          real
            ? "Mensagens que o sistema enviou. Elas também saem de verdade pela Resend."
            : "Caixa de saída simulada: os e-mails ficam registrados aqui, sem envio real (as contas de demonstração usam endereços @exemplo.com)."
        }
      />
      <Card>
        <CardContent className="divide-y p-0">
          {lista.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nenhum e-mail enviado ainda.</p>}
          {lista.map((m) => (
            <details key={m.id} className="px-4 py-3 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{m.assunto}</span>
                  <span className="text-muted-foreground"> · para {m.para}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {fmt.format(m.createdAt)}
                  {m.enviado ? " · enviado" : " · só na caixa de saída"}
                </span>
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm">{m.corpo}</pre>
              {m.link && (
                <a href={m.link} className="mt-2 inline-block text-primary hover:underline">
                  Abrir o link do e-mail
                </a>
              )}
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
