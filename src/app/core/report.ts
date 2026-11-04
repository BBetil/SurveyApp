import { effectiveSection, Grade, Note, Photo, SeaTrialRow, SECTIONS, Survey, surveyTitle } from './models';
import { ReportTemplate } from './report-template';

/** Metin parçası: ya düz metin ya da doldurulması gereken boşluk. */
export interface Span {
  text?: string;
  blank?: string;
}
export type Paragraph = Span[];

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
  leads: Paragraph[];
  trial?: SeaTrialRow[];
  afterTrial: Paragraph[];
  findings: ReportFinding[];
}

export interface DetailRow {
  label: string;
  value: Span[];
}

export interface ReportDoc {
  title: string;
  reportNo: string;
  date: string;
  details: { heading: string; rows: DetailRow[] }[];
  limits: Paragraph[];
  intro: Paragraph;
  summary: Paragraph[];
  summaryItems: ReportFinding[];
  observationsIntro: Paragraph[];
  gradeExplanations: Paragraph[];
  sections: ReportSection[];
  conclusion: Paragraph[];
  signature: { name: Span[]; title: string };
  total: number;
  withoutSection: number;
  withoutGrade: number;
  blanks: number;
}

/** Boşlukların ekranda görünen adları */
const BLANK_LABELS: Record<string, string> = {
  marka: 'Marka',
  model: 'Model',
  uretimYili: 'Üretim yılı',
  modelYili: 'Model yılı',
  tekne: 'Tekne adı',
  sahip: 'Rapor sahibi',
  firma: 'Firma',
  konum: 'Konum',
  testFazlari: 'Test tarihleri ve fazları',
  kondisyon: 'Genel kondisyon',
  nemSonucu: 'Nem ölçüm sonucu',
  pervaneDurumu: 'Pervane ve dümen durumu',
  azamiDevir: 'Azami devir',
  devirDurumu: 'Ulaşıldı / ulaşılamadı',
  ulasilanDevir: 'Ulaşılan devir',
  vibrasyonDegerlendirme: 'Vibrasyon değerlendirmesi',
  hararet: 'Hararet',
  azamiSurat: 'Azami sürat',
  seyirDegerlendirme: 'Seyir değerlendirmesi',
  genelDegerlendirme: 'Genel değerlendirme',
  kapanis: 'Kapanış cümlesi',
};

const NO_TEMPLATE: Paragraph[] = [[{ blank: 'Şablon yüklenince metin gelir' }]];
const SUMMARY_GRADES: Grade[] = ['D1', 'D2', 'NWI'];
const WORK_SECTION = 4;

