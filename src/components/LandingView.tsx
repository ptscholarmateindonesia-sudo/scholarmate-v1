import { ArrowRight, Bookmark, LogOut } from 'lucide-react';
import { trackEvent } from '../types.ts';
import { ScholarMateLogo } from './ScholarMateLogo.tsx';
import { AuthUser } from '../lib/authService.ts';

interface LandingViewProps {
  onStartScan: () => void;
  hasSavedResult?: boolean;
  savedAtTimestamp?: string;
  savedUserEmail?: string;
  currentUser?: AuthUser | null;
  onRestoreSavedResult?: () => void;
  onNewScanFromSaved?: () => void;
  onGoogleSignInClick?: () => void;
  onSignOut?: () => void;
  onOpenMyScholarships?: () => void;
}

export function LandingView({
  onStartScan,
  hasSavedResult = false,
  savedAtTimestamp,
  savedUserEmail,
  currentUser,
  onRestoreSavedResult,
  onNewScanFromSaved,
  onGoogleSignInClick,
  onSignOut,
  onOpenMyScholarships,
}: LandingViewProps) {
  const handleStart = () => {
    trackEvent('scan_started', { entry_point: 'landing_primary_cta' });
    onStartScan();
  };

  const handleRestore = () => {
    trackEvent('saved_result_restored', { entry_point: 'landing_returning_card' });
    if (onRestoreSavedResult) {
      onRestoreSavedResult();
    }
  };

  const handleNewScan = () => {
    trackEvent('new_scan_started_from_saved_state', { entry_point: 'landing_returning_card' });
    if (onNewScanFromSaved) {
      onNewScanFromSaved();
    } else {
      onStartScan();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col justify-between min-h-[90vh] py-6 px-4 sm:px-6" id="landing-page-container">
      {/* 1. TOP NAVBAR: Clean, professional, with official ScholarMate AI logo & Google Auth */}
      <header className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] gap-2" id="landing-header">
        <div className="flex items-center gap-2">
          <ScholarMateLogo variant="full" size="md" showAiBadge={true} />
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] py-1 px-2.5 rounded-full shadow-2xs">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Google Avatar"
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#EBF5FC] text-[#1F8ED8] flex items-center justify-center text-[10px] font-bold">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-semibold text-[#111111] max-w-[100px] truncate hidden sm:inline">
                {currentUser.displayName || currentUser.email}
              </span>
              {onSignOut && (
                <button
                  type="button"
                  id="btn-landing-signout"
                  onClick={onSignOut}
                  className="text-[#64748B] hover:text-rose-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Keluar dari Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            onGoogleSignInClick && (
              <button
                type="button"
                id="btn-landing-google-signin"
                onClick={onGoogleSignInClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[11px] font-bold text-[#111111] shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                <span>Masuk</span>
              </button>
            )
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF5FC] border border-[#BAE0F8] text-[11px] font-semibold text-[#1F8ED8]" id="badge-target-audience">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F8ED8]" />
            <span>S1 & D4</span>
          </div>
          {onOpenMyScholarships && (
            <button
              type="button"
              id="btn-my-scholarships-landing"
              onClick={onOpenMyScholarships}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800 shadow-2xs transition-colors cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              <span>Beasiswa Saya</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. LANDING HERO */}
      <main className="my-auto py-8 flex flex-col items-center text-center" id="landing-hero">
        {/* Returning User Card */}
        {hasSavedResult ? (
          <div className="w-full max-w-md mb-8 bg-amber-50/90 border border-amber-200 rounded-2xl p-4 sm:p-5 text-left space-y-3.5 shadow-xs" id="returning-user-card">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[11px] font-bold text-amber-900">
                <Bookmark className="w-3 h-3 text-amber-700" />
                <span>Cloud Snapshot Ditemukan</span>
              </div>
              {savedAtTimestamp && (
                <span className="text-[10px] text-amber-800 font-medium">
                  Tersimpan: {new Date(savedAtTimestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>

            <div>
              <h2 className="text-base font-extrabold text-[#111111] leading-snug">
                Selamat datang kembali
              </h2>
              <p className="text-xs text-[#475569] mt-1 leading-relaxed font-normal">
                {currentUser?.email ? (
                  <span>Snapshot profil &amp; jawaban tersimpan untuk akun <strong>{currentUser.email}</strong>. Klik lanjut untuk mencocokkan ulang dengan data beasiswa terbaru.</span>
                ) : (
                  <span>Kamu punya snapshot profil dan progres yang tersimpan di cloud. Lanjutkan untuk mengecek kecocokan terbaru tanpa isi ulang.</span>
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-restore-saved-result"
                onClick={handleRestore}
                className="flex-1 min-h-[42px] px-4 py-2 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Lanjutkan Hasil Terakhir</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                id="btn-start-new-scan"
                onClick={handleNewScan}
                className="px-4 py-2 border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#475569] font-semibold text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer min-h-[42px]"
              >
                <span>Mulai Scan Baru</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Brand wordmark / Pill near top of hero section */}
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] text-xs font-medium shadow-xs" id="badge-audience-pills">
              <span className="w-2 h-2 rounded-full bg-[#1F8ED8]" />
              <span className="font-semibold text-[#111111]">ScholarMate Copilot</span>
              <span className="text-[#CBD5E1]">•</span>
              <span>S1 & D4</span>
              <span className="text-[#CBD5E1]">•</span>
              <span>Indonesia</span>
            </div>

            <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#111111] tracking-tight leading-snug max-w-md" id="hero-headline">
              Beasiswa apa yang sebenarnya cocok buat kamu?
            </h1>

            <p className="mt-3 text-sm text-[#475569] leading-relaxed max-w-md font-normal" id="hero-subheadline">
              Isi profil singkat dan lihat peluang yang relevan, apa yang sudah kuat, dan apa yang perlu kamu siapkan.
            </p>

            {/* PRIMARY CTA: High contrast brand blue */}
            <div className="w-full max-w-sm mt-7 flex flex-col items-center" id="hero-cta-group">
              <button
                type="button"
                id="btn-start-profile-scan"
                onClick={handleStart}
                className="w-full min-h-[48px] px-6 py-3 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white font-bold text-sm sm:text-base rounded-xl transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
              >
                <span>Cek Profil Beasiswa — Gratis</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Trust Microcopy */}
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#475569] font-medium" id="trust-indicator-text">
                <span>Gratis</span>
                <span className="text-[#CBD5E1]">•</span>
                <span>±2 menit</span>
                <span className="text-[#CBD5E1]">•</span>
                <span>Tanpa buat akun</span>
              </div>
            </div>
          </>
        )}

        {/* Alur Pengecekan Card */}
        <div className="w-full mt-8 text-left bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-4 sm:p-5" id="how-it-works-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-3.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1F8ED8]" />
            <span>Alur Pengecekan</span>
          </div>
          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#EBF5FC] text-[#1F8ED8] border border-[#BAE0F8] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div>
                <div className="text-sm font-bold text-[#111111] leading-snug">
                  Isi profil singkat
                </div>
                <div className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                  Jenjang, semester, jurusan, dan aktivitas dasar.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#EBF5FC] text-[#1F8ED8] border border-[#BAE0F8] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div>
                <div className="text-sm font-bold text-[#111111] leading-snug">
                  ScholarMate cek kecocokan
                </div>
                <div className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                  Validasi eligibility syarat akademik & non-akademik.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#EBF5FC] text-[#1F8ED8] border border-[#BAE0F8] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div>
                <div className="text-sm font-bold text-[#111111] leading-snug">
                  Dapat rekomendasi + next action
                </div>
                <div className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                  Pahami yang cocok, gap profil, dan langkah persiapan.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="pt-4 border-t border-[#E2E8F0] text-center text-xs text-[#475569] font-medium" id="landing-footer">
        <p>Cari yang cocok. Tahu yang kurang. Siapkan sampai daftar.</p>
      </footer>
    </div>
  );
}
