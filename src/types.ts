import {
  CanonicalProfile,
  ScanFormProfile,
  INITIAL_CANONICAL_PROFILE,
  INITIAL_SCAN_FORM_PROFILE,
  normalizeProfileToCanonical,
  canonicalToScanFormProfile,
} from './lib/profileAdapter.ts';

export type { CanonicalProfile, ScanFormProfile };
export { normalizeProfileToCanonical, canonicalToScanFormProfile };

export type ScholarshipProfile = CanonicalProfile;

export const MAX_FREE_MATCHES = 1;
export const MAX_FREE_AI_ACTIONS = 1;
export const MAX_FREE_SCANS = 1;
export const FREE_CORRECTION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window

export const INITIAL_PROFILE: ScholarshipProfile = { ...INITIAL_CANONICAL_PROFILE };
export const EMPTY_PROFILE: ScholarshipProfile = { ...INITIAL_CANONICAL_PROFILE };


export type ScreenState = 'LANDING' | 'RETURNING' | 'SCAN' | 'LOADING' | 'RESULT';
export type AppViewMode = ScreenState;
export type AppView = 'landing' | 'scan' | 'loading' | 'results';

export type EvidenceCategory = 'ORGANIZATION' | 'ACHIEVEMENT' | 'VOLUNTEER' | 'GOAL';

export interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  title: string;
  role: string;
  action: string;
  impact: string;
  metrics: string;
  lessons: string;
  lastModified: number;
}

export { trackEvent } from './lib/analytics.ts';

export const POPULAR_UNIVERSITIES = [
  'Universitas Brawijaya',
  'Universitas Indonesia',
  'Universitas Gadjah Mada',
  'Institut Teknologi Bandung',
  'Universitas Airlangga',
  'Institut Pertanian Bogor',
  'Universitas Diponegoro',
  'Institut Teknologi Sepuluh Nopember',
  'Universitas Padjadjaran',
  'Universitas Sebelas Maret',
  'Universitas Hasanuddin',
  'Universitas Sumatera Utara',
  'Universitas Negeri Yogyakarta',
  'Universitas Negeri Semarang',
  'Telkom University',
  'Universitas Bina Nusantara',
];

export const POPULAR_MAJORS = [
  'Teknik Lingkungan',
  'Teknik Informatika',
  'Ilmu Komputer',
  'Sistem Informasi',
  'Manajemen',
  'Akuntansi',
  'Ilmu Komunikasi',
  'Psikologi',
  'Ilmu Hukum',
  'Teknik Elektro',
  'Teknik Industri',
  'Pendidikan Dokter',
  'Farmasi',
  'Hubungan Internasional',
  'Statistika',
  'Agribisnis',
];