/** {anahtar} boşluklarını değerlerle doldurur; değeri olmayanlar boşluk olarak kalır. */
export function fill(text: string, values: Record<string, string>): Paragraph {
  const spans: Paragraph = [];
  let last = 0;
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    const value = values[match[1]];
    spans.push(value ? { text: value } : { blank: BLANK_LABELS[match[1]] ?? match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans;
}

const countBlanks = (paragraphs: Paragraph[]) => paragraphs.reduce((sum, p) => sum + p.filter((s) => s.blank).length, 0);

function formatDate(iso?: string): string {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR') : '';
}

function buildDetails(survey: Survey): ReportDoc['details'] {
  const v = survey.vessel;
  const row = (label: string, value?: string): DetailRow => ({ label, value: value ? [{ text: value }] : [{ blank: label }] });
  const hours = v.engineHours;
  const engineHours = [hours?.port && `${hours.port} saat (iskele makine)`, hours?.starboard && `${hours.starboard} saat (sancak makine)`]
    .filter(Boolean)
    .join(', ');
  const dates = [formatDate(survey.dates.land), formatDate(survey.dates.sea)].filter(Boolean).join(', ');
  return [
    {
      heading: 'Sörvey Detayları',
      rows: [
        row('Rapor Sahibi', survey.client),
        row('Raporun Türü', 'Ön Satın Alma Sörveyi'),
        row('Konum', survey.location),
        row('Sörvey Tarihi', dates),
        row('Hava Koşulları'),
        row('Sörveyör', [survey.surveyor.name, survey.surveyor.title].filter(Boolean).join(', ')),
      ],
    },
    {
      heading: 'Tekne Detayları',
      rows: [
        row('Tekne Adı', v.name),
        row('Bayrak'),
        row('Kayıtlı Olduğu Liman'),
        row('CE Sertifikasyonu'),
        row('Üretim Yılı'),
        row('Tekne Yaşı'),
        row('Tekne Tipi'),
        row('Tekne Modeli', v.model),
        row('Üretici'),
        row('H.I.N./Üretici Nu.', v.hin),
        row('Konstrüksiyon'),
        row('Renk'),
        row('L.O.A.'),
        row('Genişlik'),
        row('Deplasman'),
        row('Ana Makine(ler)'),
        row('Makine Seri Numarası'),
        row('Makine Çalışma Saati', engineHours),
        row('Jeneratör(ler)'),
        row('Jeneratör Seri Numarası'),
        row('Jeneratör Çalışma Saati', v.generatorHours && `${v.generatorHours} saat`),
        row('Yakıt (Dizel)'),
        row('Tatlı Su'),
        row('Pis Su (Black Water)'),
        row('Gri Su (Grey Water)'),
      ],
    },
  ];
}

export function buildReport(survey: Survey, notes: Note[], photos: Photo[], template?: ReportTemplate): ReportDoc {
  const values: Record<string, string> = {
    model: survey.vessel.model ?? '',
    tekne: survey.vessel.name ?? '',
    sahip: survey.client,
    konum: survey.location,
    firma: template?.firm ?? '',
  };
  const texts = (list?: string[]) => (template ? (list ?? []).map((t) => fill(t, values)) : NO_TEMPLATE);

  const photoById = new Map(photos.map((p) => [p.id, p]));
  const toFinding = (note: Note, number?: string): ReportFinding => ({
    noteId: note.id,
    number,
    text: note.text,
    grade: note.grade,
    photos: note.photoIds.map((id) => photoById.get(id)).filter((p): p is Photo => !!p),
  });
  const ordered = [...notes].sort((a, b) => a.createdAt - b.createdAt);

  // Tüm bölümler görünür: sabit paragraflar bulgu olmasa da raporda yer alır
  const sections: ReportSection[] = SECTIONS.map((section) => {
    const prefix = `${WORK_SECTION}.${section.no}`;
    const isMachine = section.no === 5;
    return {
      number: prefix,
      title: section.label,
      leads: template ? texts(template.sectionLeads[section.no]) : section.no === 1 || section.no === 2 || isMachine ? NO_TEMPLATE : [],
      trial: isMachine ? survey.seaTrial.rows.filter((r) => Object.keys(r).length) : undefined,
      afterTrial: isMachine && template ? texts(template.machineAfterTable) : [],
      findings: ordered.filter((n) => effectiveSection(n) === section.no).map((n, i) => toFinding(n, `${prefix}.${i + 1}`)),
    };
  });
  const unassigned = ordered.filter((n) => effectiveSection(n) === undefined);
  if (unassigned.length) {
    sections.push({ title: 'Bölüm seçilmemiş', leads: [], afterTrial: [], findings: unassigned.map((n) => toFinding(n)) });
  }
  const findings = sections.flatMap((s) => s.findings);
  const summaryItems = SUMMARY_GRADES.flatMap((grade) => findings.filter((f) => f.grade === grade));

  const details = buildDetails(survey);
  const signatureName: Span[] = survey.surveyor.name ? [{ text: survey.surveyor.name }] : [{ blank: 'Sörveyör adı' }];
  const doc: ReportDoc = {
    title: surveyTitle(survey),
    reportNo: survey.reportNo,
    date: formatDate(survey.dates.land),
    details,
    limits: texts(template?.limits),
    intro: template ? fill(template.intro, values) : NO_TEMPLATE[0],
    summary: texts(template?.summary),
    summaryItems,
    observationsIntro: texts(template?.observationsIntro),
    gradeExplanations: texts(template?.gradeExplanations),
    sections,
    conclusion: texts(template?.conclusion),
    signature: { name: signatureName, title: survey.surveyor.title },
    total: ordered.length,
    withoutSection: unassigned.length,
    withoutGrade: ordered.filter((n) => !n.grade).length,
    blanks: 0,
  };
  doc.blanks = template
    ? countBlanks([
        doc.intro,
        ...doc.summary,
        ...doc.conclusion,
        ...sections.flatMap((s) => [...s.leads, ...s.afterTrial]),
        ...details.flatMap((d) => d.rows.map((r) => r.value)),
        signatureName,
      ])
    : 0;
  return doc;
}
