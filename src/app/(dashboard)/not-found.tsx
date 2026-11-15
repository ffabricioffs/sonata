import Link from "next/link"
import { Button } from "@/components/ui/button"

/** 404 dentro do sistema: mantém o menu lateral e explica em português. */
export default function NaoEncontradaNoSistema() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <p className="text-4xl font-bold">404</p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O registro que você procurou não existe, foi excluído ou não está disponível para o seu perfil.</p>
      <Button asChild>
        <Link href="/dashboard">Voltar ao painel</Link>
      </Button>
    </div>
  )
}
