import { unzipSync } from 'fflate';
import { db, touch } from './db';
import { Note, normalizeTr, uid } from './models';
import { suggestSection } from './section-suggest';

export interface ImportLine {
  text: string;
  section?: number;
  /** Başlık, tarih ya da daha önce eklenmiş satır: varsayılan olarak seçilmez */
  skipReason?: 'başlık' | 'tarih' | 'zaten var';
}

function docxLines(buffer: ArrayBuffer): string[] {
  const xml = unzipSync(new Uint8Array(buffer))['word/document.xml'];
  if (!xml) throw new Error('Word dosyası okunamadı');
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
  const lines: string[] = [];
  for (const paragraph of Array.from(doc.getElementsByTagName('w:p'))) {
    let line = '';
    for (const node of Array.from(paragraph.getElementsByTagName('*'))) {
      if (node.tagName === 'w:t') line += node.textContent ?? '';
      else if (node.tagName === 'w:tab') line += ' ';
      else if (node.tagName === 'w:br') {
        lines.push(line);
        line = '';
      }
    }
    lines.push(line);
  }
  return lines;
}

function textLines(buffer: ArrayBuffer): string[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Eski Windows metin dosyaları
    text = new TextDecoder('windows-1254').decode(buffer);
  }
  return text.split(/\r?\n/);
}

export async function readNoteLines(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith('.docx')) return docxLines(buffer);
  if (name.endsWith('.txt')) return textLines(buffer);
  throw new Error('Sadece .docx ve .txt dosyaları okunabilir');
}

/** Satırları temizler, bölüm önerir, eklenmemesi muhtemel satırları işaretler. */
export function classifyLines(
  raw: string[],
  existingTexts: string[],
  parts: { key: string; section: number }[],
): ImportLine[] {
  const seen = new Set(existingTexts.map(normalizeTr));
  const cleaned = raw.map((l) => l.replace(/^\s*[-•*–]\s+/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return cleaned.map((text, index) => {
    const key = normalizeTr(text);
    let skipReason: ImportLine['skipReason'];
    if (seen.has(key)) skipReason = 'zaten var';
    else if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(text)) skipReason = 'tarih';
    else if (index === 0 && text.split(' ').length <= 5 && !/[.]$/.test(text)) skipReason = 'başlık';
    seen.add(key);
    return { text, section: suggestSection(text, parts), skipReason };
  });
}

/** Satırları dosyadaki sırayla not olarak ekler. */
export async function addImportedNotes(surveyId: string, lines: ImportLine[]) {
  const now = Date.now();
  const notes: Note[] = lines.map((line, i) => ({
    id: uid(),
    surveyId,
    createdAt: now + i,
    text: line.text,
    sectionSuggested: line.section,
    photoIds: [],
  }));
  await db.notes.bulkAdd(notes);
  await touch(surveyId);
}
