"use client"

import { useActionState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FormAlert, SubmitButton } from "@/components/form-bits"
import type { FormState } from "@/lib/form-state"
import { DICA_SENHA } from "@/lib/validations/senha"
import { redefinirSenha } from "../recuperar-senha/actions"

export function RedefinirForm({ token, nome }: { token: string; nome: string }) {
  const [state, action] = useActionState<FormState, FormData>(redefinirSenha.bind(null, token), {})
  const fe = state.fieldErrors ?? {}
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
        <CardDescription>Olá, {nome}. Escolha a nova senha da sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} noValidate className="space-y-4">
          <FormAlert state={state} />
          <Field label="Nova senha" name="senha" error={fe.senha} hint={DICA_SENHA}>
            <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Confirme a nova senha" name="confirmacao" error={fe.confirmacao}>
            <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
          </Field>
          <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
