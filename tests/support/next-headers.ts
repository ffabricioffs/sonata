/** Substitui next/headers: cabeçalhos fixos de uma requisição de teste. */
export async function headers() {
  return new Headers({ host: "sonata.local", "x-forwarded-proto": "https" })
}
export async function cookies() {
  return { get: () => undefined, set: () => {}, delete: () => {} }
}
