import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/session"
import { Sidebar } from "@/components/sidebar"

// Layout exclusivo das páginas autenticadas.
// O proxy já bloqueia rotas, mas requireUser() aqui serve como
// segunda barreira e fornece os dados do usuário ao Sidebar.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // requireUser confere no banco se o usuário continua ativo (R02); inativo é desconectado
  const user = await requireUser()
  const naoLidas = await prisma.notificacao.count({ where: { usuarioId: user.id, lida: false } })

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar user={user} naoLidas={naoLidas} />
      <main className="flex-1 min-w-0 p-4 pt-20 lg:p-8 lg:pt-8 overflow-x-auto">{children}</main>
    </div>
  )
}
