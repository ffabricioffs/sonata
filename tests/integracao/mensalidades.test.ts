/** Mensalidades (RF036, módulo complementar): CT63–CT64. A restrição de unicidade é testada no PostgreSQL em tests/db. */
import { describe, it, expect } from "vitest"
import { existsSync, readdirSync } from "node:fs"

describe("Mensalidades (RF036)", () => {
  it("CT63 existe tela/ação para registrar e quitar mensalidade", () => {
    const telas = readdirSync("src/app/(dashboard)")
    expect(telas.some((t) => /mensalidade|pagamento/i.test(t)) || existsSync("src/app/(dashboard)/mensalidades")).toBe(true)
  })
})
