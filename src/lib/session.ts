import { cache } from "react"
import { redirect } from "next/navigation"
import type { UserRole } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type Role = UserRole
export const STAFF: Role[] = ["ADMIN", "SECRETARIA"]
export const isStaff = (role?: Role | null) => role === "ADMIN" || role === "SECRETARIA"

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  SECRETARIA: "Secretaria",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
}

export const MSG_ACESSO_DESATIVADO = "Seu acesso foi desativado. Procure a secretaria."

/**
 * R02 / RNF005 — o JWT vale 30 dias, então o perfil e o "ativo" são conferidos no banco a cada
 * página e a cada Server Action. Usuário inativado (ou excluído) perde o acesso na hora,
 * e mudanças de perfil passam a valer sem novo login.
 * cache(): o layout e a página da mesma requisição compartilham uma única consulta.
 */
const usuarioAtual = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return { session: null, ativo: false as const }
  const u = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { ativo: true, role: true, nome: true, email: true } })
  if (!u || !u.ativo) return { session, ativo: false as const }
  return { session, ativo: true as const, user: { ...session.user, role: u.role, name: u.nome, email: u.email } }
})

/** Para páginas: exige login ativo e (opcionalmente) um dos perfis; senão redireciona. */
export async function requireUser(roles?: Role[]) {
  const r = await usuarioAtual()
  if (!r.session) redirect("/login")
  // Sessão aberta de usuário inativado: encerra o cookie em /sair e volta ao login
  if (!r.ativo) redirect("/sair")
  if (roles && !roles.includes(r.user.role)) redirect("/dashboard")
  return r.user
}

/** Para Server Actions: lança erro (tratado pela action) se não houver permissão. */
export async function assertRole(roles: Role[]) {
  const r = await usuarioAtual()
  if (r.session && !r.ativo) throw new Error(MSG_ACESSO_DESATIVADO)
  if (!r.ativo || !roles.includes(r.user.role)) {
    throw new Error("Você não tem permissão para esta ação.")
  }
  return r.user
}
