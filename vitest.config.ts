import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Testes unitários e de integração das Server Actions (roteiro de testes do Sonata).
 * O Prisma, o Auth.js e as funções de servidor do Next são substituídos por versões de teste
 * (pasta tests/support): banco em memória carregado pelo prisma/seed.ts real, com as mesmas
 * restrições de unicidade e chaves estrangeiras das migrações.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: [
      { find: /^@prisma\/client$/, replacement: r("./tests/support/fake-prisma-client.ts") },
      { find: /^next-auth\/providers\/credentials$/, replacement: r("./tests/support/next-auth-credentials.ts") },
      { find: /^next-auth$/, replacement: r("./tests/support/next-auth.ts") },
      { find: /^next\/cache$/, replacement: r("./tests/support/next-cache.ts") },
      { find: /^next\/navigation$/, replacement: r("./tests/support/next-navigation.ts") },
      { find: /^@\//, replacement: r("./src") + "/" },
    ],
  },
})
