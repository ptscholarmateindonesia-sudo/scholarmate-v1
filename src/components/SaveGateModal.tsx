import React, { useState } from 'react';
import { X, Bookmark, Loader2, AlertCircle } from 'lucide-react';
import { trackEvent } from '../types.ts';
import { authService, AuthUser } from '../lib/authService.ts';

interface SaveGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLocal?: () => void;
  onGoogleSignInSuccess?: (user: AuthUser) => void;
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
}

export function SaveGateModal({
  isOpen,
  onClose,
  onGoogleSignInSuccess,
  isAuthenticated,
  currentUser,
}: SaveGateModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    trackEvent('google_signin_started', { source: 'save_gate_modal' });

    try {
      const user = await authService.signInWithGoogle();
      trackEvent('google_signin_completed', { user_id: user.id, email: user.email });
      if (onGoogleSignInSuccess) {
        onGoogleSignInSuccess(user);
      }
      onClose();
    } catch (err: any) {
      console.error('[SaveGateModal] Google Sign-In error:', err);
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMessage('Login dibatalkan. Silakan coba lagi untuk menyimpan progres.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage('Pop-up login terblokir browser. Izinkan pop-up untuk menyimpan progres.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Gangguan jaringan. Silakan periksa koneksi internet Anda.');
      } else {
        setErrorMessage(err?.message || 'Gagal masuk dengan Google. Silakan coba lagi.');
      }
      trackEvent('google_signin_failed', { error_code: code });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      id="save-gate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl border border-[#E2E8F0] space-y-5 animate-in slide-in-from-bottom duration-200"
        id="save-gate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#EBF5FC] border border-[#BAE0F8] flex items-center justify-center text-[#1F8ED8] shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#111111] leading-snug" id="save-gate-title">
                Simpan Progres Beasiswa Kamu
              </h3>
              <p className="text-xs text-[#475569] font-medium mt-0.5">
                Simpan hasil matching &amp; pengecekan ke akun Google
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="btn-close-save-gate"
            className="p-1.5 rounded-lg text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description Copy */}
        <p className="text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl font-normal">
          Masuk dengan akun Google untuk menyimpan snapshot hasil matching, progres jawaban pengecekan lanjutan, dan melanjutkan persiapan beasiswa kapan saja dari perangkat mana pun.
        </p>

        {/* Benefits List */}
        <div className="space-y-2.5 py-1">
          <div className="flex items-center gap-2.5 text-xs text-[#111111] font-semibold">
            <div className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </div>
            <span>Simpan hasil kelayakan beasiswa &amp; Fit Score</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#111111] font-semibold">
            <div className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </div>
            <span>Sinkronisasi aman ke Cloud Firestore secara otomatis</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#111111] font-semibold">
            <div className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </div>
            <span>Lanjutkan persiapan beasiswa kapan saja tanpa isi ulang</span>
          </div>
        </div>

        {/* Error notification if any */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Primary Action Button: Real Google Sign-In */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            id="btn-google-signin-modal"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className="w-full min-h-[46px] px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-[#111111] font-bold text-sm rounded-xl transition-all shadow-xs border border-[#CBD5E1] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 text-[#1F8ED8] animate-spin" />
                <span>Menghubungkan ke Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>
          <div className="text-[11px] text-[#64748B] text-center font-medium">
            Akun Google digunakan untuk menyimpan data secara persisten dan aman di Cloud Firestore.
          </div>
        </div>
      </div>
    </div>
  );
}
