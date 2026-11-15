/** Substitui next/navigation: redirect/notFound lançam um erro com o mesmo "digest" do Next. */
export class RedirectError extends Error {
  digest: string
  url: string
  constructor(url: string) {
    super("NEXT_REDIRECT")
    this.url = url
    this.digest = `NEXT_REDIRECT;replace;${url};307;`
  }
}
export function redirect(url: string): never {
  throw new RedirectError(url)
}
export function notFound(): never {
  const e = new Error("NEXT_NOT_FOUND") as Error & { digest: string }
  e.digest = "NEXT_HTTP_ERROR_FALLBACK;404"
  throw e
}
export const useRouter = () => ({ push() {}, refresh() {} })
export const usePathname = () => "/"
