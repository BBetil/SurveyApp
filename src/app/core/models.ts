export const SECTIONS = [
  { no: 1, short: 'Gövde', label: 'Gövde', slug: 'govde' },
  { no: 2, short: 'Dümen', label: 'Dümen & Pervane', slug: 'dumen' },
  { no: 3, short: 'Güverte', label: 'Güverte ve Güverte Donanımı', slug: 'guverte' },
  { no: 4, short: 'İç mekan', label: 'İç Mekan', slug: 'ic-mekan' },
  { no: 5, short: 'Makine', label: 'Makine, Makine Dairesi Ekipmanları ve Yakıt Sistemi', slug: 'makine' },
  { no: 6, short: 'Su tesisatı', label: 'Tatlı Su ve Pis Su Tesisatı', slug: 'su' },
  { no: 7, short: 'Elektrik', label: 'Elektrik ve Elektronik Sistemler', slug: 'elektrik' },
  { no: 8, short: 'Güvenlik', label: 'Güvenlik Ekipmanları ve İdari Hususlar', slug: 'guvenlik' },
] as const;

export const GRADES = ['D1', 'D2', 'D3', 'T', 'NWI'] as const;
export type Grade = (typeof GRADES)[number];
export type NoteStatus = 'not_working' | 'not_tested';
export const STATUS_LABELS: Record<NoteStatus, string> = { not_working: 'Çalışmıyor', not_tested: 'Denenemedi' };

export const VESSEL_KINDS = [
  { kind: 'ce', label: 'CE plakası' },
  { kind: 'hin', label: 'HIN plakası' },
  { kind: 'engine', label: 'Makine plakası' },
  { kind: 'manual', label: 'Kılavuz' },
] as const;
export type VesselKind = (typeof VESSEL_KINDS)[number]['kind'];

/** Not yazarken önerilen parça. Bölüm önerisini de besler. updatedAt yedekten dönerken en yeni kaydı seçer. */
export interface Part {
  id: string;
  name: string;
  section: number;
  updatedAt: number;
}

export interface SeaTrialRow {
  rpm?: number;
  knots?: number;
  vib?: number;
  fuelLph?: number;
  tempPort?: number;
  tempStarboard?: number;
}

/** survey.json sözleşmesi: rapor üretimi bu alanları okur. Değişirse schemaVersion artmalı. */
export interface Survey {
  id: string;
  schemaVersion: 1;
  reportNo: string;
  type: 'prepurchase';
  client: string;
  location: string;
  dates: { land?: string; sea?: string };
  surveyor: { name: string; title: string };
  vessel: {
    name?: string;
    model?: string;
    hin?: string;
    engineHours?: { port?: string; starboard?: string };
    generatorHours?: string;
  };
  seaTrial: { rows: SeaTrialRow[]; note?: string };
  shaft?: { diameter?: string; clearance?: string; bracketPort?: string; bracketStarboard?: string };
  moisture?: { general?: string; highAreas?: string };
  createdAt: number;
  updatedAt: number;
  lastExportAt?: number;
}

export interface Note {
  id: string;
  surveyId: string;
  createdAt: number;
  text: string;
  section?: number;
  sectionSuggested?: number;
  status?: NoteStatus;
  grade?: Grade;
  photoIds: string[];
}

export interface Photo {
  id: string;
  surveyId: string;
  noteId?: string;
  vesselKind?: VesselKind;
  blob: Blob;
  thumb: Blob;
  takenAt: number;
  /** Aynı fotoğrafın iki kez içe alınmasını önler */
  sourceKey?: string;
}

/** crypto.randomUUID HTTP'de yok (telefonda LAN testi), bu yüzden getRandomValues */
export function uid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function effectiveSection(note: Note): number | undefined {
  return note.section ?? note.sectionSuggested;
}

export function normalizeTr(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function surveyTitle(survey: Survey): string {
  return survey.vessel.model || survey.vessel.name || 'İsimsiz tekne';
}
