"use client"

/** Erro que derruba o layout raiz: página mínima, em português. */
export default function ErroGeral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>O sistema encontrou um erro inesperado</h1>
          <p style={{ color: "#555" }}>Tente de novo em instantes. Se continuar, recarregue a página.</p>
          <button onClick={() => reset()} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 6, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  )
}
