// ============================================
// EMAIL SERVICE (frontend) — via Edge Function send-email (Resend)
// ============================================
// ⚠️ SEGURANÇA: a RESEND_API_KEY NUNCA deve ficar no frontend.
// O envio é feito pela Edge Function `send-email` no Supabase,
// que guarda a chave como secret do servidor.
//
// Se você realmente precisar chamar a API do Resend direto do navegador
// (não recomendado), defina VITE_RESEND_API_KEY no .env.local — mas
// prefira sempre esta abordagem via Edge Function.

import { supabase } from '../lib/supabase';

export interface EmailDataBase {
  participantName?: string;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
  confirmationCode?: string;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  receiptUrl?: string;
}

export interface PendingPaymentEmailData extends EmailDataBase {
  participantEmail: string;
  pixQrCode?: string;
}

async function invokeSendEmail(body: Record<string, unknown>): Promise<{ success: boolean }> {
  if (!supabase) {
    // Modo demo: apenas loga em vez de quebrar o fluxo
    console.warn('📧 [demo mode] Email não enviado (Supabase não configurado):', body);
    return { success: false };
  }

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: JSON.stringify(body),
  });

  if (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
  return data as { success: boolean };
}

/**
 * Envia email de inscrição com pagamento pendente
 */
export async function sendPendingPaymentEmail(params: PendingPaymentEmailData) {
  return invokeSendEmail({
    template: 'pending-payment',
    to: params.participantEmail,
    participantName: params.participantName,
    eventName: params.eventName,
    eventDate: params.eventDate,
    eventLocation: params.eventLocation,
    confirmationCode: params.confirmationCode,
    amount: params.amount,
    pixQrCode: params.pixQrCode,
    receiptUrl: params.receiptUrl,
  });
}

/**
 * Envia email de inscrição confirmada
 */
export async function sendConfirmedEmail(params: EmailDataBase & { participantEmail: string }) {
  return invokeSendEmail({
    template: 'confirmed',
    to: params.participantEmail,
    participantName: params.participantName,
    eventName: params.eventName,
    eventDate: params.eventDate,
    eventLocation: params.eventLocation,
    confirmationCode: params.confirmationCode,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    transactionId: params.transactionId,
    receiptUrl: params.receiptUrl,
  });
}

/**
 * Envia email de pagamento cancelado/rejeitado
 */
export async function sendCancelledEmail(params: EmailDataBase & { participantEmail: string }) {
  return invokeSendEmail({
    template: 'cancelled',
    to: params.participantEmail,
    participantName: params.participantName,
    eventName: params.eventName,
    confirmationCode: params.confirmationCode,
    receiptUrl: params.receiptUrl,
  });
}
