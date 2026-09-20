import React from 'react';

interface ChoiceButtonProps {
  id?: string;
  selected: boolean;
  onClick: () => void;
  label: string;
  helper?: string;
  variant?: 'compact' | 'standard' | 'card';
  icon?: React.ReactNode;
}

export function ChoiceButton({
  id,
  selected,
  onClick,
  label,
  helper,
  variant = 'standard',
  icon,
}: ChoiceButtonProps) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        id={id}
        onClick={onClick}
        className={`min-h-[44px] px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition-all duration-150 flex items-center justify-center text-center cursor-pointer ${
          selected
            ? 'bg-[#1F8ED8] text-white border-[#1F8ED8] shadow-xs'
            : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#1F8ED8]/40 hover:bg-[#F8FAFC] active:bg-[#EBF5FC]'
        }`}
      >
        {label}
      </button>
    );
  }

  if (variant === 'card') {
    return (
      <button
        type="button"
        id={id}
        onClick={onClick}
        className={`w-full min-h-[56px] p-3.5 sm:p-4 text-left rounded-xl border transition-all duration-150 cursor-pointer flex items-start gap-3 ${
          selected
            ? 'bg-[#EBF5FC] border-[#1F8ED8] ring-1 ring-[#1F8ED8]'
            : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:bg-[#EBF5FC]/50'
        }`}
      >
        <div
          className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
            selected
              ? 'border-[#1F8ED8] bg-[#1F8ED8]'
              : 'border-slate-300 bg-white'
          }`}
        >
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-xs sm:text-sm ${selected ? 'text-[#111111] font-bold' : 'text-[#111111]'}`}>
            {label}
          </div>
          {helper && (
            <div className="text-[11px] sm:text-xs text-[#475569] mt-0.5 leading-relaxed">
              {helper}
            </div>
          )}
        </div>
        {icon && <div className="text-[#1F8ED8] shrink-0 mt-0.5">{icon}</div>}
      </button>
    );
  }

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 flex flex-col justify-center items-center cursor-pointer ${
        selected
          ? 'bg-[#1F8ED8] text-white border-[#1F8ED8] shadow-xs'
          : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:bg-[#EBF5FC]'
      }`}
    >
      <span className="font-semibold">{label}</span>
      {helper && (
        <span
          className={`text-xs mt-0.5 ${
            selected ? 'text-white/90' : 'text-[#475569]'
          }`}
        >
          {helper}
        </span>
      )}
    </button>
  );
}
