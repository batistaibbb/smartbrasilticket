# 📧 Configuração do Resend.com — Smart Brasil Ticket

Guia passo a passo para configurar o envio de emails transacionais via **Resend** no projeto.

## Arquitetura (resumo)

```
Frontend (emailService.ts)          Edge Functions (servidor)
        │                                   │
        │ supabase.functions.invoke         │ usa RESEND_API_KEY
        ▼                                   ▼
  send-email  ────────────────►  API do Resend  ──►  Caixa de entrada
        ▲                                   do participante
        │ (automático, sem interação)
  mercadopago-webhook (aprovado/rejeitado)
```

> ⚠️ **Segurança:** a `RESEND_API_KEY` fica **somente como secret no Supabase** (servidor).
> Nunca a coloque em variáveis `VITE_*` — elas são embutidas no bundle público do navegador.

---

## Passo 1 — Criar conta e API Key no Resend

1. Acesse https://resend.com e crie uma conta (plano gratuito: 3.000 emails/mês, 100/dia).
2. Vá em **API Keys** → *https://resend.com/api-keys* → **Create API Key**.
   - Nome: `smart-brasil-ticket` · Permissão: `Sending access`.
   - Copie a chave (`re_...`) — ela só aparece uma vez.

## Passo 2 — Verificar o domínio remetente

1. Vá em **Domains** → *https://resend.com/domains* → **Add Domain** → `smartbrasilticket.com.br`.
2. No painel DNS da sua hospedagem (Registro.br, Cloudflare, etc.), adicione os registros que o Resend mostrar:
   - **MX** para `send.smartbrasilticket.com.br`
   - **TXT (SPF)**, **TXT (DKIM)** e **TXT (verification)**
3. Clique em **Verify DNS Records** no Resend e aguarde a propagação (minutos a poucas horas).
4. Depois de verificado, você pode enviar de `contato@smartbrasilticket.com.br` (ou outro endereço do domínio).

> 💡 Sem domínio verificado, o Resend permite testar apenas com `onboarding@resend.dev`,
> e **somente para o email da própria conta Resend** (limitação anti-spam).

## Passo 3 — Salvar os secrets no Supabase

Com o [Supabase CLI](https://supabase.com/docs/guides/cli) autenticado no seu projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF

npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  FROM_EMAIL="Smart Brasil Ticket <contato@smartbrasilticket.com.br>" \
  APP_BASE_URL=https://seu-app.vercel.app
```

(`APP_BASE_URL` é opcional — usado para gerar o link "Ver Meu Comprovante" nos emails.)

## Passo 4 — Fazer o deploy das Edge Functions

```bash
# Nova função de envio de emails
npx supabase functions deploy send-email

# Webhook atualizado (agora dispara emails automáticos)
npx supabase functions deploy mercadopago-webhook
```

Arquivos envolvidos:
- `supabase/functions/send-email/index.ts` — templates HTML + chamada à API do Resend
- `supabase/functions/mercadopago-webhook/index.ts` — envia "Inscrição confirmada" (aprovado) e "Pagamento não aprovado" (rejeitado)
- `src/lib/emailService.ts` — chamadas do frontend (`sendPendingPaymentEmail`, `sendConfirmedEmail`, `sendCancelledEmail`)

## Passo 5 — Testar o envio

Teste rápido via curl (com o token anon do projeto):

```bash
curl -X POST 'https://SEU-PROJETO.supabase.co/functions/v1/send-email' \
  -H "Authorization: Bearer SUA_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "confirmed",
    "to": "seu-email@gmail.com",
    "participantName": "Maria Silva",
    "eventName": "Corrida da Cidade 10K",
    "eventDate": "2026-11-15",
    "eventLocation": "Parque Ibirapuera, São Paulo",
    "confirmationCode": "SBT-A1B2C3",
    "amount": 89.90,
    "paymentMethod": "pix"
  }'
```

Resposta esperada: `{"success":true,"emailId":"..."}`. Confira também os logs em
**Supabase Dashboard → Edge Functions → Logs**.

Depois, teste o fluxo completo: criar inscrição → pagar PIX/cartão (conta de teste do Mercado Pago) → o webhook confirma a inscrição e envia o email automaticamente.

## Passo 6 — Monitoramento

- **Resend → Emails**: status (queued/sent/delivered/opened/bounced) por mensagem.
- **Resend → Webhooks** (opcional): receba eventos de entrega/bounce no seu backend.
- Limite do plano free: 3.000 emails/mês e 100/dia — acompanhe em **Resend → Usage**.

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `DnsRecordsError` ao enviar | Domínio não verificado no Resend | Complete o Passo 2 (MX/TXT/DKIM) |
| `To address must be on the same domain` usando `onboarding@resend.dev` | Conta não verificada / destinatário externo | Verifique o domínio próprio ou envie para o email da sua conta Resend |
| `401 Unauthorized` do Resend | `RESEND_API_KEY` errada ou não definida | `npx supabase secrets list` e redefina |
| Email não chega no fluxo de pagamento | Webhook não implantado ou sem `notification_url` | Redeploy `mercadopago-webhook`; confira logs e o campo `notification_url` na criação do pagamento MP |
| Erro "RESEND_API_KEY não configurada" na function | Secrets ausentes no ambiente | Rode o Passo 3 novamente |

## Checklist final

- [ ] Conta Resend criada e API Key gerada
- [ ] Domínio `smartbrasilticket.com.br` verificado no Resend
- [ ] Secrets definidos no Supabase (`RESEND_API_KEY`, `FROM_EMAIL`, `APP_BASE_URL`)
- [ ] `send-email` e `mercadopago-webhook` implantados
- [ ] Email de teste enviado com sucesso
- [ ] Fluxo completo testado (inscrição → pagamento → email automático)
