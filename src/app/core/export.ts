import { strFromU8, strToU8, unzipSync, zipSync, Zippable } from 'fflate';
import { db } from './db';
import { thumbFrom } from './image';
import { exportLists, mergeLists } from './lists';
import { Note, Photo, SECTIONS, STATUS_LABELS, Survey, effectiveSection, surveyTitle, uid } from './models';

interface ExportedPhoto extends Omit<Photo, 'blob' | 'thumb' | 'surveyId' | 'sourceKey'> {
  file: string;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function photoFileNames(notes: Note[], photos: Photo[]): Map<string, string> {
  const names = new Map<string, string>();
  notes.forEach((note, i) => {
    const seq = String(i + 1).padStart(3, '0');
    const slug = SECTIONS.find((s) => s.no === effectiveSection(note))?.slug ?? 'etiketsiz';
    note.photoIds.forEach((id, j) => names.set(id, `foto/${seq}-${slug}-${j + 1}.jpg`));
  });
  let vessel = 0;
  let free = 0;
  for (const photo of photos) {
    if (names.has(photo.id)) continue;
    names.set(photo.id, photo.vesselKind ? `foto/tekne-${photo.vesselKind}-${++vessel}.jpg` : `foto/atanmamis-${++free}.jpg`);
  }
  return names;
}

function notesHtml(survey: Survey, notes: Note[], names: Map<string, string>): string {
  const row = (note: Note) => {
    const tags = [
      SECTIONS.find((s) => s.no === effectiveSection(note))?.short,
      note.status && STATUS_LABELS[note.status],
      note.grade,
    ].filter(Boolean);
    const imgs = note.photoIds.map((id) => `<img src="${names.get(id)}" loading="lazy">`).join('');
    return `<article><p>${escapeHtml(note.text)}</p><small>${new Date(note.createdAt).toLocaleString('tr-TR')} · ${escapeHtml(tags.join(' · '))}</small><div>${imgs}</div></article>`;
  };
  const trial = survey.seaTrial.rows
    .map((r) => `<tr><td>${[r.rpm, r.knots, r.vib, r.fuelLph, r.tempPort, r.tempStarboard].map((v) => v ?? '').join('</td><td>')}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="tr"><meta charset="utf-8"><title>${escapeHtml(surveyTitle(survey))}</title>
<style>body{font:16px system-ui;max-width:800px;margin:2rem auto;padding:0 1rem}article{border-top:1px solid #ccc;padding:.75rem 0}p{margin:0 0 .25rem}small{color:#666}img{max-width:48%;margin:.5rem 1% 0 0;border-radius:6px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.25rem .5rem}</style>
<h1>${escapeHtml(surveyTitle(survey))}</h1>
<p>${escapeHtml([survey.reportNo, survey.vessel.name, survey.location, survey.client].filter(Boolean).join(' · '))}</p>
${trial ? `<h2>Deniz testi</h2><table><tr><th>RPM</th><th>Knot</th><th>Vib. mm/s</th><th>Yakıt l/h</th><th>Har. iskele</th><th>Har. sancak</th></tr>${trial}</table>` : ''}
<h2>Bulgular (${notes.length})</h2>${notes.map(row).join('')}</html>`;
}

export interface SurveyZip {
  file: File;
  noteCount: number;
  photoCount: number;
}

export async function buildSurveyZip(surveyId: string): Promise<SurveyZip> {
  const survey = await db.surveys.get(surveyId);
  if (!survey) throw new Error('Sörvey bulunamadı');
  const notes = await db.notes.where({ surveyId }).sortBy('createdAt');
  const photos = await db.photos.where({ surveyId }).toArray();
  const names = photoFileNames(notes, photos);

  const exportedPhotos: ExportedPhoto[] = photos.map(({ blob, thumb, surveyId: _s, sourceKey: _k, ...rest }) => ({
    ...rest,
    file: names.get(rest.id)!,
  }));
  const exportedNotes = notes.map(({ surveyId: _s, ...rest }) => rest);
  const rows = survey.seaTrial.rows.filter((r) => Object.keys(r).length);
  const json = { ...survey, seaTrial: { ...survey.seaTrial, rows }, notes: exportedNotes, photos: exportedPhotos };

  const files: Zippable = {
    'survey.json': strToU8(JSON.stringify(json, null, 2)),
    'notlar.html': strToU8(notesHtml(survey, notes, names)),
    'ayarlar.json': strToU8(JSON.stringify(await exportLists(), null, 2)),
  };
  for (const photo of photos) {
    files[names.get(photo.id)!] = [new Uint8Array(await photo.blob.arrayBuffer()), { level: 0 }];
  }
  const date = (survey.dates.land ?? new Date(survey.createdAt).toISOString()).slice(0, 10);
  const name = `${date}-${surveyTitle(survey)}`.replace(/[^\p{L}\p{N}-]+/gu, '-');
  const bytes = zipSync(files);
  return {
    file: new File([bytes as BlobPart], `${name}.zip`, { type: 'application/zip' }),
    noteCount: notes.length,
    photoCount: photos.length,
  };
}

export function canShareFile(file: File): boolean {
  return !!navigator.canShare?.({ files: [file] });
}

export function downloadFile(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

export function markExported(surveyId: string) {
  return db.surveys.update(surveyId, { lastExportAt: Date.now() });
}

/** Dışa aktarılan zip'ten sörveyi geri yükler. Sörvey zaten varsa üzerine yazmaz, kopya olarak ekler. */
export async function importSurveyZip(file: File): Promise<string> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const raw = entries['survey.json'];
  if (!raw) throw new Error('Bu dosyada survey.json yok');
  const data = JSON.parse(strFromU8(raw));
  if (data.schemaVersion !== 1 || !Array.isArray(data.notes) || !Array.isArray(data.photos)) {
    throw new Error('Bu zip tanınmıyor');
  }
  const { notes, photos, ...survey } = data as Survey & { notes: Omit<Note, 'surveyId'>[]; photos: ExportedPhoto[] };
  const copy = !!(await db.surveys.get(survey.id));
  const surveyId = copy ? uid() : survey.id;
  const ids = new Map<string, string>();
  const newId = (id: string) => {
    if (!copy) return id;
    if (!ids.has(id)) ids.set(id, uid());
    return ids.get(id)!;
  };

  const photoRows: Photo[] = [];
  for (const { file: path, ...photo } of photos) {
    const bytes = entries[path];
    if (!bytes) continue;
    const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' });
    photoRows.push({
      ...photo,
      id: newId(photo.id),
      noteId: photo.noteId && newId(photo.noteId),
      surveyId,
      blob,
      thumb: await thumbFrom(blob),
    });
  }
  const noteRows: Note[] = notes.map((n) => ({
    ...n,
    id: newId(n.id),
    surveyId,
    photoIds: n.photoIds.map(newId),
  }));
  await db.transaction('rw', db.surveys, db.notes, db.photos, async () => {
    await db.surveys.put({ ...survey, id: surveyId });
    await db.notes.bulkPut(noteRows);
    await db.photos.bulkPut(photoRows);
  });
  if (entries['ayarlar.json']) await mergeLists(JSON.parse(strFromU8(entries['ayarlar.json'])));
  return surveyId;
}
