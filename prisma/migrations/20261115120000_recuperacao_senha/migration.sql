-- CreateTable
CREATE TABLE "TokenRecuperacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEnviado" (
    "id" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "link" TEXT,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacao_tokenHash_key" ON "TokenRecuperacao"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRecuperacao_usuarioId_idx" ON "TokenRecuperacao"("usuarioId");

-- CreateIndex
CREATE INDEX "EmailEnviado_createdAt_idx" ON "EmailEnviado"("createdAt");

-- AddForeignKey
ALTER TABLE "TokenRecuperacao" ADD CONSTRAINT "TokenRecuperacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
