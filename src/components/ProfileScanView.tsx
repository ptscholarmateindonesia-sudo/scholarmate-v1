import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, AlertCircle, Info } from 'lucide-react';
import {
  ScanFormProfile,
  trackEvent,
} from '../types.ts';
import {
  searchUniversitySuggestions,
  searchMajorSuggestions,
} from '../data/campusMajorMapping.ts';
import { ProgressBar } from './ProgressBar.tsx';
import { ChoiceButton } from './ChoiceButton.tsx';
import { ScholarMateLogo } from './ScholarMateLogo.tsx';

interface ProfileScanViewProps {
  initialProfile: ScanFormProfile;
  initialStep?: number;
  onComplete: (profile: ScanFormProfile) => void;
  onBackToLanding: () => void;
}

export function ProfileScanView({
  initialProfile,
  initialStep = 1,
  onComplete,
  onBackToLanding,
}: ProfileScanViewProps) {
  const [step, setStep] = useState<number>(initialStep);
  const [profile, setProfile] = useState<ScanFormProfile>(initialProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Autocomplete filter states
  const [showUniSuggestions, setShowUniSuggestions] = useState(false);
  const [showMajorSuggestions, setShowMajorSuggestions] = useState(false);

  // Field updater
  const updateField = <K extends keyof ScanFormProfile>(
    field: K,
    value: ScanFormProfile[K]
  ) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    // Clear error for that field immediately
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!profile.educationLevel) {
      newErrors.educationLevel = 'Pilih salah satu jenjang kuliah dulu ya.';
    }
    if (profile.semester === null) {
      newErrors.semester = 'Pilih semester kamu saat ini.';
    }
    if (!profile.university.trim()) {
      newErrors.university = 'Tuliskan atau pilih nama kampus kamu.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!profile.major.trim()) {
      newErrors.major = 'Tuliskan atau pilih jurusan kamu.';
    }

    // If semester >= 2, GPA is required and must be between 0.00 and 4.00
    if (profile.semester !== null && profile.semester >= 2) {
      if (!profile.gpa || profile.gpa.trim() === '') {
        newErrors.gpa = 'Masukkan IPK kamu saat ini.';
      } else {
        const gpaNum = parseFloat(profile.gpa.replace(',', '.'));
        if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4.0) {
          newErrors.gpa = 'Masukkan IPK antara 0.00–4.00.';
        }
      }
    }

    if (profile.receivesOtherScholarship === null) {
      newErrors.receivesOtherScholarship = 'Pilih salah satu dulu ya.';
    } else if (profile.receivesOtherScholarship && !profile.currentScholarshipName.trim()) {
      newErrors.currentScholarshipName = 'Tuliskan nama beasiswa yang sedang kamu terima.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (profile.hasOrganization === null) {
      newErrors.hasOrganization = 'Pilih salah satu dulu ya.';
    }
    if (profile.hasAchievement === null) {
      newErrors.hasAchievement = 'Pilih salah satu dulu ya.';
    }
    if (profile.hasVolunteer === null) {
      newErrors.hasVolunteer = 'Pilih salah satu dulu ya.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 4 Validation
  const validateStep4 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!profile.goal) {
      newErrors.goal = 'Pilih kebutuhan utamamu saat ini.';
    }
    if (!profile.citizenship) {
      newErrors.citizenship = 'Pilih kewarganegaraan kamu.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        trackEvent('scan_step_completed', { step: 1, educationLevel: profile.educationLevel, semester: profile.semester });
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (step === 2) {
      if (validateStep2()) {
        trackEvent('scan_step_completed', { step: 2, major: profile.major });
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (step === 3) {
      if (validateStep3()) {
        trackEvent('scan_step_completed', { step: 3 });
        setStep(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (step === 4) {
      if (validateStep4()) {
        trackEvent('scan_completed', {
          educationLevel: profile.educationLevel,
          semester: profile.semester,
          goal: profile.goal,
        });
        onComplete(profile);
      }
    }
  };

  const handleBack = () => {
    setErrors({});
    if (step === 1) {
      onBackToLanding();
    } else {
      setStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Campus suggestions from campus mapping
  const uniSuggestions = searchUniversitySuggestions(profile.university, 6);

  // Major suggestions from major mapping
  const majorSuggestions = searchMajorSuggestions(profile.major, 6);

  return (
    <div className="w-full max-w-lg mx-auto min-h-[92vh] flex flex-col justify-between py-6 px-4 sm:px-6" id="scan-flow-container">
      {/* Top Bar with Navigation & Progress */}
      <div className="w-full" id="scan-top-bar">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            id="btn-scan-back-top"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#111111] transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{step === 1 ? 'Kembali ke Beranda' : 'Kembali'}</span>
          </button>

          <ScholarMateLogo variant="full" size="sm" showAiBadge={true} />
        </div>

        <ProgressBar currentStep={step} totalSteps={4} />
      </div>

      {/* Main Step Content */}
      <main className="flex-1 py-4 flex flex-col justify-start" id={`scan-step-${step}-content`}>
        {/* ================= STEP 1 ================= */}
        {step === 1 && (
          <div className="space-y-6" id="step-1-form">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight" id="step-1-headline">
                Mulai dari profil kuliahmu
              </h2>
              <p className="text-xs sm:text-sm text-[#475569]" id="step-1-subcopy">
                Biar ScholarMate nggak kasih rekomendasi yang terlalu umum.
              </p>
            </div>

            {/* Question 1: Jenjang */}
            <div className="space-y-2.5" id="group-education-level">
              <label className="block text-sm font-semibold text-[#111111]">
                Kamu sedang kuliah di jenjang apa?
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {['S1', 'D4', 'D3'].map((lvl) => (
                  <ChoiceButton
                    key={lvl}
                    id={`btn-jenjang-${lvl.toLowerCase()}`}
                    label={lvl}
                    selected={profile.educationLevel === lvl}
                    onClick={() => updateField('educationLevel', lvl)}
                  />
                ))}
              </div>
              {errors.educationLevel && (
                <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium" id="error-education-level">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.educationLevel}
                </p>
              )}
            </div>

            {/* Question 2: Semester */}
            <div className="space-y-2.5" id="group-semester">
              <label className="block text-sm font-semibold text-[#111111]">
                Sekarang semester berapa?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <ChoiceButton
                    key={sem}
                    id={`btn-semester-${sem}`}
                    label={sem === 8 ? '8+' : `${sem}`}
                    variant="compact"
                    selected={profile.semester === sem}
                    onClick={() => {
                      updateField('semester', sem);
                      // If user selects semester 1, reset GPA
                      if (sem === 1) {
                        updateField('gpa', '');
                      }
                    }}
                  />
                ))}
              </div>
              {errors.semester && (
                <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium" id="error-semester">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.semester}
                </p>
              )}
            </div>

            {/* Question 3: Kampus */}
            <div className="space-y-2 relative" id="group-university">
              <label className="block text-sm font-semibold text-[#111111]" htmlFor="input-university">
                Kamu kuliah di kampus mana?
              </label>
              <div className="relative">
                <input
                  id="input-university"
                  type="text"
                  value={profile.university}
                  onChange={(e) => {
                    updateField('university', e.target.value);
                    setShowUniSuggestions(true);
                  }}
                  onFocus={() => setShowUniSuggestions(true)}
                  placeholder="Contoh: Universitas Brawijaya"
                  className="w-full min-h-[48px] px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F8ED8]/20 focus:border-[#1F8ED8] transition-colors text-[#111111] placeholder:text-slate-400"
                />
              </div>

              {/* Autocomplete dropdown suggestion chips */}
              {showUniSuggestions && profile.university.trim().length > 0 && uniSuggestions.length > 0 && (
                <div
                  className="absolute z-20 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg mt-1 overflow-hidden"
                  id="university-suggestions-dropdown"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    Saran Kampus Terverifikasi
                  </div>
                  {uniSuggestions.map((uni) => (
                    <button
                      key={uni.id}
                      type="button"
                      onMouseDown={() => {
                        updateField('university', uni.canonicalName);
                        setShowUniSuggestions(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-[#111111] hover:bg-[#EBF5FC] hover:text-[#1F8ED8] flex items-center justify-between transition-colors cursor-pointer border-b border-[#F8FAFC] last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span>{uni.canonicalName}</span>
                        <span className="text-[10px] font-semibold text-[#475569] bg-slate-100 px-1.5 py-0.5 rounded">
                          {uni.id}
                        </span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-[#1F8ED8]" />
                    </button>
                  ))}
                </div>
              )}

              {/* Quick suggestions if empty */}
              {!profile.university && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-[#475569]">Pilihan populer:</span>
                  {[
                    { label: 'UB', name: 'Universitas Brawijaya' },
                    { label: 'UI', name: 'Universitas Indonesia' },
                    { label: 'UGM', name: 'Universitas Gadjah Mada' },
                    { label: 'ITB', name: 'Institut Teknologi Bandung' }
                  ].map((quickUni) => (
                    <button
                      key={quickUni.label}
                      type="button"
                      onClick={() => updateField('university', quickUni.name)}
                      className="px-2 py-0.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BAE0F8] hover:bg-[#EBF5FC] hover:text-[#1F8ED8] text-[#475569] rounded-md transition-colors cursor-pointer"
                    >
                      {quickUni.label} ({quickUni.name})
                    </button>
                  ))}
                </div>
              )}

              {errors.university && (
                <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium" id="error-university">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.university}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 2 ================= */}
        {step === 2 && (
          <div className="space-y-6" id="step-2-form">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight" id="step-2-headline">
                Sekarang bagian akademik
              </h2>
              <p className="text-xs sm:text-sm text-[#475569]" id="step-2-subcopy">
                Cuma data yang benar-benar dibutuhkan untuk cek eligibility.
              </p>
            </div>

            {/* Question 4: Jurusan */}
            <div className="space-y-2 relative" id="group-major">
              <label className="block text-sm font-semibold text-[#111111]" htmlFor="input-major">
                Jurusan kamu apa?
              </label>
              <input
                id="input-major"
                type="text"
                value={profile.major}
                onChange={(e) => {
                  updateField('major', e.target.value);
                  setShowMajorSuggestions(true);
                }}
                onFocus={() => setShowMajorSuggestions(true)}
                placeholder="Contoh: Teknik Lingkungan"
                className="w-full min-h-[48px] px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F8ED8]/20 focus:border-[#1F8ED8] transition-colors text-[#111111] placeholder:text-slate-400"
              />

              {/* Suggestions */}
              {showMajorSuggestions && profile.major.trim().length > 0 && majorSuggestions.length > 0 && (
                <div
                  className="absolute z-20 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg mt-1 overflow-hidden"
                  id="major-suggestions-dropdown"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    Saran Jurusan Terverifikasi
                  </div>
                  {majorSuggestions.map((m) => (
                    <button
                      key={m.canonicalName}
                      type="button"
                      onMouseDown={() => {
                        updateField('major', m.canonicalName);
                        setShowMajorSuggestions(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-[#111111] hover:bg-[#EBF5FC] hover:text-[#1F8ED8] flex items-center justify-between transition-colors cursor-pointer border-b border-[#F8FAFC] last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span>{m.canonicalName}</span>
                        <span className="text-[10px] text-[#475569] bg-slate-100 px-1.5 py-0.5 rounded">
                          {m.majorGroup}
                        </span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-[#1F8ED8]" />
                    </button>
                  ))}
                </div>
              )}

              {/* Quick suggestions if empty */}
              {!profile.major && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-[#475569]">Contoh:</span>
                  {['Teknik Lingkungan', 'Teknik Informatika', 'Akuntansi', 'Manajemen'].map((quickMajor) => (
                    <button
                      key={quickMajor}
                      type="button"
                      onClick={() => updateField('major', quickMajor)}
                      className="px-2 py-0.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BAE0F8] hover:bg-[#EBF5FC] hover:text-[#1F8ED8] text-[#475569] rounded-md transition-colors cursor-pointer"
                    >
                      {quickMajor}
                    </button>
                  ))}
                </div>
              )}

              {errors.major && (
                <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium" id="error-major">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.major}
                </p>
              )}
            </div>

            {/* Question 5: IPK (HIDDEN if semester === 1, SHOWN if semester >= 2) */}
            {profile.semester !== null && profile.semester >= 2 ? (
              <div className="space-y-2 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]" id="group-gpa">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#111111]" htmlFor="input-gpa">
                    Berapa IPK kamu saat ini?
                  </label>
                  <span className="text-xs text-[#475569] font-medium">Skala 0.00 – 4.00</span>
                </div>
                <input
                  id="input-gpa"
                  type="text"
                  inputMode="decimal"
                  value={profile.gpa}
                  onChange={(e) => updateField('gpa', e.target.value)}
                  placeholder="3.55"
                  className="w-full min-h-[48px] px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F8ED8]/20 focus:border-[#1F8ED8] transition-colors text-[#111111] placeholder:text-slate-400 font-medium"
                />
                {errors.gpa && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium" id="error-gpa">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.gpa}
                  </p>
                )}
              </div>
            ) : (
              <div className="px-3.5 py-3 rounded-xl bg-[#EBF5FC] border border-[#BAE0F8] text-xs text-[#1F8ED8] flex items-start gap-2.5 font-medium" id="notice-semester-1-gpa">
                <Info className="w-4 h-4 text-[#1F8ED8] shrink-0 mt-0.5" />
                <span className="leading-relaxed text-[#0F5A8A]">
                  Karena kamu semester 1, pertanyaan IPK disembunyikan. Eligibility beasiswa akan dinilai dari jalur masuk atau nilai pendukung lain.
                </span>
              </div>
            )}

            {/* Question 6: Sedang menerima beasiswa lain? */}
            <div className="space-y-3" id="group-other-scholarship">
              <label className="block text-sm font-semibold text-[#111111]">
                Sedang menerima beasiswa lain?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceButton
                  id="btn-beasiswa-lain-ya"
                  label="Ya"
                  selected={profile.receivesOtherScholarship === true}
                  onClick={() => updateField('receivesOtherScholarship', true)}
                />
                <ChoiceButton
                  id="btn-beasiswa-lain-tidak"
                  label="Tidak"
                  selected={profile.receivesOtherScholarship === false}
                  onClick={() => {
                    updateField('receivesOtherScholarship', false);
                    updateField('currentScholarshipName', '');
                  }}
                />
              </div>

              {errors.receivesOtherScholarship && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium" id="error-other-scholarship">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.receivesOtherScholarship}
                </p>
              )}

              {/* Conditional inline field if Ya */}
              {profile.receivesOtherScholarship === true && (
                <div className="mt-3 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2" id="box-current-scholarship-name">
                  <label className="block text-xs font-semibold text-[#111111]" htmlFor="input-current-scholarship-name">
                    Beasiswa apa yang sedang kamu terima?
                  </label>
                  <input
                    id="input-current-scholarship-name"
                    type="text"
                    value={profile.currentScholarshipName}
                    onChange={(e) => updateField('currentScholarshipName', e.target.value)}
                    placeholder="Contoh: KIP-K"
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F8ED8]/20 focus:border-[#1F8ED8] transition-colors text-[#111111] placeholder:text-slate-400"
                  />
                  {errors.currentScholarshipName && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium" id="error-current-scholarship-name">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.currentScholarshipName}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 3 ================= */}
        {step === 3 && (
          <div className="space-y-6" id="step-3-form">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight" id="step-3-headline">
                Aktivitas di luar kelas
              </h2>
              <p className="text-xs sm:text-sm text-[#475569]" id="step-3-subcopy">
                Nggak perlu punya semuanya. Jawab sesuai kondisi sekarang.
              </p>
            </div>

            {/* Question 7: Organisasi */}
            <div className="space-y-2.5" id="group-organization">
              <div>
                <label className="block text-sm font-semibold text-[#111111]">
                  Aktif organisasi atau kepanitiaan?
                </label>
                <p className="text-xs text-[#475569] mt-0.5">Nggak harus jadi ketua.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceButton
                  id="btn-org-ya"
                  label="Ya"
                  selected={profile.hasOrganization === true}
                  onClick={() => updateField('hasOrganization', true)}
                />
                <ChoiceButton
                  id="btn-org-tidak"
                  label="Tidak"
                  selected={profile.hasOrganization === false}
                  onClick={() => updateField('hasOrganization', false)}
                />
              </div>
              {errors.hasOrganization && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium" id="error-organization">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.hasOrganization}
                </p>
              )}
            </div>

            {/* Question 8: Prestasi */}
            <div className="space-y-2.5" id="group-achievement">
              <div>
                <label className="block text-sm font-semibold text-[#111111]">
                  Punya prestasi akademik/non-akademik?
                </label>
                <p className="text-xs text-[#475569] mt-0.5">
                  Lomba, kompetisi, penghargaan, atau pencapaian lain.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceButton
                  id="btn-prestasi-ya"
                  label="Ya"
                  selected={profile.hasAchievement === true}
                  onClick={() => updateField('hasAchievement', true)}
                />
                <ChoiceButton
                  id="btn-prestasi-tidak"
                  label="Tidak"
                  selected={profile.hasAchievement === false}
                  onClick={() => updateField('hasAchievement', false)}
                />
              </div>
              {errors.hasAchievement && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium" id="error-achievement">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.hasAchievement}
                </p>
              )}
            </div>

            {/* Question 9: Volunteer */}
            <div className="space-y-2.5" id="group-volunteer">
              <div>
                <label className="block text-sm font-semibold text-[#111111]">
                  Pernah ikut volunteer atau kegiatan sosial?
                </label>
                <p className="text-xs text-[#475569] mt-0.5">
                  Termasuk project sosial atau lingkungan.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceButton
                  id="btn-volunteer-ya"
                  label="Ya"
                  selected={profile.hasVolunteer === true}
                  onClick={() => updateField('hasVolunteer', true)}
                />
                <ChoiceButton
                  id="btn-volunteer-tidak"
                  label="Tidak"
                  selected={profile.hasVolunteer === false}
                  onClick={() => updateField('hasVolunteer', false)}
                />
              </div>
              {errors.hasVolunteer && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium" id="error-volunteer">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.hasVolunteer}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 4 ================= */}
        {step === 4 && (
          <div className="space-y-6" id="step-4-form">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111] tracking-tight" id="step-4-headline">
                Terakhir, kamu lagi butuh apa?
              </h2>
              <p className="text-xs sm:text-sm text-[#475569]" id="step-4-subcopy">
                Ini membantu ScholarMate menentukan rekomendasi dan next action.
              </p>
            </div>

            {/* Question 10: Goal Card choices */}
            <div className="space-y-2.5" id="group-goal">
              <label className="block text-sm font-semibold text-[#111111]">
                Apa yang paling kamu butuhkan sekarang?
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'cari-beasiswa-aktif',
                    title: 'Cari beasiswa aktif',
                    desc: 'Temukan program yang pendaftarannya sedang buka atau segera buka.',
                  },
                  {
                    id: 'cek-kecocokan-profil',
                    title: 'Cek kecocokan profil',
                    desc: 'Cari tahu program mana yang paling sesuai dengan kualifikasi kamu.',
                  },
                  {
                    id: 'siapkan-aplikasi',
                    title: 'Siapkan aplikasi',
                    desc: 'Mulai susun berkas, esai, dan persyaratan sebelum deadline.',
                  },
                  {
                    id: 'bangun-profil-dari-sekarang',
                    title: 'Bangun profil dari sekarang',
                    desc: 'Petakan apa yang masih kurang untuk beasiswa di semester mendatang.',
                  },
                ].map((item) => (
                  <ChoiceButton
                    key={item.id}
                    id={`btn-goal-${item.id}`}
                    label={item.title}
                    helper={item.desc}
                    variant="card"
                    selected={profile.goal === item.title}
                    onClick={() => updateField('goal', item.title)}
                  />
                ))}
              </div>
              {errors.goal && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium" id="error-goal">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.goal}
                </p>
              )}
            </div>

            {/* Question 11: Kewarganegaraan */}
            <div className="space-y-2.5" id="group-citizenship">
              <label className="block text-sm font-semibold text-[#111111]">
                Kewarganegaraan kamu?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['WNI', 'Lainnya'].map((cit) => (
                  <ChoiceButton
                    key={cit}
                    id={`btn-citizenship-${cit.toLowerCase()}`}
                    label={cit}
                    selected={profile.citizenship === cit}
                    onClick={() => updateField('citizenship', cit)}
                  />
                ))}
              </div>
              {errors.citizenship && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium" id="error-citizenship">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.citizenship}
                </p>
              )}
            </div>

            {/* Trust Note */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#475569] leading-relaxed" id="trust-note-box">
              <span className="font-bold text-[#111111]">Catatan Kesiapan:</span> ScholarMate tidak menjanjikan peluang lolos. Score nantinya berarti kesiapan profil, bukan probabilitas diterima.
            </div>
          </div>
        )}
      </main>

      {/* Bottom Actions */}
      <footer className="pt-6 border-t border-[#E2E8F0] flex items-center gap-3" id="scan-navigation-footer">
        <button
          type="button"
          id="btn-scan-back"
          onClick={handleBack}
          className="min-h-[48px] px-5 py-2.5 border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111111] active:bg-[#E2E8F0] font-semibold text-sm rounded-xl transition-colors cursor-pointer"
        >
          Kembali
        </button>

        <button
          type="button"
          id={step === 4 ? 'btn-submit-scan' : 'btn-scan-next'}
          onClick={handleNext}
          className="flex-1 min-h-[48px] px-6 py-2.5 bg-[#1F8ED8] hover:bg-[#197EC2] active:bg-[#156FAE] text-white font-bold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
        >
          <span>{step === 4 ? 'Lihat Hasil Saya' : 'Lanjut'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
