export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  educationLevel: string;
  targetSegment: string;
  semesterMin: number | null;
  semesterMax: number | null;
  minGpa: number | null;
  majorScope: string;
  universityScope: string;
  ageMax: number | null;
  fundingType: string;
  benefitsSummary: string;
  deadline: number | null; // Excel date number
  status: 'OPEN' | 'CLOSED';
  registrationUrl: string;
  officialSourceUrl: string;
  lastChecked: number | null;
  verificationStatus: 'SOURCE_FOUND' | 'HUMAN_VERIFIED' | 'NEEDS_RECHECK';
  essayRequired: string;
  interviewRequired: string;
  essayPrompts?: string[];
  characterLimit?: number;
  notesInternal: string;
  duration?: string;
  selectionStages?: string[];
  externalCategoryDescription?: string;
  selectionMetadata?: {
    psychometricAssessment?: boolean;
    fgdSelection?: boolean;
    interviewSelection?: boolean;
    essayReviewedInAdministrativeScreening?: boolean;
  };
}

export const SCHOLARSHIPS: Scholarship[] = [
  {
    id: "BCB-2026",
    name: "Beasiswa Cendekia BAZNAS Dalam Negeri 2026",
    provider: "BAZNAS RI",
    educationLevel: "S1/D4",
    targetSegment: "S1/D4",
    semesterMin: 5,
    semesterMax: 5,
    minGpa: 3,
    majorScope: "SPECIFIC_MAJOR",
    universityScope: "SPECIFIC_UNIVERSITY",
    ageMax: null,
    fundingType: "TUITION",
    benefitsSummary: "Subsidi UKT hingga Rp7 juta/semester untuk kampus prioritas atau Rp4 juta/semester untuk kampus reguler selama 4 semester; bantuan riset tugas akhir Rp3 juta; pembinaan/pengembangan diri.",
    deadline: 46292,
    status: "OPEN",
    registrationUrl: "https://beasiswa.baznas.go.id/",
    officialSourceUrl: "https://www.baznas.go.id/news-show/BAZNAS_RI_Bersama_Kemendiktisaintek_Resmi_Buka_Beasiswa_Cendekia_2026_di_246_Perguruan_Tinggi/4303",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "YES",
    interviewRequired: "YES",
    essayPrompts: [
      "Rencana Pasca Lulus: Bagaimana Anda akan berkontribusi bagi Indonesia dan BAZNAS setelah menyelesaikan studi?",
      "Esai Kontribusi: Jelaskan pengalaman Anda dalam kegiatan sosial atau organisasi yang berdampak bagi masyarakat."
    ],
    notesInternal: "Aktif di 246 perguruan tinggi. Jurusan prioritas STEM/SHARE. Harus memenuhi salah satu kategori: prestasi, aktivis, atau disabilitas. Detail GPA 3.00 dikonfirmasi melalui pengumuman kampus mitra resmi."
  },
  {
    id: "BCA-BAKTI-2027",
    name: "Beasiswa Bakti BCA 2027",
    provider: "PT Bank Central Asia Tbk",
    educationLevel: "S1",
    targetSegment: "S1/D4",
    semesterMin: 3,
    semesterMax: 3,
    minGpa: null,
    majorScope: "ALL",
    universityScope: "PTN",
    ageMax: 21,
    fundingType: "TUITION+ALLOWANCE",
    benefitsSummary: "Dana pendidikan (uang saku dan bantuan biaya kuliah) serta program pengembangan Bakti Champions selama 1 tahun.",
    deadline: 46295,
    status: "OPEN",
    registrationUrl: "https://beasiswabaktibca.bca.co.id/",
    officialSourceUrl: "https://www.bca.co.id/id/tentang-bca/CSR/Bakti-BCA/bakti-pendidikan/beasiswa-bakti-bca",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "UNKNOWN",
    interviewRequired: "YES",
    notesInternal: "Hanya S1 non-vokasi PTN. WNI, belum menikah, usia <=21 per 31 Des 2026, semester 3, tidak menerima beasiswa lain. Ada kriteria khusus salah satu kategori (Finansial/Akademis/Non-Akademis) yang harus dievaluasi terpisah."
  },
  {
    id: "JAPFA-EXT-2026-B2",
    name: "Beasiswa JAPFA Untuk Anak Negeri — Cohort 2026",
    provider: "PT Japfa Comfeed Indonesia Tbk & Edu Farmers International Foundation",
    educationLevel: "MULTI",
    targetSegment: "S1/D4/D3",
    semesterMin: 1,
    semesterMax: 5,
    minGpa: 3.0,
    majorScope: "ALL",
    universityScope: "PTN_PTS_INDONESIA",
    ageMax: null,
    fundingType: "OTHER",
    benefitsSummary: "Dukungan finansial pendidikan selama 2 tahun / 4 semester akademik, leadership development, industry exposure, professional networking, dan kegiatan kontribusi sosial.",
    deadline: 46295, // 2026-09-30
    status: "OPEN",
    registrationUrl: "https://www.beasiswajapfa.co.id/register",
    officialSourceUrl: "https://www.beasiswajapfa.co.id/scholarship/program",
    lastChecked: 46285, // 2026-09-20
    verificationStatus: "HUMAN_VERIFIED",
    essayRequired: "YES",
    interviewRequired: "NO",
    essayPrompts: [
      "Career Aspiration: Describe your long-term career goals and how this scholarship will help you achieve them.",
      "Industry Insight: Share your perspective on the agricultural industry in Indonesia."
    ],
    duration: "2 years / 4 academic semesters",
    externalCategoryDescription: "General-public university students who demonstrate academic and/or non-academic potential and meet program requirements.",
    selectionStages: [
      "Application Period",
      "Administrative Screening",
      "Psychometric Assessment",
      "FGD Selection",
      "Selection Results",
      "Onboarding"
    ],
    selectionMetadata: {
      psychometricAssessment: true,
      fgdSelection: true,
      interviewSelection: false,
      essayReviewedInAdministrativeScreening: true
    },
    notesInternal: "Kategori Eksternal Cohort 2026: D3/D4/S1 semester 1–5 PTN/PTS, IPK min 3.00, tidak menerima beasiswa lain, aktif organisasi/kompetisi/komunitas/volunteer. Tahapan: Seleksi Administrasi (data/berkas/esai), Asesmen Psikometri, FGD Selection, Pengumuman, Onboarding (tanpa wawancara individu)."
  },
  {
    id: "TANOTO-TELADAN-2027",
    name: "Program Beasiswa Kepemimpinan TELADAN 2027",
    provider: "Tanoto Foundation",
    educationLevel: "S1",
    targetSegment: "S1/D4",
    semesterMin: 1,
    semesterMax: 1,
    minGpa: null,
    majorScope: "ALL",
    universityScope: "SPECIFIC_UNIVERSITY",
    ageMax: null,
    fundingType: "TUITION+ALLOWANCE",
    benefitsSummary: "Dukungan biaya kuliah dan biaya hidup disertai program pengembangan kepemimpinan terstruktur selama 3,5 tahun (semester 2–8), networking, pengabdian masyarakat, dan pengembangan karier.",
    deadline: 46272,
    status: "CLOSED",
    registrationUrl: "https://www.tanotofoundation.org/teladan-2027/",
    officialSourceUrl: "https://www.tanotofoundation.org/teladan-2027/",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "UNKNOWN",
    interviewRequired: "UNKNOWN",
    notesInternal: "Khusus mahasiswa semester pertama S1 di 10 kampus mitra. Rata-rata rapor kelas XII minimal 8/10. Tidak menerima dukungan finansial lain; penerima KIP-K dapat mendaftar untuk program leadership saja."
  },
  {
    id: "PARAGON-EXC-2026",
    name: "Paragon Scholarship Program 2026 — PSP Excellence",
    provider: "PT Paragon Technology and Innovation",
    educationLevel: "S1",
    targetSegment: "S1/D4",
    semesterMin: 1,
    semesterMax: 1,
    minGpa: null,
    majorScope: "ALL",
    universityScope: "ALL",
    ageMax: null,
    fundingType: "TUITION",
    benefitsSummary: "Bantuan UKT hingga Rp7 juta/semester; Personal Growth Grant hingga Rp20 juta/siklus; mentoring/coaching; peluang magang & karier; dukungan proyek sosial; learning camp nasional.",
    deadline: 46275,
    status: "CLOSED",
    registrationUrl: "https://bit.ly/ApplyPSP2026",
    officialSourceUrl: "https://www.linkedin.com/posts/paragoncorp_paragon-scholarship-program-2026-is-now-open-activity-7493573417917427712-FCVg",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "UNKNOWN",
    interviewRequired: "UNKNOWN",
    notesInternal: "Mahasiswa aktif S1 semester 1. Rapor >=88 ATAU SNBT >=640. Aktif organisasi/kompetisi/pengembangan diri. Tidak menerima beasiswa lain kecuali program pertukaran pelajar."
  },
  {
    id: "PARAGON-ELEVATE-2026",
    name: "Paragon Scholarship Program 2026 — PSP Elevate",
    provider: "PT Paragon Technology and Innovation",
    educationLevel: "MULTI",
    targetSegment: "S1/D4",
    semesterMin: 1,
    semesterMax: 1,
    minGpa: null,
    majorScope: "ALL",
    universityScope: "ALL",
    ageMax: null,
    fundingType: "ALLOWANCE",
    benefitsSummary: "Bantuan biaya hidup Rp6 juta/semester; pendampingan personal; capacity building; pendanaan proyek sosial hingga Rp5 juta/siklus; persiapan karier dan jaringan mahasiswa nasional.",
    deadline: 46275,
    status: "CLOSED",
    registrationUrl: "https://bit.ly/ApplyPSP2026",
    officialSourceUrl: "https://www.linkedin.com/posts/paragoncorp_paragon-scholarship-program-2026-is-now-open-activity-7493573417917427712-FCVg",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "UNKNOWN",
    interviewRequired: "UNKNOWN",
    notesInternal: "Mahasiswa semester 1 S1/D4/D3. Rapor >=80 ATAU SNBT >=550. Total pendapatan bulanan keluarga < Rp8 juta. Tidak menerima beasiswa lain, kecuali KIP-K."
  },
  {
    id: "KSE-2026-27",
    name: "Beasiswa Karya Salemba Empat 2026/2027",
    provider: "Yayasan Karya Salemba Empat",
    educationLevel: "S1/D4",
    targetSegment: "S1/D4",
    semesterMin: 2,
    semesterMax: 6,
    minGpa: 3,
    majorScope: "ALL",
    universityScope: "SPECIFIC_UNIVERSITY",
    ageMax: null,
    fundingType: "ALLOWANCE",
    benefitsSummary: "Tunjangan biaya hidup Rp750 ribu/bulan selama 2 semester dan dapat diperpanjang sesuai ketentuan; program pengembangan soft skills, leadership, career coaching, entrepreneur academy, technology, dan community development.",
    deadline: 46108,
    status: "CLOSED",
    registrationUrl: "https://beasiswa.or.id/",
    officialSourceUrl: "https://beasiswa.or.id/",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "YES",
    interviewRequired: "YES",
    notesInternal: "Pendaftaran 2026 dilakukan bertahap berdasarkan kampus; deadline lokal bisa berbeda/lebih panjang. Untuk MVP, gunakan status CLOSED dan cek kalender kampus saat cycle berikutnya. Umumnya semester 2/4/6, belum menikah, tidak menerima beasiswa lain."
  },
  {
    id: "PERTAMINA-SOBI-2026",
    name: "Beasiswa Pertamina Sobat Bumi 2026",
    provider: "PT Pertamina (Persero) & Pertamina Foundation",
    educationLevel: "S1/D4",
    targetSegment: "S1/D4",
    semesterMin: 2,
    semesterMax: 6,
    minGpa: 3,
    majorScope: "ALL",
    universityScope: "SPECIFIC_UNIVERSITY",
    ageMax: null,
    fundingType: "TUITION+ALLOWANCE",
    benefitsSummary: "Bantuan UKT/SPP dan biaya hidup; capacity & character building; green initiative; aksi sosial/lingkungan; jejaring alumni Sobat Bumi.",
    deadline: 46173,
    status: "CLOSED",
    registrationUrl: "https://beasiswa.pertaminafoundation.org/",
    officialSourceUrl: "https://www.pertaminafoundation.org/news/cetak-generasi-unggul-pertamina-buka-beasiswa-sobat-bumi-di-hari-pendidikan",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "YES",
    interviewRequired: "YES",
    notesInternal: "Mahasiswa S1/D4 semester 2–6 di kampus mitra, IPK/IPS >=3.00, aktif organisasi/sosial/lingkungan, tidak menerima beasiswa lain. Karya tulis/motivation letter bagian persiapan aplikasi."
  },
  {
    id: "KALLA-2026",
    name: "Beasiswa Kalla 2026",
    provider: "Yayasan Hadji Kalla / LAZ Hadji Kalla",
    educationLevel: "MULTI",
    targetSegment: "S1/D4",
    semesterMin: 1,
    semesterMax: 1,
    minGpa: null,
    majorScope: "ALL",
    universityScope: "OTHER",
    ageMax: null,
    fundingType: "TUITION",
    benefitsSummary: "Bantuan UKT maksimal Rp7,5 juta/semester hingga semester 8; pelatihan kepemimpinan, sosial, inovasi, literasi digital; pengabdian masyarakat; peluang magang Kalla Group.",
    deadline: 46265,
    status: "CLOSED",
    registrationUrl: "https://form.yayasanhadjikalla.or.id/Beasiswa_Kalla_2026_2027",
    officialSourceUrl: "https://www.yayasanhadjikalla.or.id/2026/05/25/beasiswa-kalla-2026-resmi-dibuka-dukung-generasi-muda-berdaya/",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "YES",
    interviewRequired: "UNKNOWN",
    notesInternal: "Mahasiswa baru semester 1 D3/D4/S1 asal Sulsel, Sulbar, Sulteng, Sultra. Enam jalur: Akademik 1, Akademik 2, Hafiz, Seni/Olahraga, Organisasi, Disabilitas. Engine V0 perlu derived field pathway_qualified."
  },
  {
    id: "DJARUM-2026-27",
    name: "Djarum Beasiswa Plus 2026/2027",
    provider: "Djarum Foundation",
    educationLevel: "S1/D4",
    targetSegment: "S1/D4",
    semesterMin: 4,
    semesterMax: 4,
    minGpa: 3,
    majorScope: "ALL",
    universityScope: "SPECIFIC_UNIVERSITY",
    ageMax: null,
    fundingType: "ALLOWANCE",
    benefitsSummary: "Dana beasiswa Rp1 juta/bulan selama 1 tahun (Nov 2026–Okt 2027) serta program pengembangan soft skills dan jejaring Beswan Djarum.",
    deadline: 46183,
    status: "CLOSED",
    registrationUrl: "https://register.djarumbeasiswaplus.org/",
    officialSourceUrl: "https://djarumbeasiswaplus.org/tentang_kami/daftar-perguruan-tinggi-program-djarum-beasiswa-plus/1000",
    lastChecked: 46284,
    verificationStatus: "SOURCE_FOUND",
    essayRequired: "NO",
    interviewRequired: "YES",
    notesInternal: "Mahasiswa S1/D4 semester IV, semua disiplin, IPK minimum 3.00 semester III dan dipertahankan hingga akhir semester IV, aktif organisasi, tidak menerima beasiswa lain, kampus mitra."
  }
];

export function formatExcelDate(serial: number | null): string {
  if (!serial) return 'Belum ditentukan';
  // Excel date epoch is Dec 30 1899 due to 1900 leap year bug
  const utcDays = serial - 25569;
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = dateInfo.getUTCDate();
  const month = months[dateInfo.getUTCMonth()];
  const year = dateInfo.getUTCFullYear();
  
  return `${day} ${month} ${year}`;
}
