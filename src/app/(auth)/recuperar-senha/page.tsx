import { AuthShell } from "@/components/auth-shell"
import { RecuperarForm } from "./recuperar-form"

export default function RecuperarSenhaPage() {
  return (
    <AuthShell subtitulo="Recupere o acesso à sua conta">
      <RecuperarForm />
    </AuthShell>
  )
}
