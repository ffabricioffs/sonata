import { signOut } from "@/auth"

/** Encerra a sessão (usado quando o usuário foi inativado com a sessão aberta — R02). */
export async function GET() {
  await signOut({ redirectTo: "/login?inativo=1" })
}
