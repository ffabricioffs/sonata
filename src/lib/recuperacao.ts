import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"

/** Validade do link de recuperação (CT07). */
export const VALIDADE_MIN = 60
/** CT05/CT06 — a mesma resposta para e-mail cadastrado ou não, para não revelar quem tem conta. */
export const MSG_ENVIO = `Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha. O link vale por ${VALIDADE_MIN} minutos.`
export const MSG_LINK_INVALIDO = "Este link de recuperação é inválido ou expirou. Solicite um novo."

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")
export const novoToken = () => randomBytes(32).toString("base64url")

/** Token válido = existe, não foi usado, não expirou e o usuário continua ativo. */
export async function buscarTokenValido(token: string | undefined) {
  if (!token || token.length < 20 || token.length > 100) return null
  const t = await prisma.tokenRecuperacao.findUnique({ where: { tokenHash: hashToken(token) }, include: { usuario: true } })
  if (!t || t.usadoEm || t.expiraEm < new Date() || !t.usuario.ativo) return null
  return t
}

/**
 * Endereço do site para montar o link. Usa APP_URL, ou o domínio de produção que a Vercel informa;
 * só em último caso o Host da requisição (que pode ser forjado fora da Vercel).
 */
export function origemDoSite(host: string | null, proto: string | null) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return `${proto ?? "http"}://${host ?? "localhost:3000"}`
}
