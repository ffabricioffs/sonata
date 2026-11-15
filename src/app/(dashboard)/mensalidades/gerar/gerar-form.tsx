"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Field, FormAlert, SubmitButton } from "@/components/form-bits"
import { keepValues, type FormState } from "@/lib/form-state"
import { MESES, urlMensalidades } from "@/lib/validations/mensalidade"
import { gerarMensalidadesDoMes } from "../actions"

export function GerarForm({ mes, ano }: { mes: string; ano: string }) {
  const [state, action] = useActionState<FormState, FormData>(keepValues(gerarMensalidadesDoMes), {})
  const fe = state.fieldErrors ?? {}
  const d = (k: string, def: string) => state.values?.[k] ?? def
  return (
    <form action={action} noValidate className="space-y-6 max-w-3xl">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mês de referência *" name="mes" error={fe.mes}>
          <Select key={`m-${d("mes", mes)}`} id="mes" name="mes" defaultValue={d("mes", mes)} required>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Ano *" name="ano" error={fe.ano}>
          <Input id="ano" name="ano" type="number" min={2020} max={2100} defaultValue={d("ano", ano)} required />
        </Field>
        <Field label="Valor de cada mensalidade (R$) *" name="valor" error={fe.valor} hint="Ex.: 250,00">
          <Input id="valor" name="valor" inputMode="decimal" placeholder="0,00" defaultValue={d("valor", "")} required />
        </Field>
        <Field label="Dia do vencimento *" name="diaVencimento" error={fe.diaVencimento} hint="Entre 1 e 28.">
          <Input id="diaVencimento" name="diaVencimento" type="number" min={1} max={28} defaultValue={d("diaVencimento", "10")} required />
        </Field>
      </div>
      <div className="flex gap-3">
        <SubmitButton pendingText="Gerando…">Gerar mensalidades</SubmitButton>
        <Button asChild variant="outline"><Link href={urlMensalidades(mes, ano)}>Cancelar</Link></Button>
      </div>
    </form>
  )
}
