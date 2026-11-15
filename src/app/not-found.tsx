import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AuthShell } from "@/components/auth-shell"

/** Página não encontrada (404), em português (RNF001: mensagens em português). */
export default function NaoEncontrada() {
  return (
    <AuthShell subtitulo="Página não encontrada">
      <div className="space-y-4 rounded-lg border bg-card p-6 text-center text-sm">
        <p className="text-4xl font-bold">404</p>
        <p>O endereço que você abriu não existe ou você não tem acesso a esta página.</p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Voltar ao painel</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
