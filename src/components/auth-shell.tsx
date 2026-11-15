import { Music } from "lucide-react"

/** Moldura das telas sem login (entrar, recuperar e redefinir senha). */
export function AuthShell({ subtitulo, children }: { subtitulo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Music className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Sonata, um Web App para Escolas de Música</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
