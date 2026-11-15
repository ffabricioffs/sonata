/** Mostrado na hora em que a pessoa troca de tela, enquanto o servidor monta a página. */
export default function Carregando() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/60" />
        ))}
      </div>
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}
