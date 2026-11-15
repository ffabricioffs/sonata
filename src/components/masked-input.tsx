"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { MASCARAS, type TipoMascara } from "@/lib/mascaras"

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue"> & {
  mascara: TipoMascara
  defaultValue?: string
}

/** Campo com máscara de CPF ou telefone, formatado enquanto a pessoa digita. */
export function MaskedInput({ mascara, defaultValue, onChange, ...props }: Props) {
  const formatar = MASCARAS[mascara]
  return (
    <Input
      {...props}
      inputMode="numeric"
      maxLength={mascara === "cpf" ? 14 : 15}
      defaultValue={formatar(defaultValue)}
      onChange={(e) => {
        const el = e.currentTarget
        const antes = el.value
        const depois = formatar(antes)
        if (depois !== antes) {
          // Mantém o cursor no fim do que foi digitado (o caso comum: digitação contínua)
          const noFim = el.selectionStart === antes.length
          el.value = depois
          if (noFim) el.setSelectionRange(depois.length, depois.length)
        }
        onChange?.(e)
      }}
    />
  )
}
