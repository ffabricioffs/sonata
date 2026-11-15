"use client"

import { use, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Music } from "lucide-react"

export default function LoginPage({ searchParams }: { searchParams: Promise<{ inativo?: string; senha?: string }> }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  // Vindo de /sair: a sessão foi encerrada porque o usuário foi inativado (R02)
  const sp = use(searchParams)
  const inativo = sp.inativo === "1"
  const senhaRedefinida = sp.senha === "redefinida"
  const mensagemErro = erro || (inativo ? "Seu acesso foi desativado. Procure a secretaria." : "")

  const demos = process.env.NEXT_PUBLIC_DEMO_LOGINS === "true"
  const DEMO_ACCOUNTS = [
    { label: "Funcionário", email: "secretaria@exemplo.com" },
    { label: "Professor", email: "mariana.costa@exemplo.com" },
    { label: "Aluno", email: "lucas.ferreira@exemplo.com" },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro("")
    setCarregando(true)

    const resultado = await signIn("credentials", {
      email,
      senha,
      redirect: false,
    })

    setCarregando(false)

    if (resultado?.error) {
      setErro("E-mail ou senha inválidos.")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Marca */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Music className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Sonata, um Web App para Escolas de Música</h1>
          <p className="text-sm text-muted-foreground">
            Entre com suas credenciais para acessar o sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Use o email e senha fornecidos pelo administrador
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={carregando}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  <Link href="/recuperar-senha" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
                </div>
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={carregando}
                />
              </div>

              {senhaRedefinida && !mensagemErro && (
                <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800" role="status">
                  Senha redefinida. Entre com a nova senha.
                </p>
              )}

              {/* Feedback de erro */}
              {mensagemErro && (
                <p className="text-sm text-destructive font-medium" role="alert">
                  {mensagemErro}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={carregando}
              >
                {carregando ? "Entrando…" : "Entrar"}
              </Button>
            </form>

            {demos && (
              <div className="mt-6 border-t pt-4 space-y-2">
                <p className="text-xs text-muted-foreground">Contas de demonstração (senha 123456)</p>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map((d) => (
                    <Button
                      key={d.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmail(d.email)
                        setSenha("123456")
                      }}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
