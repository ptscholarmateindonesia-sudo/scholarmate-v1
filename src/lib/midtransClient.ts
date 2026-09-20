export interface MidtransConfigResponse {
  isConfigured: boolean;
  clientKey: string;
  isProduction: boolean;
  snapJsUrl: string;
}

export interface CreateTransactionResponse {
  success: boolean;
  isDemoMode?: boolean;
  orderId?: string;
  planId?: 'MATE_PASS' | 'MATE_PLUS';
  tier?: 'MATE_PASS' | 'MATE_PLUS';
  amount?: number;
  token?: string | null;
  redirectUrl?: string | null;
  message?: string;
  error?: string;
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

let scriptLoadingPromise: Promise<boolean> | null = null;
let cachedConfig: MidtransConfigResponse | null = null;

async function safeJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`);
}

export async function fetchMidtransConfig(): Promise<MidtransConfigResponse> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/api/midtrans/config');
    if (res.ok) {
      cachedConfig = await safeJson<MidtransConfigResponse>(res);
      return cachedConfig!;
    }
  } catch (err) {
    console.warn('Failed to load Midtrans config, defaulting to sandbox:', err);
  }
  return {
    isConfigured: false,
    clientKey: '',
    isProduction: false,
    snapJsUrl: 'https://app.sandbox.midtrans.com/snap/snap.js',
  };
}

export async function loadMidtransSnapScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.snap) return true;
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise(async (resolve) => {
    try {
      const config = await fetchMidtransConfig();
      const existingScript = document.getElementById('midtrans-snap-script');
      if (existingScript && window.snap) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.id = 'midtrans-snap-script';
      script.src = config.snapJsUrl;
      if (config.clientKey) {
        script.setAttribute('data-client-key', config.clientKey);
      }
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('Failed to load Midtrans Snap.js script');
        resolve(false);
      };
      document.head.appendChild(script);
    } catch {
      resolve(false);
    }
  });

  return scriptLoadingPromise;
}

export async function createMidtransTransaction(params: {
  planId: 'MATE_PASS' | 'MATE_PLUS';
  authToken: string;
}): Promise<CreateTransactionResponse> {
  try {
    const res = await fetch('/api/midtrans/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.authToken}`,
      },
      // Client strictly sends ONLY planId; pricing is 100% server-authoritative
      body: JSON.stringify({
        planId: params.planId,
      }),
    });

    return await safeJson<CreateTransactionResponse>(res);
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal menghubungi server pembayaran',
    };
  }
}

export interface VerifyPaymentResponse {
  verified: boolean;
  status?: string;
  planId?: 'MATE_PASS' | 'MATE_PLUS';
  message?: string;
  error?: string;
}

/**
 * Server-Authoritative status verification.
 * Frontend callbacks (onSuccess/onPending/onError) are prohibited from directly granting entitlement.
 * This call queries the server, which validates settlement with Midtrans.
 */
export async function verifyMidtransPaymentStatus(orderId: string): Promise<VerifyPaymentResponse> {
  try {
    const res = await fetch('/api/midtrans/verify-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });

    return await safeJson<VerifyPaymentResponse>(res);
  } catch (err: any) {
    return {
      verified: false,
      error: err.message || 'Gagal memverifikasi status pembayaran ke server',
    };
  }
}
