/**
 * Substituto em memória do @prisma/client para os testes de integração das Server Actions.
 *
 * Reproduz o que o código do Sonata usa do Prisma: findUnique/findFirst/findMany/count,
 * create/createMany/update/updateMany/upsert/delete/deleteMany, $transaction, filtros
 * (igualdade, not, in, gte/gt/lte/lt, contains+mode, OR/AND/NOT, some/none/every, relações 1:1),
 * include/select/_count/orderBy/take — e as MESMAS restrições do banco definidas nas migrações:
 * índices únicos (erro P2002), chaves estrangeiras RESTRICT/SET NULL/CASCADE (P2003) e
 * registro inexistente (P2025). As restrições são conferidas contra o PostgreSQL real em
 * tests/db/run-db-tests.sh.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Rel = { model: string; kind: "one" | "many"; from: string; to: string }
type Model = {
  rels: Record<string, Rel>
  uniques: string[][]
  defaults: () => Record<string, any>
  updatedAt?: boolean
}

let seq = 0
const cuid = () => `c${Date.now().toString(36)}${(seq++).toString(36).padStart(4, "0")}`
const base = () => ({ id: cuid(), createdAt: new Date() })

// one: este modelo guarda a FK (from = campo local, to = id do outro)
// many / one-reverso: o outro modelo guarda a FK (from = id local, to = campo no outro)
const one = (model: string, fk: string): Rel => ({ model, kind: "one", from: fk, to: "id" })
const rev = (model: string, fk: string): Rel => ({ model, kind: "one", from: "id", to: fk })
const many = (model: string, fk: string): Rel => ({ model, kind: "many", from: "id", to: fk })

export const MODELS: Record<string, Model> = {
  usuario: {
    rels: { professor: rev("professor", "usuarioId"), aluno: rev("aluno", "usuarioId"), reservas: many("reserva", "criadoPorId"), notificacoes: many("notificacao", "usuarioId") },
    uniques: [["id"], ["email"]],
    defaults: () => ({ ...base(), ativo: true }),
    updatedAt: true,
  },
  aluno: {
    rels: { usuario: one("usuario", "usuarioId"), matriculas: many("matricula", "alunoId"), pagamentos: many("pagamento", "alunoId"), solicitacoes: many("solicitacaoAula", "alunoId") },
    uniques: [["id"], ["email"], ["cpf"], ["usuarioId"]],
    defaults: () => ({ ...base(), ativo: true, telefone: null, dataNasc: null, cpf: null, usuarioId: null, responsavelNome: null, responsavelTelefone: null, observacoes: null }),
    updatedAt: true,
  },
  professor: {
    rels: { usuario: one("usuario", "usuarioId"), turmas: many("turma", "professorId"), reservas: many("reserva", "professorId"), solicitacoes: many("solicitacaoAula", "professorId") },
    uniques: [["id"], ["usuarioId"], ["cpf"]],
    defaults: () => ({ ...base(), telefone: null, bio: null, cpf: null, endereco: null, registroProfissional: null }),
    updatedAt: true,
  },
  instrumento: { rels: { turmas: many("turma", "instrumentoId") }, uniques: [["id"], ["nome"]], defaults: () => ({ id: cuid(), icone: null }) },
  sala: {
    rels: { turmas: many("turma", "salaId"), reservas: many("reserva", "salaId") },
    uniques: [["id"], ["nome"]],
    defaults: () => ({ id: cuid(), capacidade: 4, status: "DISPONIVEL", manutencaoAte: null, recursos: null }),
  },
  turma: {
    rels: { instrumento: one("instrumento", "instrumentoId"), professor: one("professor", "professorId"), sala: one("sala", "salaId"), matriculas: many("matricula", "turmaId"), aulas: many("aula", "turmaId") },
    uniques: [["id"]],
    defaults: () => ({ ...base(), salaId: null, duracaoMin: 60, vagas: 10, ativo: true }),
    updatedAt: true,
  },
  matricula: {
    rels: { aluno: one("aluno", "alunoId"), turma: one("turma", "turmaId") },
    uniques: [["id"], ["alunoId", "turmaId"]],
    defaults: () => ({ ...base(), dataFim: null, ativo: true }),
  },
  aula: {
    rels: { turma: one("turma", "turmaId"), solicitacoes: many("solicitacaoAula", "aulaPerdidaId") },
    uniques: [["id"]],
    defaults: () => ({ ...base(), realizada: false, observacao: null }),
  },
  pagamento: {
    rels: { aluno: one("aluno", "alunoId") },
    uniques: [["id"], ["alunoId", "mes", "ano"]],
    defaults: () => ({ ...base(), pago: false, dataPagto: null, observacao: null }),
  },
  reserva: {
    rels: { sala: one("sala", "salaId"), criadoPor: one("usuario", "criadoPorId"), professor: one("professor", "professorId"), solicitacao: rev("solicitacaoAula", "reservaId") },
    uniques: [["id"]],
    defaults: () => ({ ...base(), professorId: null, observacao: null, duracaoMin: 60, status: "ATIVA" }),
  },
  solicitacaoAula: {
    rels: { aluno: one("aluno", "alunoId"), professor: one("professor", "professorId"), aulaPerdida: one("aula", "aulaPerdidaId"), reserva: one("reserva", "reservaId") },
    uniques: [["id"], ["reservaId"]],
    defaults: () => ({ ...base(), duracaoMin: 60, aulaPerdidaId: null, status: "PENDENTE", decididoPorId: null, decididoEm: null, justificativa: null, reservaId: null }),
  },
  notificacao: { rels: { usuario: one("usuario", "usuarioId") }, uniques: [["id"]], defaults: () => ({ ...base(), link: null, lida: false }) },
}

// Ações de exclusão das chaves estrangeiras, iguais às migrações (prisma/migrations/*)
const ON_DELETE: Record<string, "SetNull" | "Cascade"> = {
  "aluno.usuarioId": "SetNull",
  "turma.salaId": "SetNull",
  "reserva.professorId": "SetNull",
  "solicitacaoAula.reservaId": "SetNull",
  "solicitacaoAula.aulaPerdidaId": "SetNull",
  "notificacao.usuarioId": "Cascade",
}

export class PrismaError extends Error {
  code: string
  meta?: any
  constructor(code: string, message: string, meta?: any) {
    super(message)
    this.code = code
    this.meta = meta
  }
}

// ---------------- estado ----------------
type Store = Record<string, any[]>
const emptyStore = (): Store => Object.fromEntries(Object.keys(MODELS).map((m) => [m, []]))
let store: Store = emptyStore()

const clone = <T>(v: T): T => structuredClone(v)
export const snapshot = () => clone(store)
export const restore = (s: Store) => {
  store = clone(s)
}
export const reset = () => {
  store = emptyStore()
}
export const rows = (model: string) => store[model]!

// ---------------- filtros ----------------
const isObj = (v: any) => v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)
const eq = (a: any, b: any) => (a instanceof Date || b instanceof Date ? a != null && b != null && new Date(a).getTime() === new Date(b).getTime() : a === b)
const cmp = (a: any, b: any) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? new Date(b).getTime() : b)

function matchScalar(val: any, cond: any): boolean {
  if (!isObj(cond)) return eq(val, cond)
  const insensitive = cond.mode === "insensitive"
  for (const [op, arg] of Object.entries(cond)) {
    if (op === "mode") continue
    if (op === "equals" && !eq(val, arg)) return false
    if (op === "not" && (isObj(arg) ? matchScalar(val, arg) : eq(val, arg))) return false
    if (op === "in" && !(arg as any[]).some((x) => eq(val, x))) return false
    if (op === "notIn" && (arg as any[]).some((x) => eq(val, x))) return false
    if (op === "gte" && !(val != null && cmp(val, arg) >= 0)) return false
    if (op === "gt" && !(val != null && cmp(val, arg) > 0)) return false
    if (op === "lte" && !(val != null && cmp(val, arg) <= 0)) return false
    if (op === "lt" && !(val != null && cmp(val, arg) < 0)) return false
    if (op === "contains") {
      if (typeof val !== "string") return false
      const [v, a] = insensitive ? [val.toLowerCase(), String(arg).toLowerCase()] : [val, String(arg)]
      if (!v.includes(a)) return false
    }
  }
  return true
}

function related(model: string, row: any, relName: string): any {
  const rel = MODELS[model]!.rels[relName]!
  const target = store[rel.model]!
  if (rel.kind === "many") return target.filter((r) => r[rel.to] === row[rel.from])
  if (row[rel.from] == null) return null
  return target.find((r) => r[rel.to] === row[rel.from]) ?? null
}

function expandCompound(model: string, where: any) {
  const out: any = {}
  for (const [k, v] of Object.entries(where ?? {})) {
    const u = MODELS[model]!.uniques.find((f) => f.length > 1 && f.join("_") === k)
    if (u && isObj(v)) Object.assign(out, v)
    else out[k] = v
  }
  return out
}

function matches(model: string, row: any, where: any): boolean {
  if (!where) return true
  where = expandCompound(model, where)
  for (const [k, cond] of Object.entries(where)) {
    if (cond === undefined) continue
    if (k === "OR") {
      if (!(cond as any[]).some((w) => matches(model, row, w))) return false
      continue
    }
    if (k === "AND") {
      const list = Array.isArray(cond) ? cond : [cond]
      if (!list.every((w) => matches(model, row, w))) return false
      continue
    }
    if (k === "NOT") {
      const list = Array.isArray(cond) ? cond : [cond]
      if (list.some((w) => matches(model, row, w))) return false
      continue
    }
    const rel = MODELS[model]!.rels[k]
    if (rel) {
      const relModel = rel.model
      if (rel.kind === "many") {
        const list = related(model, row, k) as any[]
        const c = cond as any
        if (c.some && !list.some((r) => matches(relModel, r, c.some))) return false
        if (c.none && list.some((r) => matches(relModel, r, c.none))) return false
        if (c.every && !list.every((r) => matches(relModel, r, c.every))) return false
      } else {
        const r = related(model, row, k)
        if (cond === null) {
          if (r !== null) return false
        } else {
          const c = cond as any
          const w = c.is ?? c
          if (!r || !matches(relModel, r, w)) return false
        }
      }
      continue
    }
    if (!matchScalar(row[k], cond)) return false
  }
  return true
}

// ---------------- leitura ----------------
function sortRows(model: string, list: any[], orderBy: any) {
  if (!orderBy) return list
  const keys = Array.isArray(orderBy) ? orderBy : [orderBy]
  const val = (m: string, r: any, ob: any): [any, string] => {
    const [k, v] = Object.entries(ob)[0]!
    if (isObj(v)) {
      const rel = MODELS[m]!.rels[k]!
      const r2 = related(m, r, k)
      return r2 ? val(rel.model, r2, v) : [null, "asc"]
    }
    return [r[k], v as string]
  }
  return [...list].sort((a, b) => {
    for (const ob of keys) {
      const [va, dir] = val(model, a, ob)
      const [vb] = val(model, b, ob)
      if (eq(va, vb)) continue
      const x = typeof va === "string" ? va.localeCompare(vb) : cmp(va, vb)
      return dir === "desc" ? -x : x
    }
    return 0
  })
}

function shape(model: string, row: any, args: { include?: any; select?: any }): any {
  const out: any = {}
  const sel = args.select
  if (sel) {
    for (const [k, v] of Object.entries(sel)) {
      if (!v) continue
      if (k === "_count") out._count = counts(model, row, (v as any).select)
      else if (MODELS[model]!.rels[k]) out[k] = relValue(model, row, k, v)
      else out[k] = clone(row[k])
    }
    return out
  }
  Object.assign(out, clone(row))
  for (const [k, v] of Object.entries(args.include ?? {})) {
    if (!v) continue
    if (k === "_count") out._count = counts(model, row, (v as any).select)
    else out[k] = relValue(model, row, k, v)
  }
  return out
}

function relValue(model: string, row: any, k: string, v: any) {
  const rel = MODELS[model]!.rels[k]!
  const sub = v === true ? {} : v
  if (rel.kind === "many") {
    let list = (related(model, row, k) as any[]).filter((r) => matches(rel.model, r, sub.where))
    list = sortRows(rel.model, list, sub.orderBy)
    if (sub.take) list = list.slice(0, sub.take)
    return list.map((r) => shape(rel.model, r, sub))
  }
  const r = related(model, row, k)
  return r ? shape(rel.model, r, sub) : null
}

function counts(model: string, row: any, sel: any) {
  const out: any = {}
  for (const [k, v] of Object.entries(sel ?? {})) {
    const rel = MODELS[model]!.rels[k]!
    const where = v === true ? undefined : (v as any).where
    out[k] = (related(model, row, k) as any[]).filter((r) => matches(rel.model, r, where)).length
  }
  return out
}

// ---------------- escrita ----------------
function checkUnique(model: string, row: any, ignoreId?: string) {
  for (const fields of MODELS[model]!.uniques) {
    if (fields.some((f) => row[f] == null)) continue
    const dup = store[model]!.find((r) => r.id !== ignoreId && fields.every((f) => eq(r[f], row[f])))
    if (dup) {
      throw new PrismaError("P2002", `Unique constraint failed on the fields: (${fields.map((f) => `\`${f}\``).join(",")})`, { modelName: model, target: fields })
    }
  }
}

function checkFks(model: string, row: any) {
  for (const [, rel] of Object.entries(MODELS[model]!.rels)) {
    if (rel.kind !== "one" || rel.to !== "id") continue
    const v = row[rel.from]
    if (v == null) continue
    if (!store[rel.model]!.some((r) => r.id === v)) {
      throw new PrismaError("P2003", `Foreign key constraint violated on the field: \`${rel.from}\``, { field_name: rel.from })
    }
  }
}

function applyData(model: string, row: any, data: any) {
  const nested: [string, any][] = []
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v === undefined) continue
    const rel = MODELS[model]!.rels[k]
    if (rel) {
      if ((v as any).connect) row[rel.from] = (v as any).connect.id
      else nested.push([k, v])
      continue
    }
    if (isObj(v) && "increment" in (v as any)) row[k] = (row[k] ?? 0) + (v as any).increment
    else if (isObj(v) && "set" in (v as any)) row[k] = (v as any).set
    else row[k] = v instanceof Date ? new Date(v) : v
  }
  return nested
}

function createRow(model: string, data: any) {
  const row = MODELS[model]!.defaults()
  if (MODELS[model]!.updatedAt) row.updatedAt = new Date()
  const nested = applyData(model, row, data)
  checkUnique(model, row)
  checkFks(model, row)
  store[model]!.push(row)
  for (const [k, v] of nested) {
    const rel = MODELS[model]!.rels[k]!
    const items = Array.isArray(v.create) ? v.create : [v.create]
    for (const it of items) createRow(rel.model, { ...it, [rel.to]: row[rel.from] })
  }
  return row
}

function deleteRow(model: string, row: any) {
  // chaves estrangeiras que apontam para este registro
  for (const [m, def] of Object.entries(MODELS)) {
    for (const rel of Object.values(def.rels)) {
      if (rel.kind !== "one" || rel.to !== "id" || rel.model !== model) continue
      const dependentes = store[m]!.filter((r) => r[rel.from] === row.id)
      if (!dependentes.length) continue
      const acao = ON_DELETE[`${m}.${rel.from}`]
      if (acao === "SetNull") dependentes.forEach((r) => (r[rel.from] = null))
      else if (acao === "Cascade") dependentes.forEach((r) => deleteRow(m, r))
      else throw new PrismaError("P2003", `Foreign key constraint violated: \`${m}_${rel.from}_fkey (index)\``, { field_name: `${m}_${rel.from}_fkey (index)` })
    }
  }
  store[model] = store[model]!.filter((r) => r !== row)
}

function delegate(model: string) {
  const find = (where: any) => store[model]!.filter((r) => matches(model, r, where))
  const notFound = () => new PrismaError("P2025", `No record was found for an operation on ${model}.`)
  return {
    async findUnique(a: any) {
      const r = find(a.where)[0]
      return r ? shape(model, r, a) : null
    },
    async findUniqueOrThrow(a: any) {
      const r = find(a.where)[0]
      if (!r) throw notFound()
      return shape(model, r, a)
    },
    async findFirst(a: any = {}) {
      const r = sortRows(model, find(a.where), a.orderBy)[0]
      return r ? shape(model, r, a) : null
    },
    async findMany(a: any = {}) {
      let list = sortRows(model, find(a.where), a.orderBy)
      if (a.take) list = list.slice(0, a.take)
      return list.map((r) => shape(model, r, a))
    },
    async count(a: any = {}) {
      return find(a.where).length
    },
    async create(a: any) {
      // create com relações aninhadas é atômico no Prisma: se algo falha, nada fica gravado
      const antes = snapshot()
      try {
        return shape(model, createRow(model, a.data), a)
      } catch (e) {
        restore(antes)
        throw e
      }
    },
    async createMany(a: any) {
      const list = Array.isArray(a.data) ? a.data : [a.data]
      list.forEach((d: any) => createRow(model, d))
      return { count: list.length }
    },
    async update(a: any) {
      const r = find(a.where)[0]
      if (!r) throw notFound()
      const novo = clone(r)
      applyData(model, novo, a.data)
      if (MODELS[model]!.updatedAt) novo.updatedAt = new Date()
      checkUnique(model, novo, r.id)
      checkFks(model, novo)
      Object.assign(r, novo)
      return shape(model, r, a)
    },
    async updateMany(a: any) {
      const list = find(a.where)
      for (const r of list) {
        const novo = clone(r)
        applyData(model, novo, a.data)
        checkUnique(model, novo, r.id)
        Object.assign(r, novo)
      }
      return { count: list.length }
    },
    async upsert(a: any) {
      const r = find(a.where)[0]
      if (r) return this.update({ where: { id: r.id }, data: a.update, include: a.include, select: a.select })
      return this.create({ data: a.create, include: a.include, select: a.select })
    },
    async delete(a: any) {
      const r = find(a.where)[0]
      if (!r) throw notFound()
      const out = shape(model, r, a)
      deleteRow(model, r)
      return out
    },
    async deleteMany(a: any = {}) {
      const list = find(a.where)
      list.forEach((r) => deleteRow(model, r))
      return { count: list.length }
    },
  }
}

let disconnected: () => void = () => {}
export const aguardarDesconexao = () => new Promise<void>((res) => (disconnected = res))

class FakePrismaClient {
  constructor() {
    const self: any = this
    for (const m of Object.keys(MODELS)) self[m] = delegate(m)
  }
  async $transaction(arg: any) {
    // transação real: em caso de erro, desfaz tudo
    const antes = snapshot()
    try {
      if (typeof arg === "function") return await arg(this)
      const out = []
      for (const p of arg) out.push(await p)
      return out
    } catch (e) {
      restore(antes)
      throw e
    }
  }
  async $disconnect() {
    disconnected()
  }
  async $connect() {}
}

let singleton: FakePrismaClient | null = null
export function PrismaClient(this: any) {
  if (!singleton) singleton = new FakePrismaClient()
  return singleton
}
export const Prisma = {}
export type UserRole = "ADMIN" | "SECRETARIA" | "PROFESSOR" | "ALUNO"
export type DiaSemana = "DOMINGO" | "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA" | "SABADO"
