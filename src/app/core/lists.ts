import { db } from './db';
import { normalizeTr, Part, uid } from './models';
import { loadTemplate, ReportTemplate, saveTemplate } from './report-template';

const MAX_COMPLETIONS = 6;

export interface Completions {
  /** Metinde değiştirilecek parçanın başlangıcı */
  start: number;
  parts: Part[];
}

/** İmleçten önce yazılmakta olan kelimelere uyan parçalar. Çok kelimeli eşleşme önceliklidir: "zincir st" -> Zincir stoperi */
export function partCompletions(text: string, caret: number, parts: Part[]): Completions | undefined {
  const before = text.slice(0, caret);
  if (!before || /[\s.,;:!?)/]$/.test(before) || /^[\p{L}\p{N}]/u.test(text.slice(caret))) return undefined;
  const keyed = parts.map((part) => ({ part, key: normalizeTr(part.name) }));
  for (let count = 3; count >= 1; count--) {
    const raw = before.match(new RegExp(`\\S+(?:\\s+\\S+){${count - 1}}$`))?.[0];
    if (!raw) continue;
    const typed = normalizeTr(raw).replace(/\s+/g, ' ');
    if (typed.length < 2) continue;
    const hits = keyed.filter(({ key }) => {
      if (key === typed) return false;
      return key.startsWith(typed) || (count === 1 && key.split(' ').some((word) => word.startsWith(typed)));
    });
    if (!hits.length) continue;
    hits.sort(
      (a, b) =>
        Number(b.key.startsWith(typed)) - Number(a.key.startsWith(typed)) || a.part.name.localeCompare(b.part.name, 'tr'),
    );
    return { start: before.length - raw.length, parts: hits.slice(0, MAX_COMPLETIONS).map((h) => h.part) };
  }
  return undefined;
}

async function partNameTaken(name: string, exceptId?: string): Promise<boolean> {
  const key = normalizeTr(name);
  return !!(await db.parts.filter((p) => p.id !== exceptId && normalizeTr(p.name) === key).first());
}

/** Aynı ad varsa false döner */
export async function addPart(name: string, section: number): Promise<boolean> {
  if (await partNameTaken(name)) return false;
  await db.parts.add({ id: uid(), name, section, updatedAt: Date.now() });
  return true;
}

/** Aynı ad başka parçada varsa false döner */
export async function renamePart(id: string, name: string): Promise<boolean> {
  if (await partNameTaken(name, id)) return false;
  await db.parts.update(id, { name, updatedAt: Date.now() });
  return true;
}

export function setPartSection(id: string, section: number) {
  return db.parts.update(id, { section, updatedAt: Date.now() });
}

export interface ListsBackup {
  parts: Omit<Part, 'id'>[];
  reportTemplate?: ReportTemplate;
}

export async function exportLists(): Promise<ListsBackup> {
  const parts = await db.parts.toArray();
  return { parts: parts.map(({ id: _id, ...rest }) => rest), reportTemplate: await loadTemplate() };
}

/** Yedekteki parçaları ekler. Aynı adlı parçada daha yeni düzenlenmiş olan kalır, listeden hiçbir şey silinmez. */
export async function mergeLists(backup: Partial<ListsBackup>) {
  const current = new Map((await db.parts.toArray()).map((p) => [normalizeTr(p.name), p]));
  for (const part of backup.parts ?? []) {
    const existing = current.get(normalizeTr(part.name));
    if (!existing) await db.parts.add({ ...part, id: uid() });
    else if (part.updatedAt > existing.updatedAt) await db.parts.update(existing.id, { ...part });
  }
  if (backup.reportTemplate && !(await loadTemplate())) await saveTemplate(backup.reportTemplate);
}
