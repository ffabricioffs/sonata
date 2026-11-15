"use client"

import { Button } from "@/components/ui/button"

/** Erro inesperado numa tela do sistema: mensagem em português e opção de tentar de novo. */
export default function ErroNoSistema({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado ao carregar esta tela</h1>
      <p className="text-sm text-muted-foreground">Tente de novo. Se o problema continuar, recarregue a página ou volte ao painel.</p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => reset()}>Tentar de novo</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Voltar ao painel</Button>
      </div>
    </div>
  )
}
