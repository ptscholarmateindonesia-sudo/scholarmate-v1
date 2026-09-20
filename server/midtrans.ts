import { Request, Response } from 'express';
import crypto from 'crypto';
import { db, auth, admin, Timestamp, FieldValue } from './firebaseAdmin.ts';

export interface CreateTransactionPayload {
  planId?: 'MATE_PASS' | 'MATE_PLUS';
  tier?: 'MATE_PASS' | 'MATE_PLUS'; // fallback compatibility
  userId?: string; // added to associate order with user
}

const TIER_PRICING = {
  MATE_PASS: {
    price: 9900,
    name: 'ScholarMate Mate Pass (7 Hari)',
    durationDays: 7,
  },
  MATE_PLUS: {
    price: 24900,
    name: 'ScholarMate Mate Plus (30 Hari)',
    durationDays: 30,
  },
};

// Midtrans Endpoints
const MIDTRANS_SANDBOX_SNAP_JS = 'https://app.sandbox.midtrans.com/snap/snap.js';
const MIDTRANS_SANDBOX_SNAP_API = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const MIDTRANS_PROD_SNAP_JS = 'https://app.midtrans.com/snap/snap.js';
const MIDTRANS_PROD_SNAP_API = 'https://app.midtrans.com/snap/v1/transactions';

export function getMidtransConfig() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const rawServerKey = process.env.MIDTRANS_SERVER_KEY?.trim() || '';
  const rawClientKey = process.env.MIDTRANS_CLIENT_KEY?.trim() || '';

  // SECURITY GUARD: Strictly validate keys match mode
  const isSandboxKey = (key: string) => key.startsWith('SB-');
  
  let validServerKey = '';
  let validClientKey = '';

  if (isProduction) {
    // Production mode: require non-SB keys
    if (rawServerKey && !isSandboxKey(rawServerKey)) validServerKey = rawServerKey;
    if (rawClientKey && !isSandboxKey(rawClientKey)) validClientKey = rawClientKey;
    
    if (rawServerKey && isSandboxKey(rawServerKey)) {
      console.warn('🚨 [Midtrans] Production mode enabled but Sandbox Server Key provided.');
    }
  } else {
    // Sandbox mode: require SB keys
    if (isSandboxKey(rawServerKey)) validServerKey = rawServerKey;
    if (isSandboxKey(rawClientKey)) validClientKey = rawClientKey;
  }

  return {
    isConfigured: Boolean(validServerKey),
    serverKey: validServerKey,
    clientKey: validClientKey,
    isProduction,
    snapJsUrl: isProduction ? MIDTRANS_PROD_SNAP_JS : MIDTRANS_SANDBOX_SNAP_JS,
    snapApiUrl: isProduction ? MIDTRANS_PROD_SNAP_API : MIDTRANS_SANDBOX_SNAP_API,
  };
}

export async function handleMidtransConfig(_req: Request, res: Response) {
  const config = getMidtransConfig();
  res.json({
    isConfigured: config.isConfigured,
    clientKey: config.clientKey,
    isProduction: config.isProduction,
    snapJsUrl: config.snapJsUrl,
  });
}

// Order record for Firestore
export interface OrderRecord {
  orderId: string;
  userId: string;
  planId: 'MATE_PASS' | 'MATE_PLUS';
  amount: number;
  status: 'pending' | 'settlement' | 'expire' | 'cancel' | 'deny';
  createdAt: any; // Firestore timestamp
  isDemoMode: boolean;
  entitlementGranted: boolean;
  entitlementActivatedAt?: any;
  webhookProcessedAt?: any;
}

/**
 * Midtrans SHA512 Signature verification
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
  serverKey: string
): boolean {
  if (!orderId || !statusCode || !grossAmount || !signatureKey || !serverKey) {
    return false;
  }
  const rawString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computedHash = crypto.createHash('sha512').update(rawString).digest('hex');
  return computedHash.toLowerCase() === signatureKey.toLowerCase();
}

/**
 * Server-Side entitlement activation in Firestore
 */
