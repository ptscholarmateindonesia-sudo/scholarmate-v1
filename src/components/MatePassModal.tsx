import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  X,
  Zap,
  ShieldCheck,
  Target,
  FileText,
  Clock,
  ArrowRight,
  QrCode,
  Smartphone,
  CreditCard,
  Layers,
  Calendar,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { trackEvent } from '../types.ts';
import { authService, AuthState, AuthUser } from '../lib/authService.ts';
import { MAX_FREE_MATCHES } from '../types.ts';
import {
  loadMidtransSnapScript,
  createMidtransTransaction,
  verifyMidtransPaymentStatus,
  fetchMidtransConfig,
} from '../lib/midtransClient.ts';

export type PassTier = 'MATE_PASS' | 'MATE_PLUS';

export interface MatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePassTier?: 'NONE' | 'MATE_PASS' | 'MATE_PLUS';
  isMatePassActive?: boolean;
  onActivatePass?: (tier: PassTier) => void;
  onActivateMatePass?: () => void;
  onDeactivatePass?: () => void;
  onDeactivateMatePass?: () => void;
  initialSelectedTier?: PassTier;
}

export function MatePassModal({
  isOpen,
  onClose,
  activePassTier = 'NONE',
  isMatePassActive = false,
  onActivatePass,
  onActivateMatePass,
  onDeactivatePass,
  onDeactivateMatePass,
  initialSelectedTier = 'MATE_PLUS',
}: MatePassModalProps) {
  // Determine effective active tier
  const effectiveActiveTier: 'NONE' | 'MATE_PASS' | 'MATE_PLUS' =
    activePassTier !== 'NONE'
      ? activePassTier
      : isMatePassActive
      ? 'MATE_PASS'
      : 'NONE';

  const isAnyPassActive = effectiveActiveTier !== 'NONE';

  const [selectedTier, setSelectedTier] = useState<PassTier>(initialSelectedTier);
  const [selectedPayment, setSelectedPayment] = useState<'QRIS' | 'GOPAY' | 'SHOPEEPAY' | 'VA'>('QRIS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>('AUTHENTICATING');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingPlanAfterLogin, setPendingPlanAfterLogin] = useState<PassTier | null>(null);

  const [midtransConfig, setMidtransConfig] = useState<{ isProduction: boolean } | null>(null);

  const paymentMode = import.meta.env.VITE_PAYMENT_MODE;
  // Default to MANUAL_WHATSAPP if missing or empty, use Midtrans only if explicitly set
  const isManualMode = !paymentMode || paymentMode === 'MANUAL_WHATSAPP';
  const waNumber = import.meta.env.VITE_MENTORING_WHATSAPP_NUMBER || '';

  // Subscribe to Auth State
  useEffect(() => {
    fetchMidtransConfig().then(config => setMidtransConfig(config));
    return authService.subscribe((state, u) => {
      setAuthState(state);
      setUser(u);
    });
  }, []);

  // Handle automatic activation after login if a plan was pending
  useEffect(() => {
    if (authState === 'AUTHENTICATED' && pendingPlanAfterLogin && isOpen) {
      const plan = pendingPlanAfterLogin;
      setPendingPlanAfterLogin(null);
      handleActivate(plan);
    }
  }, [authState, pendingPlanAfterLogin, isOpen]);

  // Preload Midtrans Snap script when modal opens
  useEffect(() => {
    if (isOpen) {
      loadMidtransSnapScript().catch((err) => {
        console.warn('Midtrans Snap preload notice:', err);
      });
      setErrorMessage(null);
      setDemoNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlanMeta = {
    MATE_PASS: {
      name: 'Mate Pass',
      priceFormatted: 'Rp9.900',
      price: 9900,
      feeFormatted: '~Rp69',
      durationDays: 7,
      durationLabel: '7 hari',
      tagline: 'Sprint 1 beasiswa spesifik',
    },
    MATE_PLUS: {
      name: 'Mate Plus',
      priceFormatted: 'Rp24.900',
      price: 24900,
      feeFormatted: '~Rp174',
      durationDays: 30,
      durationLabel: '30 hari',
      tagline: 'Akses lebih lama untuk persiapan beberapa beasiswa',
    },
  }[selectedTier];

  const handleActivate = async (forcedTier?: PassTier) => {
    const tierToActivate = forcedTier || selectedTier;

    // RULE: Mandatory Auth before calling Midtrans
    if (authState !== 'AUTHENTICATED') {
      setIsProcessing(true);
      try {
        setPendingPlanAfterLogin(tierToActivate);
        await authService.signInWithGoogle();
        // The useEffect will pick up from here after authState becomes AUTHENTICATED
        return;
      } catch (err: any) {
        setIsProcessing(false);
        setPendingPlanAfterLogin(null);
        
        const code = err?.code || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setErrorMessage('Login dibatalkan. Silakan login untuk melanjutkan pembayaran.');
        } else if (code === 'auth/popup-blocked') {
          setErrorMessage('Pop-up login terblokir browser. Izinkan pop-up untuk membayar.');
        } else {
          setErrorMessage('Login diperlukan untuk melanjutkan pembayaran.');
        }
        return;
      }
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setDemoNotice(null);

    trackEvent('pass_activation_started', {
      tier: tierToActivate,
      paymentMethod: isManualMode ? 'WHATSAPP' : selectedPayment,
      price: currentPlanMeta.price,
    });

    if (isManualMode) {
      const message = `Halo ScholarMate! Saya ingin aktivasi ${currentPlanMeta.name} (${currentPlanMeta.durationLabel}).\n\nEmail: ${user?.email || 'N/A'}\nHarga: ${currentPlanMeta.priceFormatted}\n\nPembayaran otomatis sedang disiapkan. Aktivasi sekarang via QRIS ScholarMate.`;
      const encodedMessage = encodeURIComponent(message);
      const waUrl = `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodedMessage}`;
      
      setIsProcessing(false);
      window.open(waUrl, '_blank');
      return;
    }

    try {
      // RULE: Mandatory Auth before calling Midtrans
      const authToken = await authService.getIdToken();
      if (!authToken) {
        throw new Error('Gagal mendapatkan token autentikasi.');
      }

      // 1. Create transaction on server with Midtrans Snap (server determines pricing)
      const txResult = await createMidtransTransaction({
        planId: tierToActivate,
        authToken: authToken,
      });

      if (!txResult.success && !txResult.isDemoMode) {
        setIsProcessing(false);
        setErrorMessage(txResult.error || 'Gagal memulai transaksi Midtrans. Silakan coba lagi.');
        return;
      }

      // 2. If running in live/sandbox with token & Snap.js loaded
      if (txResult.token && typeof window !== 'undefined' && window.snap) {
        window.snap.pay(txResult.token, {
          onSuccess: async (result: any) => {
            console.log('[Midtrans Snap Callback onSuccess]', result);
            // CRITICAL RULE 8: Frontend callback must NEVER directly activate entitlement!
            // Authoritative server-side verification is mandatory before granting access.
            setIsProcessing(true);
            try {
              const verifyRes = await verifyMidtransPaymentStatus(txResult.orderId!);
              if (verifyRes.verified) {
                completeActivation();
              } else {
                setIsProcessing(false);
                setErrorMessage(
                  verifyRes.message ||
                    'Pembayaran belum berhasil diverifikasi oleh server Midtrans. Silakan periksa status transfer Anda.'
                );
              }
            } catch (err: any) {
              setIsProcessing(false);
              setErrorMessage('Gagal memverifikasi status pembayaran dengan server.');
            }
          },
          onPending: (result: any) => {
            console.log('[Midtrans Snap Callback onPending]', result);
            // RULE 8: Do NOT activate entitlement on pending
            setIsProcessing(false);
            setErrorMessage(
              'Pembayaran masih berstatus pending. Mohon selesaikan transfer QRIS/Virtual Account Anda. Entitlement akan diaktifkan setelah pembayaran berstatus settlement.'
            );
          },
          onError: (error: any) => {
            console.error('[Midtrans Snap Callback onError]', error);
            // RULE 8: Do NOT activate entitlement on error
            setIsProcessing(false);
            setErrorMessage('Pembayaran gagal atau dibatalkan. Silakan coba kembali.');
          },
          onClose: () => {
            setIsProcessing(false);
          },
        });
        return;
      }

      // 3. Fallback / Sandbox Demo Mode (when server key not configured in environment)
      if (txResult.isDemoMode || !txResult.token) {
        setDemoNotice(
          txResult.message || 'Midtrans Sandbox Demo: Meminta verifikasi otoritatif dari server...'
        );
        // Authoritative server check even in demo mode
        const verifyRes = await verifyMidtransPaymentStatus(txResult.orderId!);
        if (verifyRes.verified) {
          setTimeout(() => {
            completeActivation();
          }, 800);
        } else {
          setIsProcessing(false);
          setErrorMessage('Verifikasi server gagal.');
        }
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Terjadi gangguan saat memproses pembayaran.');
    }
  };

  const completeActivation = async () => {
    setIsProcessing(false);
    setShowSuccessMessage(true);

    if (onActivatePass) {
      onActivatePass(selectedTier);
    } else if (onActivateMatePass) {
      onActivateMatePass();
    }

    trackEvent('pass_activated', {
      tier: selectedTier,
      price: currentPlanMeta.price,
      durationDays: currentPlanMeta.durationDays,
    });

    setTimeout(() => {
      setShowSuccessMessage(false);
      onClose();
    }, 1200);
  };

  const handleDeactivate = () => {
    if (onDeactivatePass) {
      onDeactivatePass();
    } else if (onDeactivateMatePass) {
      onDeactivateMatePass();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
        id="modal-mate-pass"
      >
        {/* Header Background */}
        <div className="bg-gradient-to-br from-indigo-950 via-blue-900 to-sky-850 text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-44 h-44 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -translate-x-8 translate-y-8 w-44 h-44 bg-indigo-500/25 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            id="btn-close-mate-pass"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black tracking-wide uppercase shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>ScholarMate Premium Access</span>
          </div>

          <div className="mt-3">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Pilih Paket Akses Penuh
            </h2>
            <p className="text-xs sm:text-sm text-sky-100/90 mt-1 font-medium">
              Buka seluruh matching beasiswa, analisis kesiapan mendalam, dan bantuan AI tanpa batas.
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Active status */}
          {isAnyPassActive ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="inline-flex p-2.5 bg-emerald-100 rounded-full text-emerald-700">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-emerald-950">
                  {effectiveActiveTier === 'MATE_PLUS' ? 'Mate Plus Sedang Aktif!' : 'Mate Pass Sedang Aktif!'}
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                  {effectiveActiveTier === 'MATE_PLUS'
                    ? 'Kamu memiliki akses 30 hari ke seluruh beasiswa, Full Fit Analysis, dan AI tanpa batas untuk persiapan beberapa beasiswa.'
                    : 'Kamu memiliki akses 7 hari ke seluruh beasiswa, Full Fit Analysis, dan kuota AI tanpa batas.'}
                </p>
              </div>

              {/* Upgrade to Mate Plus if currently on Mate Pass */}
              {effectiveActiveTier === 'MATE_PASS' && (
                <div className="pt-2 border-t border-emerald-200/80 mt-3 text-left bg-white/70 p-3.5 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Upgrade ke Mate Plus (30 Hari)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Persiapkan beberapa beasiswa sekaligus dengan masa aktif lebih panjang (Rp24.900).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeactivate();
                        setTimeout(() => setSelectedTier('MATE_PLUS'), 100);
                      }}
                      className="px-3 py-1.5 bg-[#1F8ED8] hover:bg-[#197EC2] text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer transition-colors"
                    >
                      Pilih Mate Plus
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDeactivate}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                >
                  Kembali ke mode Free (Reset Status)
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TIER SELECTION CARDS: Mate Pass vs Mate Plus */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Pilih Durasi Persiapan:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="pass-tier-selector">
                  {/* Option 1: Mate Pass */}
                  <button
                    type="button"
                    id="btn-select-tier-mate-pass"
                    onClick={() => setSelectedTier('MATE_PASS')}
                    className={`p-4 rounded-2xl border text-left relative transition-all cursor-pointer ${
                      selectedTier === 'MATE_PASS'
                        ? 'border-[#1F8ED8] bg-sky-50/70 shadow-sm ring-2 ring-[#1F8ED8]/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Sprint 1 Beasiswa
                      </span>
                      {selectedTier === 'MATE_PASS' && (
                        <CheckCircle2 className="w-4 h-4 text-[#1F8ED8]" />
                      )}
                    </div>
                    <div className="text-base font-black text-slate-950">Mate Pass</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-extrabold text-[#1F8ED8]">Rp9.900</span>
                      <span className="text-xs text-slate-500 font-medium">/ 7 hari</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                      Cocok untuk sprint pendaftaran 1 beasiswa yang deadlinenya dekat.
                    </p>
                  </button>

                  {/* Option 2: Mate Plus (Highlighted) */}
                  <button
                    type="button"
                    id="btn-select-tier-mate-plus"
                    onClick={() => setSelectedTier('MATE_PLUS')}
                    className={`p-4 rounded-2xl border text-left relative transition-all cursor-pointer overflow-hidden ${
                      selectedTier === 'MATE_PLUS'
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Value Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow-xs">
                        Paling Populer • Hemat 40%+
                      </span>
                      {selectedTier === 'MATE_PLUS' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div className="text-base font-black text-slate-950 flex items-center gap-1.5">
                      <span>Mate Plus</span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-extrabold text-indigo-700">Rp24.900</span>
                      <span className="text-xs text-slate-500 font-medium">/ 30 hari</span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-2 leading-relaxed font-medium">
                      Akses lebih lama untuk persiapan beberapa beasiswa sekaligus.
                    </p>
                  </button>
                </div>
              </div>

              {/* Features breakdown for chosen plan */}
              <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span className="uppercase tracking-wider">
                    Fitur {selectedTier === 'MATE_PLUS' ? 'Mate Plus' : 'Mate Pass'}:
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    Masa Aktif {currentPlanMeta.durationLabel}
                  </span>
                </div>

                <div className="grid gap-2 text-xs">
                  {selectedTier === 'MATE_PLUS' && (
                    <div className="flex items-start gap-2 text-indigo-950 font-bold bg-indigo-100/70 p-2.5 rounded-xl border border-indigo-200">
                      <Layers className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                      <span>
                        Semua Fitur Mate Pass + Akses lebih lama untuk persiapan beberapa beasiswa (30 hari penuh)
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Unlock semua matching beasiswa</strong> tanpa batas {MAX_FREE_MATCHES} beasiswa gratis.
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Full Fit Analysis</strong> untuk seluruh kartu beasiswa rekomendasi.
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Gap Analysis lebih lengkap</strong> dengan panduan langkah penyesuaian profil.
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>AI Help lebih banyak</strong> (kuota AI personalisasi tanpa batas).
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Metode Pembayaran:</span>
                  {!isManualMode && (
                    <div className="flex items-center gap-1.5">
                      {!midtransConfig?.isProduction && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">
                          Sandbox
                        </span>
                      )}
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Midtrans Snap
                      </span>
                    </div>
                  )}
                </div>

                {isManualMode ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900">
                          Aktivasi Manual via WhatsApp
                        </p>
                        <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                          Pembayaran otomatis sedang disiapkan. Aktivasi sekarang via QRIS ScholarMate.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-amber-800 font-bold bg-white/50 p-2 rounded-lg border border-amber-200/50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Proses cepat setelah konfirmasi transfer QRIS</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPayment('QRIS')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          selectedPayment === 'QRIS'
                            ? 'border-[#1F8ED8] bg-sky-50/70 text-slate-950 font-bold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <QrCode className="w-4 h-4 text-[#1F8ED8]" />
                        <div className="text-xs">
                          <div className="flex items-center gap-1">
                            <span>QRIS</span>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Fee 0,7%</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-normal">BCA, Mandiri, GoPay, Dana</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPayment('GOPAY')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          selectedPayment === 'GOPAY'
                            ? 'border-[#1F8ED8] bg-sky-50/70 text-slate-950 font-bold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <div className="text-xs">
                          <div>GoPay / OVO</div>
                          <span className="text-[10px] text-slate-500 font-normal">Midtrans Instant Pay</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPayment('SHOPEEPAY')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          selectedPayment === 'SHOPEEPAY'
                            ? 'border-[#1F8ED8] bg-sky-50/70 text-slate-950 font-bold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-orange-600" />
                        <div className="text-xs">
                          <div>ShopeePay</div>
                          <span className="text-[10px] text-slate-500 font-normal">Bayar via aplikasi</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPayment('VA')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          selectedPayment === 'VA'
                            ? 'border-[#1F8ED8] bg-sky-50/70 text-slate-950 font-bold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <div className="text-xs">
                          <div>Virtual Account</div>
                          <span className="text-[10px] text-slate-500 font-normal">BCA / Mandiri / BRI</span>
                        </div>
                      </button>
                    </div>

                    {/* Midtrans Fee Transparency Banner */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-600">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 leading-relaxed">
                        <p className="font-semibold text-slate-800">
                          Fee transaksi QRIS Midtrans ~0,7% ({currentPlanMeta.feeFormatted})
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Tanpa biaya setup atau potongan bulanan tersembunyi. Didukung oleh Midtrans Snap resmi berlisensi Bank Indonesia.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Error or Demo Banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {demoNotice && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1F8ED8] shrink-0" />
                  <span>{demoNotice}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 space-y-2">
                {showSuccessMessage ? (
                  <div className="p-3 bg-emerald-600 text-white font-bold text-center text-xs rounded-xl flex items-center justify-center gap-2 animate-bounce">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedTier === 'MATE_PLUS' ? 'Mate Plus' : 'Mate Pass'} Berhasil Diaktifkan! Memuat akses penuh...
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    id="btn-activate-mate-pass"
                    onClick={() => handleActivate()}
                    disabled={isProcessing}
                    className={`w-full min-h-[48px] px-5 py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-75 ${
                      selectedTier === 'MATE_PLUS'
                        ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-[#1F8ED8] hover:from-indigo-700 hover:to-blue-700'
                        : 'bg-gradient-to-r from-[#1F8ED8] to-indigo-600 hover:from-[#197EC2] hover:to-indigo-700'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        {isManualMode ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                        )}
                        <span>
                          {isManualMode ? 'Aktivasi via WhatsApp' : 'Bayar via Midtrans Snap'} • {currentPlanMeta.priceFormatted} ({currentPlanMeta.durationLabel})
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}

                <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Akses aktif {currentPlanMeta.durationLabel}
                  </span>
                  <span>•</span>
                  <span>Tanpa perpanjangan otomatis</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
