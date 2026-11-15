/** Utilitários dos testes: banco em memória com o seed, login simulado e execução de Server Actions. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as db from "./fake-prisma-client"
import { addDays, diaSemanaOf, todayStr, type DiaSemanaKey } from "../../src/lib/dates"

/** Próxima data (a partir de amanhã, ou da data dada) que cai no dia da semana pedido. */
export function proximo(dia: DiaSemanaKey, aPartirDe = addDays(todayStr(), 1)): string {
  let d = aPartirDe
  while (diaSemanaOf(d) !== dia) d = addDays(d, 1)
  return d
}

let base: any = null

/** Recria o banco em memória a partir do prisma/seed.ts real (equivale ao `npm run db:seed`). */
export async function prepararBanco() {
  if (!base) {
    // referência do seed = próxima segunda-feira, para as datas relativas (aulas, manutenção) valerem sempre
    process.env.SEED_DATE = proximo("SEGUNDA")
    const fim = db.aguardarDesconexao()
    const log = console.log
    console.log = () => {}
    await import("../../prisma/seed")
    await fim
    console.log = log
    base = db.snapshot()
  }
  db.restore(base)
  sair()
}

export const REF = () => process.env.SEED_DATE as string
export const tabela = (m: string) => db.rows(m)
export const usuarioPorEmail = (email: string) => db.rows("usuario").find((u) => u.email === email)
export const alunoPorNome = (nome: string) => db.rows("aluno").find((a) => a.nome === nome)
export const salaPorNome = (nome: string) => db.rows("sala").find((s) => s.nome === nome)
export const turmaPorNome = (nome: string) => db.rows("turma").find((t) => t.nome === nome)
export const professorPorNome = (nome: string) => {
  const u = db.rows("usuario").find((x) => x.nome === nome)
  return db.rows("professor").find((p) => p.usuarioId === u?.id)
}
export const instrumentoPorNome = (nome: string) => db.rows("instrumento").find((i) => i.nome === nome)

/** Simula a sessão do Auth.js (JWT com id e role) para o usuário do seed. */
export function entrarComo(email: string) {
  const u = usuarioPorEmail(email)
  if (!u) throw new Error(`usuário ${email} não existe no seed`)
  ;(globalThis as any).__sonataSessao = { user: { id: u.id, email: u.email, name: u.nome, role: u.role } }
  return u
}
export function sair() {
  ;(globalThis as any).__sonataSessao = null
}

export function form(campos: Record<string, string | number | undefined>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) fd.append(k, String(v))
  return fd
}

export type Resultado = { estado?: any; redirect?: string; ok?: string | null }

/** Executa uma Server Action; se ela redirecionar (sucesso), devolve a URL e a mensagem ?ok=. */
export async function executar(fn: () => Promise<any>): Promise<Resultado> {
  try {
    return { estado: await fn() }
  } catch (e: any) {
    const digest: string | undefined = e?.digest
    if (digest?.startsWith("NEXT_REDIRECT")) {
      const url = digest.split(";")[2]!
      return { redirect: url, ok: new URL(url, "http://sonata.local").searchParams.get("ok") }
    }
    throw e
  }
}

/** Mensagem que o usuário vê: a de sucesso (flash/estado) ou a de erro. */
export const mensagem = (r: Resultado) => r.ok ?? r.estado?.message ?? r.estado?.error ?? null
