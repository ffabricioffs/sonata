/**
 * Substitui o next-auth: NextAuth(config) devolve a configuração real do src/auth.ts
 * (para testar authorize e authorized) e um auth() que lê a sessão definida pelo teste.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export let ultimaConfig: any = null

export function sessaoAtual(): any {
  return (globalThis as any).__sonataSessao ?? null
}

export default function NextAuth(config: any) {
  ultimaConfig = config
  return {
    handlers: { GET: async () => new Response(), POST: async () => new Response() },
    auth: async () => sessaoAtual(),
    signIn: async () => {},
    signOut: async () => {},
    config,
  }
}
