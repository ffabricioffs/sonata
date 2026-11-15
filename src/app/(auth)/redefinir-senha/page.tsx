import Link from "next/link"
import { AuthShell } from "@/components/auth-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buscarTokenValido, MSG_LINK_INVALIDO } from "@/lib/recuperacao"
import { RedefinirForm } from "./redefinir-form"

export const dynamic = "force-dynamic"

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const t = await buscarTokenValido(token)
  return (
    <AuthShell subtitulo="Crie uma nova senha">
      {t && token ? (
        <RedefinirForm token={token} nome={t.usuario.nome} />
      ) : (
        // CT07 — link expirado, já usado ou inexistente
        <Card>
          <CardHeader>
            <CardTitle>Link indisponível</CardTitle>
            <CardDescription role="alert">{MSG_LINK_INVALIDO}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">Pedir um novo link</Link>
          </CardContent>
        </Card>
      )}
    </AuthShell>
  )
}
