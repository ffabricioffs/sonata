/** Recuperação de senha (RF035 · Quadro A.2): CT05–CT08, com o comportamento das Server Actions (15/11/2026). */
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { solicitarRecuperacao, redefinirSenha } from "@/app/(auth)/recuperar-senha/actions"
import { MSG_ENVIO, MSG_LINK_INVALIDO } from "@/lib/recuperacao"
import { MSG_SENHA_FRACA } from "@/lib/validations/senha"
import { prepararBanco, executar, form, mensagem, tabela, usuarioPorEmail } from "../support/helpers"

const LUCAS = "lucas.ferreira@exemplo.com"
const tokenDoLink = (link: string) => new URL(link).searchParams.get("token")!
const pedir = (email: string) => executar(() => solicitarRecuperacao({}, form({ email })))
async function linkDoLucas() {
  await pedir(LUCAS)
  const email = tabela("emailEnviado").find((m) => m.para === LUCAS)
  return tokenDoLink(email.link)
}
const redefinir = (token: string, senha: string, confirmacao = senha) => executar(() => redefinirSenha(token, {}, form({ senha, confirmacao })))

describe("Recuperação de senha (RF035)", () => {
  beforeEach(prepararBanco)

  it("CT05 e-mail cadastrado → mensagem neutra, e-mail na caixa de saída e link de 60 minutos", async () => {
    const r = await pedir(LUCAS)
    expect(mensagem(r)).toBe(MSG_ENVIO)
    const emails = tabela("emailEnviado").filter((m) => m.para === LUCAS)
    expect(emails).toHaveLength(1)
    expect(emails[0].link).toMatch(/\/redefinir-senha\?token=/)
    const tokens = tabela("tokenRecuperacao").filter((t) => t.usuarioId === usuarioPorEmail(LUCAS).id)
    expect(tokens).toHaveLength(1)
    const minutos = (new Date(tokens[0].expiraEm).getTime() - Date.now()) / 60_000
    expect(minutos).toBeGreaterThan(59)
    expect(minutos).toBeLessThanOrEqual(60)
    // só o hash fica no banco, nunca o token
    expect(tokens[0].tokenHash).not.toBe(tokenDoLink(emails[0].link))
  })
  it("CT06 e-mail inexistente → a mesma mensagem e nenhum e-mail ou token", async () => {
    const r = await pedir("naoexiste@exemplo.com")
    expect(mensagem(r)).toBe(MSG_ENVIO)
    expect(tabela("emailEnviado")).toHaveLength(0)
    expect(tabela("tokenRecuperacao")).toHaveLength(0)
  })
  it("e-mail vazio ou inválido tem mensagem própria", async () => {
    expect(mensagem(await pedir(""))).toBe("Informe o e-mail cadastrado.")
    expect(mensagem(await pedir("nao-e-email"))).toBe("Informe um e-mail válido.")
  })
  it("usuário inativo não recebe link", async () => {
    await prisma.usuario.update({ where: { email: LUCAS }, data: { ativo: false } })
    expect(mensagem(await pedir(LUCAS))).toBe(MSG_ENVIO)
    expect(tabela("emailEnviado")).toHaveLength(0)
  })
  it("pedir de novo em menos de 1 minuto não gera outro e-mail", async () => {
    await pedir(LUCAS)
    await pedir(LUCAS)
    expect(tabela("emailEnviado").filter((m) => m.para === LUCAS)).toHaveLength(1)
  })
  it("CT07 link inventado, sem token ou expirado → “Este link de recuperação é inválido ou expirou. Solicite um novo.”", async () => {
    expect(mensagem(await redefinir("token-inventado-com-mais-de-vinte-caracteres", "NovaSenha2026"))).toBe(MSG_LINK_INVALIDO)
    expect(mensagem(await redefinir("", "NovaSenha2026"))).toBe(MSG_LINK_INVALIDO)
    const token = await linkDoLucas()
    await prisma.tokenRecuperacao.updateMany({ where: { usuarioId: usuarioPorEmail(LUCAS).id }, data: { expiraEm: new Date(Date.now() - 60_000) } })
    expect(mensagem(await redefinir(token, "NovaSenha2026"))).toBe(MSG_LINK_INVALIDO)
  })
  it("CT08 senha nova fraca → mensagem da regra de senha forte; nada muda", async () => {
    const token = await linkDoLucas()
    const hashAntes = usuarioPorEmail(LUCAS).senhaHash
    for (const fraca of ["123456", "abcdefgh", "ABCDEFG1", "abcdefg1", "Abcdefgh"]) {
      expect(mensagem(await redefinir(token, fraca))).toBe(MSG_SENHA_FRACA)
    }
    expect(usuarioPorEmail(LUCAS).senhaHash).toBe(hashAntes)
  })
  it("confirmação diferente é recusada", async () => {
    const token = await linkDoLucas()
    expect(mensagem(await redefinir(token, "NovaSenha2026", "OutraSenha2026"))).toBe("As senhas não conferem.")
  })
  it("CT08 senha forte → volta ao login com “senha redefinida”; a antiga deixa de valer e o link não serve de novo", async () => {
    const token = await linkDoLucas()
    const r = await redefinir(token, "NovaSenha2026")
    expect(r.redirect).toBe("/login?senha=redefinida")
    const u = usuarioPorEmail(LUCAS)
    expect(await verifyPassword("NovaSenha2026", u.senhaHash)).toBe(true)
    expect(await verifyPassword("123456", u.senhaHash)).toBe(false)
    expect(tabela("tokenRecuperacao").find((t) => t.usuarioId === u.id)?.usadoEm).toBeTruthy()
    expect(mensagem(await redefinir(token, "OutraSenha2026"))).toBe(MSG_LINK_INVALIDO)
  })
})
