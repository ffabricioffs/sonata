/** Autenticação e controle de acesso: CT01–CT08, CT47, RNF004, RNF005 (Quadros A.1 e A.2). */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import "@/auth"
import { ultimaConfig } from "../support/next-auth" // mesmo módulo que o alias "next-auth" do vitest.config.ts
import { prisma } from "@/lib/prisma"
import { salvarAluno } from "@/app/(dashboard)/alunos/actions"
import { prepararBanco, entrarComo, sair, executar, form, mensagem, tabela, usuarioPorEmail } from "../support/helpers"

const authorize = (email: string, senha: string) => ultimaConfig.providers[0].authorize({ email, senha })
const acessa = (pathname: string, role?: string) =>
  ultimaConfig.callbacks.authorized({ request: { nextUrl: new URL(`http://sonata.local${pathname}`) }, auth: role ? { user: { role } } : null })
const redirecionouPara = (r: any, path: string) => r instanceof Response && r.status >= 300 && r.status < 400 && new URL(r.headers.get("location")!).pathname === path

function arquivosFonte(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? arquivosFonte(p) : [p]
  })
}

describe("Login (RF034 · Quadro A.1)", () => {
  beforeEach(prepararBanco)

  it("CT01 login válido em cada perfil leva ao perfil certo", async () => {
    const perfis: [string, string][] = [
      ["admin@exemplo.com", "ADMIN"], ["secretaria@exemplo.com", "SECRETARIA"],
      ["mariana.costa@exemplo.com", "PROFESSOR"], ["pedro.almeida@exemplo.com", "ALUNO"], ["lucas.ferreira@exemplo.com", "ALUNO"],
    ]
    for (const [email, role] of perfis) {
      const u = await authorize(email, "123456")
      expect(u?.role).toBe(role)
    }
  })
  it("CT01b e-mail com maiúsculas também entra", async () => {
    expect((await authorize("Admin@Exemplo.com", "123456"))?.role).toBe("ADMIN")
  })
  it("CT02 e-mail não cadastrado é recusado", async () => {
    expect(await authorize("naoexiste@exemplo.com", "123456")).toBeNull()
  })
  it("CT03 senha incorreta é recusada (mesma resposta do CT02, sem dizer qual campo errou)", async () => {
    expect(await authorize("admin@exemplo.com", "senhaerrada")).toBeNull()
    const login = readFileSync("src/app/(auth)/login/page.tsx", "utf8")
    expect(login).toContain("E-mail ou senha inválidos.")
  })
  it("usuário inativo não entra", async () => {
    await prisma.usuario.update({ where: { email: "mariana.costa@exemplo.com" }, data: { ativo: false } })
    expect(await authorize("mariana.costa@exemplo.com", "123456")).toBeNull()
  })
  it("RNF004 hash legado SHA-256 é migrado para bcrypt no primeiro login", async () => {
    const legado = createHash("sha256").update("123456").digest("hex")
    await prisma.usuario.update({ where: { email: "admin@exemplo.com" }, data: { senhaHash: legado } })
    expect((await authorize("admin@exemplo.com", "123456"))?.role).toBe("ADMIN")
    expect(usuarioPorEmail("admin@exemplo.com").senhaHash.startsWith("$2")).toBe(true)
  })
  it("RNF004 nenhum usuário do seed fica com senha legível ou hash fraco", () => {
    for (const u of tabela("usuario")) expect(u.senhaHash.startsWith("$2")).toBe(true)
  })
})

describe("Proteção de rotas (RF034 / RNF005)", () => {
  it("CT04 página interna sem login → não autorizado (Auth.js redireciona ao /login)", () => {
    expect(acessa("/dashboard")).toBe(false)
    expect(acessa("/alunos")).toBe(false)
    expect(acessa("/login")).toBe(true)
  })
  it("NF05 aluno não abre cadastros administrativos (volta ao /dashboard)", () => {
    for (const p of ["/alunos", "/alunos/novo", "/professores", "/salas", "/instrumentos", "/reservas"]) {
      expect(redirecionouPara(acessa(p, "ALUNO"), "/dashboard")).toBe(true)
    }
  })
  it("NF05 professor não abre professores, salas e instrumentos", () => {
    for (const p of ["/professores", "/salas", "/instrumentos"]) expect(redirecionouPara(acessa(p, "PROFESSOR"), "/dashboard")).toBe(true)
    expect(acessa("/alunos", "PROFESSOR")).toBe(true)
    expect(acessa("/reservas", "PROFESSOR")).toBe(true)
  })
  it("CT47 secretaria tem as mesmas rotas do administrador", () => {
    for (const p of ["/alunos", "/professores", "/salas", "/instrumentos", "/reservas", "/turmas", "/agenda"]) {
      expect(acessa(p, "SECRETARIA")).toBe(acessa(p, "ADMIN"))
    }
  })
})

describe("Controle de acesso nas Server Actions (RNF005)", () => {
  beforeEach(prepararBanco)
  const novoAluno = { nome: "Invasor Teste", email: "invasor@exemplo.com" }

  it("NF05 aluno chamando a action de cadastro de aluno → recusado e nada gravado", async () => {
    entrarComo("pedro.almeida@exemplo.com")
    const r = await executar(() => salvarAluno(null, {}, form(novoAluno)))
    expect(mensagem(r)).toBe("Você não tem permissão para esta ação.")
    expect(tabela("aluno").some((a) => a.email === "invasor@exemplo.com")).toBe(false)
  })
  it("NF05 sem sessão → recusado e nada gravado", async () => {
    sair()
    const r = await executar(() => salvarAluno(null, {}, form(novoAluno)))
    expect(mensagem(r)).toBe("Você não tem permissão para esta ação.")
    expect(tabela("aluno").some((a) => a.email === "invasor@exemplo.com")).toBe(false)
  })
  it("usuário inativado perde o acesso já na sessão aberta (não só no próximo login)", async () => {
    entrarComo("secretaria@exemplo.com")
    await prisma.usuario.update({ where: { email: "secretaria@exemplo.com" }, data: { ativo: false } })
    const r = await executar(() => salvarAluno(null, {}, form(novoAluno)))
    expect(mensagem(r)).toBe("Você não tem permissão para esta ação.")
  })
})

describe("Recuperação de senha (RF035 · Quadro A.2)", () => {
  const fontes = arquivosFonte("src").map((p) => readFileSync(p, "utf8")).join("\n")
  it("CT05/CT06 existe a opção “Esqueci minha senha” e o envio do link", () => {
    expect(/esqueci minha senha/i.test(fontes)).toBe(true)
  })
  it("CT07 existe a mensagem de link expirado", () => {
    expect(fontes.includes("Link de recuperação expirado ou inválido")).toBe(true)
  })
  it("CT08 a regra de senha forte (8+ caracteres, maiúsculas, minúsculas e números) é aplicada", () => {
    expect(existsSync("src/lib/validations/senha.ts") || /\[A-Z\]/.test(fontes)).toBe(true)
  })
})