async function activateEntitlement(userId: string, planId: 'MATE_PASS' | 'MATE_PLUS') {
  const durationDays = TIER_PRICING[planId].durationDays;
  const startsAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    activePassTier: planId,
    passStartsAt: Timestamp.fromDate(startsAt),
    passExpiryAt: Timestamp.fromDate(expiresAt),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function handleMidtransCharge(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as CreateTransactionPayload;
    const planId = body.planId || body.tier;
    
    // Associate with user from auth middleware (to be added) or body
    // For now, we assume auth middleware sets req.user or similar, 
    // but looking at server.ts it doesn't yet. We'll use userId from body for now
    // but ideally we should verify the token. 
    // In server.ts we added an auth guard that checks for Bearer token.
    // We should extract UID from that token.
    
    const authHeader = req.headers.authorization;
    let userId = body.userId;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decodedToken = await auth.verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (err) {
        return res.status(401).json({ success: false, error: 'Token autentikasi tidak valid.' });
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'UserId tidak ditemukan.' });
    }

    if (!planId || (planId !== 'MATE_PASS' && planId !== 'MATE_PLUS')) {
      return res.status(400).json({
        success: false,
        error: 'planId tidak valid. Hanya menerima planId: MATE_PASS atau MATE_PLUS.',
      });
    }

    const tierMeta = TIER_PRICING[planId];
    const config = getMidtransConfig();

    if (!config.isConfigured && (process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_CLIENT_KEY)) {
      return res.status(403).json({
        success: false,
        error: `KEBIJAKAN KEAMANAN: Key Midtrans tidak sesuai dengan mode ${config.isProduction ? 'PRODUKSI' : 'SANDBOX'}. Harap periksa kembali konfigurasi .env.`,
      });
    }

    // Unique Order ID generated server-side
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderId = `SM-${planId === 'MATE_PLUS' ? 'PLUS' : 'PASS'}-${timestamp}-${randomSuffix}`;

    // Record initial order state in Firestore
    const orderRecord: OrderRecord = {
      orderId,
      userId,
      planId,
      amount: tierMeta.price,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      isDemoMode: !config.isConfigured,
      entitlementGranted: false,
    };
    
    await db.collection('paymentOrders').doc(orderId).set(orderRecord);

    // If Midtrans Server Key is not configured yet, return demo mode response
    if (!config.isConfigured) {
      return res.json({
        success: true,
        isDemoMode: true,
        orderId,
        planId,
        amount: tierMeta.price,
        token: null,
        redirectUrl: null,
        message: `Midtrans ${config.isProduction ? 'Production' : 'Sandbox'} Key belum diatur di .env. Menggunakan simulasi pembayaran instan.`,
      });
    }

    // Server-side charge payload for Midtrans Snap (Sandbox only)
    const snapPayload: any = {
      transaction_details: {
        order_id: orderId,
        gross_amount: tierMeta.price,
      },
      item_details: [
        {
          id: planId,
          price: tierMeta.price,
          quantity: 1,
          name: tierMeta.name,
          category: 'Scholarship Preparation Pass',
        },
      ],
      customer_details: {
        first_name: 'Mahasiswa',
        email: 'user@scholarmate.id',
      },
      enabled_payments: [
        'other_qris',
        'gopay',
        'shopeepay',
        'bca_va',
        'bni_va',
        'bri_va',
        'permata_va',
        'other_va',
      ],
    };

    const midtransAuthHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`;

    const midtransRes = await fetch(config.snapApiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: midtransAuthHeader,
      },
      body: JSON.stringify(snapPayload),
      signal: AbortSignal.timeout(5000),
    });

    if (!midtransRes.ok) {
      const errText = await midtransRes.text();
      console.error('Midtrans API error response:', errText);
      return res.status(midtransRes.status).json({
        success: false,
        error: `Midtrans Snap API Error: ${errText}`,
        fallbackToDemo: true,
      });
    }

    const data = (await midtransRes.json()) as { token: string; redirect_url: string };

    return res.json({
      success: true,
      isDemoMode: false,
      orderId,
      planId,
      amount: tierMeta.price,
      token: data.token,
      redirectUrl: data.redirect_url,
    });
  } catch (err: any) {
    console.error('Midtrans server-side charge error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan sistem pembayaran Midtrans',
    });
  }
}

// Backward-compatible alias
export const handleCreateMidtransTransaction = handleMidtransCharge;

/**
 * Authoritative Server-Side Verification
 */
export async function handleMidtransVerifyStatus(req: Request, res: Response) {
  try {
    const { orderId } = (req.body || {}) as { orderId?: string };

    if (!orderId) {
      return res.status(400).json({ verified: false, error: 'orderId wajib disertakan' });
    }

    const orderDoc = await db.collection('paymentOrders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ verified: false, error: 'Data pesanan tidak ditemukan.' });
    }
    
    const order = orderDoc.data() as OrderRecord;
    const config = getMidtransConfig();

    // 1. Real Midtrans verification
    if (config.isConfigured && config.serverKey) {
      const authHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`;
      const apiBaseUrl = config.isProduction ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
      const statusUrl = `${apiBaseUrl}/${encodeURIComponent(orderId)}/status`;

      const checkRes = await fetch(statusUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (checkRes.ok) {
        const statusData = await checkRes.json();
        const txStatus = statusData.transaction_status;
        const fraudStatus = statusData.fraud_status;

        const isSettled =
          txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept');

        if (isSettled && !order.entitlementGranted) {
          // IDEMPOTENT ACTIVATION
          await activateEntitlement(order.userId, order.planId);
          await db.collection('paymentOrders').doc(orderId).update({
            status: 'settlement',
            entitlementGranted: true,
            entitlementActivatedAt: FieldValue.serverTimestamp(),
          });
          order.entitlementGranted = true;
          order.status = 'settlement';
        } else if (txStatus !== order.status) {
          await db.collection('paymentOrders').doc(orderId).update({
            status: txStatus,
          });
          order.status = txStatus;
        }

        if (isSettled) {
          return res.json({
            verified: true,
            status: 'settlement',
            entitlementGranted: true,
            planId: order.planId,
            message: `Transaksi berhasil diverifikasi resmi oleh server Midtrans ${config.isProduction ? 'Produksi' : 'Sandbox'}.`,
          });
        }

        return res.json({
          verified: false,
          status: txStatus,
          entitlementGranted: false,
          message:
            txStatus === 'pending'
              ? 'Pembayaran belum diselesaikan. Menunggu proses transfer/QRIS.'
              : `Status transaksi belum berhasil (${txStatus}).`,
        });
      }
    }

    // 2. Sandbox Demo Mode
    if (order.isDemoMode) {
      if (!order.entitlementGranted) {
        await activateEntitlement(order.userId, order.planId);
        await db.collection('paymentOrders').doc(orderId).update({
          status: 'settlement',
          entitlementGranted: true,
          entitlementActivatedAt: FieldValue.serverTimestamp(),
        });
      }

      return res.json({
        verified: true,
        status: 'settlement',
        entitlementGranted: true,
        planId: order.planId,
        message: `Verifikasi server simulasi ${config.isProduction ? 'Produksi' : 'Sandbox'} berhasil disetujui.`,
      });
    }

    // 3. Fallback
    if (order.status === 'settlement' && order.entitlementGranted) {
      return res.json({
        verified: true,
        status: 'settlement',
        entitlementGranted: true,
        planId: order.planId,
        message: 'Transaksi telah berstatus settlement dan entitlement aktif.',
      });
    }

    return res.status(404).json({
      verified: false,
      entitlementGranted: false,
      error: 'Data pesanan belum diverifikasi settlement.',
    });
  } catch (err: any) {
    console.error('Server status verification error:', err);
    return res.status(500).json({ verified: false, error: err.message || 'Gagal memverifikasi status' });
  }
}

