"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FormAlert, SubmitButton } from "@/components/form-bits"
import type { FormState } from "@/lib/form-state"
import { solicitarRecuperacao } from "./actions"

export function RecuperarForm() {
  const [state, action] = useActionState<FormState, FormData>(solicitarRecuperacao, {})
  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.ok ? (
          <div className="space-y-4">
            <p className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800" role="status">
              {state.message}
            </p>
            <Link href="/login" className="text-sm text-primary hover:underline">← Voltar para o login</Link>
          </div>
        ) : (
          <form action={action} noValidate className="space-y-4">
            <FormAlert state={state} />
            <Field label="E-mail" name="email" error={state.fieldErrors?.email}>
              <Input id="email" name="email" type="email" placeholder="seu@email.com" autoComplete="email" required />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <Link href="/login" className="text-sm text-muted-foreground hover:underline">Voltar para o login</Link>
              <SubmitButton pendingText="Enviando…">Enviar link</SubmitButton>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
