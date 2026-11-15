import { prisma } from "@/lib/prisma"

/**
 * Envia um e-mail do sistema. Todo e-mail fica registrado na caixa de saída (tela "E-mails enviados",
 * só para a equipe), o que permite demonstrar o fluxo com as contas @exemplo.com. Se RESEND_API_KEY e
 * EMAIL_FROM estiverem configurados, a mensagem também sai de verdade pela Resend. Uma falha no envio
 * real nunca interrompe o fluxo: o registro na caixa de saída continua valendo.
 */
export async function enviarEmail(m: { para: string; assunto: string; texto: string; link?: string }) {
  let enviado = false
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (key && from) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.para], subject: m.assunto, text: m.texto }),
      })
      enviado = r.ok
    } catch {
      enviado = false
    }
  }
  await prisma.emailEnviado.create({ data: { para: m.para, assunto: m.assunto, corpo: m.texto, link: m.link ?? null, enviado } })
}
