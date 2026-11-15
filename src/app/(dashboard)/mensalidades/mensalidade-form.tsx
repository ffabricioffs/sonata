"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Input } from "@/components/ui/input"
import { Select, Textarea } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Field, FormAlert, SubmitButton } from "@/components/form-bits"
import { keepValues, type FormState } from "@/lib/form-state"
import { MESES } from "@/lib/validations/mensalidade"
import { salvarMensalidade } from "./actions"

type Opt = { id: string; nome: string }
export type MensalidadeDefaults = { alunoId?: string; mes?: string; ano?: string; valor?: string; vencimento?: string; observacao?: string }

export function MensalidadeForm({ id, alunos, defaults = {} }: { id: string | null; alunos: Opt[]; defaults?: MensalidadeDefaults }) {
  const [state, action] = useActionState<FormState, FormData>(keepValues(salvarMensalidade, id), {})
  const fe = state.fieldErrors ?? {}
  const d = (k: keyof MensalidadeDefaults) => state.values?.[k] ?? defaults[k] ?? ""
  return (
    <form action={action} noValidate className="space-y-6 max-w-3xl">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Aluno *" name="alunoId" error={fe.alunoId} className="space-y-2 sm:col-span-2">
          <Select key={`a-${d("alunoId")}`} id="alunoId" name="alunoId" defaultValue={d("alunoId")} required>
            <option value="">Selecione…</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <Field label="Mês de referência *" name="mes" error={fe.mes}>
          <Select key={`m-${d("mes")}`} id="mes" name="mes" defaultValue={d("mes")} required>
            <option value="">Selecione…</option>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Ano *" name="ano" error={fe.ano}>
          <Input id="ano" name="ano" type="number" min={2020} max={2100} defaultValue={d("ano")} required />
        </Field>
        <Field label="Valor (R$) *" name="valor" error={fe.valor} hint="Ex.: 250,00">
          <Input id="valor" name="valor" inputMode="decimal" placeholder="0,00" defaultValue={d("valor")} required />
        </Field>
        <Field label="Vencimento *" name="vencimento" error={fe.vencimento}>
          <Input id="vencimento" name="vencimento" type="date" defaultValue={d("vencimento")} required />
        </Field>
        <Field label="Observação" name="observacao" error={fe.observacao} className="space-y-2 sm:col-span-2">
          <Textarea id="observacao" name="observacao" maxLength={200} defaultValue={d("observacao")} />
        </Field>
      </div>
      <div className="flex gap-3">
        <SubmitButton>{id ? "Salvar alterações" : "Registrar mensalidade"}</SubmitButton>
        <Button asChild variant="outline"><Link href="/mensalidades">Cancelar</Link></Button>
      </div>
    </form>
  )
}
