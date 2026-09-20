import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ScholarMateLogo } from './ScholarMateLogo.tsx';

interface LoadingViewProps {
  onFinish: () => void;
}

const STATUS_MESSAGES = [
  'Mengecek jenjang, semester, dan profil dasar',
  'Menghitung kelayakan dengan aturan beasiswa terbaru',
  'Menyiapkan rekomendasi & next action personal',
];

export function LoadingView({ onFinish }: LoadingViewProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    // Step through the 3 status messages
    const timer1 = setTimeout(() => {
      setCurrentMessageIndex(1);
    }, 550);

    const timer2 = setTimeout(() => {
      setCurrentMessageIndex(2);
    }, 1100);

    const timer3 = setTimeout(() => {
      onFinish();
    }, 1700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onFinish]);

  return (
    <div
      className="w-full max-w-lg mx-auto min-h-[85vh] flex flex-col items-center justify-center py-12 px-6 text-center"
      id="loading-view-container"
    >
      <div className="mb-6">
        <ScholarMateLogo variant="full" size="md" showAiBadge={true} />
      </div>

      {/* Visual Loader Spinner */}
      <div className="relative mb-6" id="loading-spinner-wrapper">
        <div className="w-14 h-14 rounded-2xl bg-[#EBF5FC] border border-[#BAE0F8] flex items-center justify-center shadow-xs">
          <Loader2 className="w-6 h-6 text-[#1F8ED8] animate-spin" />
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight" id="loading-headline">
        Lagi mencocokkan profilmu…
      </h2>

      <p className="text-xs sm:text-sm text-[#475569] mt-2 max-w-xs leading-relaxed" id="loading-subcopy">
        Kami cek eligibility dulu, baru menyusun rekomendasi personal.
      </p>

      {/* Rotating factual status indicators */}
      <div className="mt-8 w-full max-w-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 text-left space-y-3" id="loading-steps-list">
        {STATUS_MESSAGES.map((msg, index) => {
          const isDone = index < currentMessageIndex;
          const isCurrent = index === currentMessageIndex;

          return (
            <div
              key={msg}
              className={`flex items-center gap-3 text-xs transition-colors duration-200 ${
                isDone
                  ? 'text-[#111111] font-semibold'
                  : isCurrent
                  ? 'text-[#1F8ED8] font-medium'
                  : 'text-slate-400'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-[#1F8ED8] shrink-0" />
              ) : isCurrent ? (
                <span className="w-4 h-4 rounded-full border-2 border-[#1F8ED8] border-t-transparent animate-spin shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
              )}
              <span>{msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
