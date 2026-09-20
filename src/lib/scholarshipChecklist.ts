import { Scholarship } from '../data/scholarships.ts';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  verifiedSource: boolean;
}

export function generateScholarshipChecklist(scholarship: Scholarship): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // 1. Cek Eligibility
  items.push({
    id: 'eligibility',
    label: 'Cek eligibility & kriteria syarat',
    description: `Verifikasi IPK min ${scholarship.minGpa || 'Sesuai ketentuan'}, semester ${scholarship.semesterMin || 1}-${scholarship.semesterMax || 8}, dan cakupan ${scholarship.universityScope || 'kampus'}.`,
    verifiedSource: true,
  });

  // 2. Siapkan Application Data
  items.push({
    id: 'app_data',
    label: 'Siapkan application data (berkas administrasi)',
    description: 'KTM, transkrip nilai resmi, pas foto, surat keterangan aktif kuliah, dan dokumen pendukung lainnya.',
    verifiedSource: true,
  });

  // 3. Siapkan Essay
  const needsEssay = scholarship.essayRequired === 'YES' || scholarship.selectionMetadata?.essayReviewedInAdministrativeScreening;
  if (needsEssay || scholarship.essayRequired !== 'NO') {
    items.push({
      id: 'essay',
      label: 'Siapkan essay / motivation letter',
      description: 'Susun esai motivasi diri, kontribusi sosial, atau rencana studi sesuai panduan resmi provider.',
      verifiedSource: true,
    });
  }

  // 4. Persiapan Psychometric (jika ada dalam selection stages atau metadata)
  const hasPsychometric =
    scholarship.selectionMetadata?.psychometricAssessment ||
    scholarship.selectionStages?.some((s) => s.toLowerCase().includes('psychometric') || s.toLowerCase().includes('psikotes'));
  if (hasPsychometric) {
    items.push({
      id: 'psychometric',
      label: 'Persiapan psychometric / tes potensi',
      description: 'Latihan soal logika, numerik, dan tes kepribadian yang diujikan oleh panitia seleksi.',
      verifiedSource: true,
    });
  }

  // 5. Persiapan FGD (jika ada dalam selection stages atau metadata)
  const hasFgd =
    scholarship.selectionMetadata?.fgdSelection ||
    scholarship.selectionStages?.some((s) => s.toLowerCase().includes('fgd') || s.toLowerCase().includes('group discussion'));
  if (hasFgd) {
    items.push({
      id: 'fgd',
      label: 'Persiapan FGD (Focus Group Discussion)',
      description: 'Latihan komunikasi efektif, teknik berargumen kolaboratif, dan studi kasus kelompok.',
      verifiedSource: true,
    });
  }

  // 6. Persiapan Wawancara (jika interviewRequired YES)
  const hasInterview =
    scholarship.interviewRequired === 'YES' ||
    scholarship.selectionMetadata?.interviewSelection ||
    scholarship.selectionStages?.some((s) => s.toLowerCase().includes('interview') || s.toLowerCase().includes('wawancara'));
  if (hasInterview) {
    items.push({
      id: 'interview',
      label: 'Persiapan wawancara / interview',
      description: 'Simulasi tanya jawab seputar prestasi, visi kepemimpinan, dan kesiapan menerima beasiswa.',
      verifiedSource: true,
    });
  }

  // 7. Submit
  items.push({
    id: 'submit',
    label: 'Submit aplikasi sebelum deadline',
    description: 'Periksa kembali kelengkapan formulir dan submit sebelum batas waktu pendaftaran ditutup.',
    verifiedSource: true,
  });

  return items;
}
