import React from 'react';

interface ScholarMateLogoProps {
  variant?: 'full' | 'mark' | 'hero';
  size?: 'sm' | 'md' | 'lg';
  showAiBadge?: boolean;
  className?: string;
}

export function ScholarMateLogo({
  variant = 'full',
  size = 'md',
  showAiBadge = true,
  className = '',
}: ScholarMateLogoProps) {
  // Cap SVG icon tailored to match the ScholarMate graduation cap
  const CapIcon = ({ sizeClass = 'w-5 h-5' }: { sizeClass?: string }) => (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${sizeClass} shrink-0 text-[#1F8ED8]`}
    >
      {/* Mortarboard Diamond Top */}
      <path
        d="M14 4.5L25 9.5L14 14.5L3 9.5L14 4.5Z"
        fill="#1F8ED8"
        stroke="#1A7FC2"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Cap Underneath Headband */}
      <path
        d="M7 11.5V16.5C7 19.5 10 21.5 14 21.5C18 21.5 21 19.5 21 16.5V11.5"
        stroke="#1F8ED8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Left-side hanging tassel */}
      <path
        d="M5 10.5V17"
        stroke="#1F8ED8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="5" cy="18" r="1.5" fill="#1F8ED8" />
    </svg>
  );

  if (variant === 'mark') {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-xl bg-white border border-[#E2E8F0] shadow-xs ${
          size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'
        } ${className}`}
        id="scholarmate-logo-mark"
      >
        <div className="relative flex items-center justify-center">
          {/* Tilted cap */}
          <div className="absolute -top-3.5 -left-2 rotate-[-15deg]">
            <CapIcon sizeClass={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
          </div>
          <span
            className={`font-black tracking-tight text-[#1F8ED8] ${
              size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
            }`}
          >
            S
          </span>
        </div>
      </div>
    );
  }

  // Hero variant - larger, with graduation cap prominently placed over the S
  if (variant === 'hero') {
    return (
      <div
        className={`inline-flex items-center select-none ${className}`}
        id="scholarmate-hero-logo"
      >
        <div className="relative inline-flex items-center">
          {/* Graduation Cap placed tilted on top of the S */}
          <div className="absolute -top-4 -left-2.5 sm:-top-5 sm:-left-3 rotate-[-18deg] pointer-events-none drop-shadow-xs">
            <CapIcon sizeClass="w-6 h-6 sm:w-7 sm:h-7" />
          </div>

          <div className="flex items-baseline tracking-tight">
            <span className="font-extrabold text-[#1F8ED8] text-2xl sm:text-3xl tracking-tight">
              Scholar
            </span>
            <span className="mx-1 text-[#111111] font-light text-2xl sm:text-3xl select-none opacity-40">
              |
            </span>
            <span className="font-extrabold text-[#111111] text-2xl sm:text-3xl tracking-tight">
              Mate
            </span>
          </div>

          {showAiBadge && (
            <span className="ml-2 px-2 py-0.5 rounded-md bg-[#EBF5FC] border border-[#1F8ED8]/30 text-[#1F8ED8] font-bold text-xs tracking-wide">
              AI
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default 'full' variant for Navbar / Header
  return (
    <div
      className={`inline-flex items-center select-none ${className}`}
      id="scholarmate-nav-logo"
    >
      <div className="relative inline-flex items-center">
        {/* Graduation Cap tilted on top of the S */}
        <div className="absolute -top-3.5 -left-2 rotate-[-18deg] pointer-events-none">
          <CapIcon sizeClass={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
        </div>

        <div className="flex items-baseline tracking-tight">
          <span
            className={`font-extrabold text-[#1F8ED8] tracking-tight ${
              size === 'sm' ? 'text-base' : 'text-lg sm:text-xl'
            }`}
          >
            Scholar
          </span>
          <span
            className={`mx-0.5 text-[#111111] font-light select-none opacity-40 ${
              size === 'sm' ? 'text-base' : 'text-lg sm:text-xl'
            }`}
          >
            |
          </span>
          <span
            className={`font-extrabold text-[#111111] tracking-tight ${
              size === 'sm' ? 'text-base' : 'text-lg sm:text-xl'
            }`}
          >
            Mate
          </span>
        </div>

        {showAiBadge && (
          <span
            className={`ml-1.5 px-1.5 py-0.5 rounded-md bg-[#EBF5FC] border border-[#1F8ED8]/30 text-[#1F8ED8] font-bold tracking-wide ${
              size === 'sm' ? 'text-[10px]' : 'text-[11px]'
            }`}
            id="brand-ai-badge"
          >
            AI
          </span>
        )}
      </div>
    </div>
  );
}
