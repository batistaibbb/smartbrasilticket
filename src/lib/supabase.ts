import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logs
console.log('🔍 Supabase Config:', {
  url: supabaseUrl ? '✅ Configurado' : '❌ Não configurado',
  key: supabaseAnonKey ? '✅ Configurado' : '❌ Não configurado',
  urlValue: supabaseUrl,
});

// Create Supabase client only if credentials are available
// Otherwise, the app will run in demo mode using localStorage
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// Check if running in demo mode (no Supabase configured)
export const isDemoMode = !supabase;

console.log('🔍 Supabase Status:', {
  client: supabase ? '✅ Criado' : '❌ Não criado',
  demoMode: isDemoMode ? '⚠️ MODO DEMO' : '✅ MODO PRODUÇÃO',
});

// Helper functions for common operations
export const supabaseHelpers = {
  // Upload image to storage
  async uploadImage(file: File, bucket: string = 'event-images'): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase not configured - running in demo mode');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // Get public URL for an image
  getImageUrl(path: string, bucket: string = 'event-images'): string {
    if (!supabase) {
      throw new Error('Supabase not configured - running in demo mode');
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return publicUrl;
  },

  // Invoke Edge Function
  async invokeFunction(functionName: string, body: any = {}) {
    if (!supabase) {
      throw new Error('Supabase not configured - running in demo mode');
    }

    // Atenção: passar o objeto direto (não JSON.stringify).
    // stringify duplicado corrompia o payload e quebrava a Edge Function.
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) throw error;
    return data;
  },
};

// ============================================
// Integração Mercado Pago (via Edge Functions)
// ============================================

/** Cria pagamento PIX e retorna QR Code + código copia-e-cola */
export async function createPixPayment(registrationId: string, amount: number, description?: string) {
  return supabaseHelpers.invokeFunction('create-pix-payment', {
    registrationId,
    amount,
    description,
  });
}

/** Cria pagamento com cartão (token do Mercado Pago JS SDK) */
export async function createCardPayment(params: {
  registrationId: string;
  amount: number;
  description?: string;
  token: string;
  installments: number;
  paymentMethodId: string;
}) {
  return supabaseHelpers.invokeFunction('create-card-payment', params);
}

/** Consulta o status de um pagamento no banco (Realtime atualiza sozinho, isto é para "Verificar agora") */
export async function getPaymentStatus(paymentId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('payments')
    .select('id, status, paid_at')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
