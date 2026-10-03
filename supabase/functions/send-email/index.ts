// ============================================
// SEND EMAIL - SUPABASE EDGE FUNCTION (Resend)
// ============================================
// Deploy: supabase functions deploy send-email
//
// Esta função envia emails transacionais via Resend.com.
// Ela é chamada pelo frontend (emailService.ts) e por outras Edge
// Functions, mantendo a RESEND_API_KEY apenas no servidor.
//
// Variáveis de ambiente necessárias (supabase secrets set ...):
//   RESEND_API_KEY      -> chave da API do Resend (re_...)
//   FROM_EMAIL          -> remetente verificado (ex: "Smart Brasil Ticket <contato@smartbrasilticket.com.br>")
//   APP_BASE_URL        -> (opcional) URL do app, usada nos links dos emails

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject?: string;
  template?: "pending-payment" | "confirmed" | "cancelled";
  // Dados usados pelos templates
  participantName?: string;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
  confirmationCode?: string;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  pixQrCode?: string; // código copia-e-cola
  receiptUrl?: string;
}

// ---------- Templates HTML ----------

const COLORS = {
  primary: "#10b981", // emerald
  secondary: "#0ea5e9", // sky
  accent: "#f59e0b", // amber
  error: "#ef4444", // red
  text: "#1f2937",
  muted: "#6b7280",
};

function baseLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(90deg,${COLORS.primary},${COLORS.secondary});padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;">🏃 Smart Brasil Ticket</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;color:${COLORS.muted};font-size:12px;">
            Dúvidas? contato@smartbrasilticket.com.br · (11) 4002-8922<br/>
            Este é um email automático — não é necessário respondê-lo.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function codeBox(code: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <p style="margin:0 0 8px;color:${COLORS.muted};font-size:14px;">Seu código de confirmação</p>
    <div style="display:inline-block;background:#ecfdf5;border:2px dashed ${COLORS.primary};border-radius:8px;padding:12px 24px;font-family:'Courier New',monospace;font-size:22px;font-weight:bold;color:${COLORS.primary};letter-spacing:2px;">${code}</div>
  </div>`;
}

function formatAmount(amount?: number): string {
  return amount != null ? `R$ ${amount.toFixed(2).replace(".", ",")}` : "";
}

function pendingPaymentTemplate(d: SendEmailRequest): string {
  const valor = formatAmount(d.amount);
  const content = `
    <h2 style="margin:0 0 16px;font-size:22px;">Olá, ${d.participantName ?? "Participante"}! 👋</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Sua inscrição no evento <strong>${d.eventName ?? ""}</strong> foi criada e está
      <strong style="color:${COLORS.accent};">aguardando pagamento</strong>.
    </p>
    ${d.confirmationCode ? codeBox(d.confirmationCode) : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
      ${d.eventDate ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">📅 Data</td><td style="padding:6px 0;text-align:right;"><strong>${d.eventDate}</strong></td></tr>` : ""}
      ${d.eventLocation ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">📍 Local</td><td style="padding:6px 0;text-align:right;"><strong>${d.eventLocation}</strong></td></tr>` : ""}
      ${valor ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">💰 Valor</td><td style="padding:6px 0;text-align:right;"><strong>${valor}</strong></td></tr>` : ""}
    </table>
    <h3 style="margin:24px 0 8px;font-size:16px;">Como pagar</h3>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>PIX:</strong> use o QR Code ou o código copia-e-cola gerado na finalização da inscrição.</p>
    ${d.pixQrCode ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-family:monospace;font-size:11px;word-break:break-all;margin:8px 0 16px;">${d.pixQrCode}</div>` : ""}
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;"><strong>Cartão de crédito/débito:</strong> clique no botão abaixo para concluir o pagamento com segurança.</p>
    ${d.receiptUrl ? `<div style="text-align:center;margin:24px 0;">
      <a href="${d.receiptUrl}" style="display:inline-block;background:linear-gradient(90deg,${COLORS.primary},${COLORS.secondary});color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:15px;">Finalizar Pagamento →</a>
    </div>` : ""}
  `;
  return baseLayout("Pagamento pendente", content);
}

function confirmedTemplate(d: SendEmailRequest): string {
  const valor = formatAmount(d.amount);
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Inscrição Confirmada! ✅</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Parabéns, <strong>${d.participantName ?? "Participante"}</strong>! Seu pagamento foi aprovado e sua
      vaga no evento <strong>${d.eventName ?? ""}</strong> está garantida.
    </p>
    ${d.confirmationCode ? codeBox(d.confirmationCode) : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
      ${d.eventDate ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">📅 Data</td><td style="padding:6px 0;text-align:right;"><strong>${d.eventDate}</strong></td></tr>` : ""}
      ${d.eventLocation ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">📍 Local</td><td style="padding:6px 0;text-align:right;"><strong>${d.eventLocation}</strong></td></tr>` : ""}
      ${valor ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">💰 Valor pago</td><td style="padding:6px 0;text-align:right;"><strong>${valor}</strong></td></tr>` : ""}
      ${d.paymentMethod ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">💳 Método</td><td style="padding:6px 0;text-align:right;"><strong>${d.paymentMethod}</strong></td></tr>` : ""}
      ${d.transactionId ? `<tr><td style="padding:6px 0;color:${COLORS.muted};">🆔 Transação</td><td style="padding:6px 0;text-align:right;"><strong>${d.transactionId}</strong></td></tr>` : ""}
    </table>
    <h3 style="margin:24px 0 8px;font-size:16px;">Para o dia do evento</h3>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;">
      <li>Apresente seu <strong>código de confirmação</strong> na retirada do kit</li>
      <li>Vista roupas leves e chegue com antecedência</li>
      <li>Hidrate-se bem antes da largada</li>
    </ul>
    ${d.receiptUrl ? `<div style="text-align:center;margin:24px 0;">
      <a href="${d.receiptUrl}" style="display:inline-block;background:linear-gradient(90deg,${COLORS.primary},${COLORS.secondary});color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:15px;">📄 Ver Meu Comprovante</a>
    </div>` : ""}
  `;
  return baseLayout("Inscrição confirmada", content);
}

function cancelledTemplate(d: SendEmailRequest): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${COLORS.error};">Pagamento não aprovado ❌</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Olá, <strong>${d.participantName ?? "Participante"}</strong>. Não conseguimos confirmar o pagamento
      da sua inscrição no evento <strong>${d.eventName ?? ""}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
      Você pode tentar novamente com outro método de pagamento ou entrar em contato com o nosso suporte.
      Sua vaga será liberada caso não haja regularização.
    </p>
    ${d.receiptUrl ? `<div style="text-align:center;margin:24px 0;">
      <a href="${d.receiptUrl}" style="display:inline-block;background:${COLORS.accent};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:15px;">Tentar Novamente</a>
    </div>` : ""}
  `;
  return baseLayout("Pagamento não aprovado", content);
}

function buildSubject(d: SendEmailRequest): string {
  switch (d.template) {
    case "confirmed":
      return `✅ Inscrição confirmada — ${d.eventName ?? "Smart Brasil Ticket"}`;
    case "cancelled":
      return `❌ Pagamento não aprovado — ${d.eventName ?? "Smart Brasil Ticket"}`;
    default:
      return `📋 Finalize sua inscrição — ${d.eventName ?? "Smart Brasil Ticket"}`;
  }
}

function buildHtml(d: SendEmailRequest): string {
  switch (d.template) {
    case "confirmed":
      return confirmedTemplate(d);
    case "cancelled":
      return cancelledTemplate(d);
    default:
      return pendingPaymentTemplate(d);
  }
}

// ---------- Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "Smart Brasil Ticket <onboarding@resend.dev>";

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada. Execute: supabase secrets set RESEND_API_KEY=re_xxx");
    }

    const data: SendEmailRequest = await req.json();

    if (!data.to || !/^[\w.+%-]+@[\w-]+\.[\w.-]+$/.test(data.to)) {
      throw new Error("Destinatário inválido");
    }

    // Link padrão para comprovante, se não informado
    const baseUrl = Deno.env.get("APP_BASE_URL");
    const receiptUrl = data.receiptUrl ??
      (baseUrl && data.confirmationCode ? `${baseUrl}/comprovantes` : undefined);

    const payload = {
      from: fromEmail,
      to: [data.to],
      subject: data.subject ?? buildSubject(data),
      html: buildHtml({ ...data, receiptUrl }),
    };

    console.log("Sending email via Resend:", { to: data.to, template: data.template });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      throw new Error(`Falha ao enviar email: ${result.message ?? response.status}`);
    }

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
