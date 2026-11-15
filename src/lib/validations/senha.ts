import { z } from "zod"

/** Quadro A.2 / CT08 — regra única de senha forte, usada em todo lugar onde se define senha. */
export const MSG_SENHA_FRACA = "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula e número."
export const DICA_SENHA = "Mínimo de 8 caracteres, com letra maiúscula, letra minúscula e número."

export const senhaForte = z
  .string()
  .min(8, MSG_SENHA_FRACA)
  .regex(/[A-Z]/, MSG_SENHA_FRACA)
  .regex(/[a-z]/, MSG_SENHA_FRACA)
  .regex(/\d/, MSG_SENHA_FRACA)
