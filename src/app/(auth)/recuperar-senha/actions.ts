"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"
import { enviarEmail } from "@/lib/email"
import { senhaForte } from "@/lib/validations/senha"
import { buscarTokenValido, hashToken, MSG_ENVIO, MSG_LINK_INVALIDO, novoToken, origemDoSite, VALIDADE_MIN } from "@/lib/recuperacao"
import { zodFieldErrors, type FormState } from "@/lib/form-state"

export async function solicitarRecuperacao(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Informe o e-mail cadastrado.", fieldErrors: { email: "Informe o e-mail" } }
  if (!z.string().email().safeParse(email).success) return { error: "Informe um e-mail válido.", fieldErrors: { email: "E-mail inválido" } }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (usuario?.ativo) {
      // Evita uma enxurrada de e-mails: no máximo um link por minuto para o mesmo usuário
      const recente = await prisma.tokenRecuperacao.findFirst({ where: { usuarioId: usuario.id, createdAt: { gt: new Date(Date.now() - 60_000) } } })
      if (!recente) {
        const token = novoToken()
        await prisma.$transaction([
          // Um link por vez: pedir de novo invalida os anteriores ainda não usados
          prisma.tokenRecuperacao.deleteMany({ where: { usuarioId: usuario.id, usadoEm: null } }),
          prisma.tokenRecuperacao.create({ data: { usuarioId: usuario.id, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + VALIDADE_MIN * 60_000) } }),
        ])
        const h = await headers()
        const link = `${origemDoSite(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"))}/redefinir-senha?token=${token}`
        await enviarEmail({
          para: usuario.email,
          assunto: "Sonata — redefinição de senha",
          link,
          texto: `Olá, ${usuario.nome}.\n\nRecebemos um pedido para redefinir a sua senha no Sonata. Para criar uma nova senha, abra o link abaixo (válido por ${VALIDADE_MIN} minutos, uma única vez):\n\n${link}\n\nSe você não fez este pedido, ignore este e-mail: a sua senha continua a mesma.`,
        })
      }
    }
  } catch {
    return { error: "Não foi possível processar o pedido agora. Tente novamente em instantes." }
  }
  return { ok: true, message: MSG_ENVIO }
}

export async function redefinirSenha(token: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const senha = String(fd.get("senha") ?? "")
  const confirmacao = String(fd.get("confirmacao") ?? "")
  try {
    const t = await buscarTokenValido(token)
    if (!t) return { error: MSG_LINK_INVALIDO }

    const parsed = senhaForte.safeParse(senha)
    if (!parsed.success) {
      const fe = zodFieldErrors(parsed.error)
      return { error: fe._ ?? "Corrija os campos destacados.", fieldErrors: { senha: fe._ ?? "Senha inválida" } }
    }
    if (senha !== confirmacao) return { error: "As senhas não conferem.", fieldErrors: { confirmacao: "Digite a mesma senha nos dois campos" } }

    await prisma.$transaction([
      prisma.usuario.update({ where: { id: t.usuarioId }, data: { senhaHash: await hashPassword(senha) } }),
      prisma.tokenRecuperacao.update({ where: { id: t.id }, data: { usadoEm: new Date() } }),
      prisma.tokenRecuperacao.deleteMany({ where: { usuarioId: t.usuarioId, usadoEm: null } }),
    ])
  } catch {
    return { error: "Não foi possível redefinir a senha agora. Tente novamente em instantes." }
  }
  redirect("/login?senha=redefinida")
}
