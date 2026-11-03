import { effectiveSection, Grade, Note, Photo, SECTIONS, Survey } from './models';

/** Önizleme, PDF ve Word aynı modelden üretilir. */
export interface ReportFinding {
  noteId: string;
  /** Rapordaki madde numarası, ör. 4.3.1. Bölümsüz notlarda yoktur. */
  number?: string;
  text: string;
  grade?: Grade;
  photos: Photo[];
}

export interface ReportSection {
  /** Rapordaki bölüm numarası, ör. 4.3. Bölümsüz grupta yoktur. */
  number?: string;
  title: string;
  findings: ReportFinding[];
}

export interface ReportModel {
  sections: ReportSection[];
  total: number;
  withoutSection: number;
  withoutGrade: number;
}

const WORK_SECTION = 4;

export function buildReportModel(notes: Note[], photos: Photo[]): ReportModel {
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const toFinding = (note: Note, number?: string): ReportFinding => ({
    noteId: note.id,
    number,
    text: note.text,
    grade: note.grade,
    photos: note.photoIds.map((id) => photoById.get(id)).filter((p): p is Photo => !!p),
  });
  const ordered = [...notes].sort((a, b) => a.createdAt - b.createdAt);

  const sections: ReportSection[] = [];
  for (const section of SECTIONS) {
    const inSection = ordered.filter((n) => effectiveSection(n) === section.no);
    if (!inSection.length) continue;
    const prefix = `${WORK_SECTION}.${section.no}`;
    sections.push({
      number: prefix,
      title: section.label,
      findings: inSection.map((n, i) => toFinding(n, `${prefix}.${i + 1}`)),
    });
  }
  const unassigned = ordered.filter((n) => effectiveSection(n) === undefined);
  if (unassigned.length) {
    sections.push({ title: 'Bölüm seçilmemiş', findings: unassigned.map((n) => toFinding(n)) });
  }
  return {
    sections,
    total: ordered.length,
    withoutSection: unassigned.length,
    withoutGrade: ordered.filter((n) => !n.grade).length,
  };
}

/** Kapakta gösterilecek bilgiler; boş olanlar çıkarılır. */
export function reportDetails(survey: Survey): { label: string; value: string }[] {
  const land = survey.dates.land;
  const date = land ? new Date(`${land}T00:00:00`).toLocaleDateString('tr-TR') : '';
  const surveyor = [survey.surveyor.name, survey.surveyor.title].filter(Boolean).join(', ');
  return [
    { label: 'Rapor no', value: survey.reportNo },
    { label: 'Rapor sahibi', value: survey.client },
    { label: 'Konum', value: survey.location },
    { label: 'Sörvey tarihi', value: date },
    { label: 'Tekne adı', value: survey.vessel.name ?? '' },
    { label: 'Tekne modeli', value: survey.vessel.model ?? '' },
    { label: 'H.I.N.', value: survey.vessel.hin ?? '' },
    { label: 'Sörveyör', value: surveyor },
  ].filter((row) => row.value);
}