/**
 * Server-Side Webhook Handler: IDEMPOTENT & AUTHORITATIVE
 */
export async function handleMidtransWebhook(req: Request, res: Response) {
  try {
    const notification = req.body || {};
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = notification;

    if (!order_id) {
      return res.status(400).json({ status: 'ERROR', error: 'Missing order_id' });
    }

    const config = getMidtransConfig();
    const orderDoc = await db.collection('paymentOrders').doc(order_id).get();
    const existingOrder = orderDoc.exists ? (orderDoc.data() as OrderRecord) : null;

    // RULE 9: Verifikasi Notifikasi Midtrans secara Server-Side
    if (config.isConfigured && config.serverKey) {
      // signature check
      if (signature_key && status_code && gross_amount) {
        const isSignatureValid = verifyMidtransSignature(
          order_id,
          String(status_code),
          String(gross_amount),
          String(signature_key),
          config.serverKey
        );
        if (!isSignatureValid) {
          console.warn(`🚨 [Midtrans Webhook Security] Invalid signature for Order ${order_id}!`);
          return res.status(403).json({ status: 'FORBIDDEN', error: 'Invalid signature.' });
        }
      }

      // authoritative status check
      const authHeader = `Basic ${Buffer.from(`${config.serverKey}:`).toString('base64')}`;
      const apiBaseUrl = config.isProduction ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
      const statusUrl = `${apiBaseUrl}/${encodeURIComponent(order_id)}/status`;

      const directCheckRes = await fetch(statusUrl, {
        headers: { Accept: 'application/json', Authorization: authHeader },
        signal: AbortSignal.timeout(5000),
      });

      if (directCheckRes.ok) {
        const midtransData = await directCheckRes.json();
        const apiTxStatus = midtransData.transaction_status;
        const apiFraudStatus = midtransData.fraud_status;

        const isSuccess =
          apiTxStatus === 'settlement' ||
          (apiTxStatus === 'capture' && apiFraudStatus === 'accept');

        // RULE 10: IDEMPOTENCY
        if (existingOrder && existingOrder.entitlementGranted) {
          return res.status(200).json({ status: 'OK', message: 'Already processed.' });
        }

        if (isSuccess && existingOrder) {
          await activateEntitlement(existingOrder.userId, existingOrder.planId);
          await db.collection('paymentOrders').doc(order_id).update({
            status: 'settlement',
            entitlementGranted: true,
            entitlementActivatedAt: FieldValue.serverTimestamp(),
            webhookProcessedAt: FieldValue.serverTimestamp(),
          });
          return res.status(200).json({ status: 'OK', message: 'Entitlement activated.' });
        }
        
        if (existingOrder) {
          await db.collection('paymentOrders').doc(order_id).update({ status: apiTxStatus });
        }
      }
    }

    // Demo/Simulated Webhook processing
    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    if (existingOrder && existingOrder.entitlementGranted) {
      return res.status(200).json({ status: 'OK', message: 'Already processed (simulated).' });
    }

    if (isSuccess && existingOrder) {
      await activateEntitlement(existingOrder.userId, existingOrder.planId);
      await db.collection('paymentOrders').doc(order_id).update({
        status: 'settlement',
        entitlementGranted: true,
        entitlementActivatedAt: FieldValue.serverTimestamp(),
        webhookProcessedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ status: 'OK', message: 'Entitlement activated (simulated).' });
    }

    return res.status(200).json({ status: 'OK', message: 'Processed.' });
  } catch (err: any) {
    console.error('Midtrans webhook error:', err);
    return res.status(500).json({ status: 'ERROR', error: err.message });
  }
}
