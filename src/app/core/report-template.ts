import { db } from './db';

/**
 * Rapor metinleri firmanın kendi dilidir, bu yüzden herkese açık kodda bulunmaz.
 * Kullanıcı dosya olarak bir kez yükler ve cihazda saklanır. Metinlerde {anahtar} boşlukları değerlerle dolar.
 */
export interface ReportTemplate {
  version: 1;
  firm: string;
  limits: string[];
  intro: string;
  summary: string[];
  observationsIntro: string[];
  gradeExplanations: string[];
  sectionLeads: Record<string, string[]>;
  machineAfterTable: string[];
  conclusion: string[];
}

const KEY = 'reportTemplate';

export async function loadTemplate(): Promise<ReportTemplate | undefined> {
  return (await db.kv.get(KEY))?.value as ReportTemplate | undefined;
}

export function parseTemplate(text: string): ReportTemplate {
  const data = JSON.parse(text) as ReportTemplate;
  const arrays = [data.limits, data.summary, data.observationsIntro, data.gradeExplanations, data.machineAfterTable, data.conclusion];
  if (data.version !== 1 || typeof data.intro !== 'string' || !data.sectionLeads || !arrays.every(Array.isArray)) {
    throw new Error('Bu dosya rapor şablonu değil');
  }
  return data;
}

export function saveTemplate(template: ReportTemplate) {
  return db.kv.put({ key: KEY, value: template });
}

export async function importTemplateFile(file: File) {
  await saveTemplate(parseTemplate(await file.text()));
}
