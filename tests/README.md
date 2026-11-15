# Testes automatizados do Sonata

Cobrem os casos do roteiro que não dependem de navegador: regras de conflito (RN01–RN14), validações (RNF006), autenticação e permissões (CT01–CT04, CT47, RNF005) e os fluxos das Server Actions de alunos, professores, salas, instrumentos, turmas, matrículas, reservas e solicitações (CT09–CT62). O nome de cada teste começa pelo ID do caso no roteiro.

## Como rodar

```bash
npm i -D vitest
npx vitest run            # ou acrescente "test": "vitest run" aos scripts do package.json
```

Os testes não usam o Neon. O `@prisma/client`, o `next-auth` e o `next/cache`/`next/navigation` são trocados por versões de teste (`tests/support`, ver `vitest.config.ts`): o banco fica em memória, é carregado pelo próprio `prisma/seed.ts` antes de cada teste e aplica os mesmos índices únicos e chaves estrangeiras das migrações.

Testes que falham indicam um defeito registrado no relatório de execução (por exemplo, CT11 espera “Preencha todos os campos obrigatórios.”). Quando o defeito for corrigido, o teste passa.

## Testes no PostgreSQL real

`tests/db/run-db-tests.sh` aplica as migrações e o SQL de seed num banco de teste e confere índices únicos, chaves estrangeiras, os dados do seed usados no roteiro e o formato dos hashes de senha (NF04).

```bash
CONFIRMO_BANCO_DE_TESTE=1 DATABASE_URL="postgresql://...branch-de-teste..." bash tests/db/run-db-tests.sh
```

O script apaga e recria o schema `public`: use uma branch de teste do Neon ou um Postgres local, nunca a produção. Precisa do `psql` instalado.

## Se o `npm run typecheck` reclamar

O `tsconfig.json` inclui `**/*.ts`, então os testes entram na checagem de tipos. Se aparecer algum erro só em `tests/`, acrescente `"tests"` e `"vitest.config.ts"` ao `exclude` do `tsconfig.json`.
