interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full pb-2" id="scan-progress-container">
      <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-2">
        <span id="step-indicator-text">Langkah {currentStep} dari {totalSteps}</span>
        <span className="tabular-nums text-[#1F8ED8] font-bold" id="step-percentage-text">{percentage}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden" id="step-progress-track">
        <div
          className="h-full bg-[#1F8ED8] transition-all duration-300 ease-out rounded-full"
          id="step-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
