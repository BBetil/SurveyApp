import { DestroyRef, inject, Signal, signal } from '@angular/core';
import Dexie, { liveQuery, Table, Transaction } from 'dexie';
import defaultParts from './default-parts.json';
import { Note, Part, Photo, Survey, uid, VesselKind } from './models';
import { ProcessedImage } from './image';

async function seedParts(tx: Transaction) {
  const parts: Part[] = Object.entries(defaultParts as Record<string, string[]>).flatMap(([section, names]) =>
    names.map((name) => ({ id: uid(), name, section: +section, updatedAt: 0 })),
  );
  await tx.table('parts').bulkAdd(parts);
}

class SorveyDb extends Dexie {
  surveys!: Table<Survey, string>;
  notes!: Table<Note, string>;
  photos!: Table<Photo, string>;
  parts!: Table<Part, string>;

  constructor() {
    super('sorvey');
    this.version(1).stores({
      surveys: 'id, updatedAt',
      notes: 'id, surveyId, createdAt',
      photos: 'id, surveyId, noteId',
    });
    this.version(2).stores({ parts: 'id' }).upgrade(seedParts);
    this.version(3).stores({ locations: null });
    this.on('populate', seedParts);
  }
}

export const db = new SorveyDb();

/** Dexie sorgusunu, veri değiştikçe güncellenen bir signal'e bağlar. Bileşen içinde çağrılmalı. */
export function live<T>(query: () => Promise<T>, initial: T): Signal<T> {
  const value = signal(initial);
  const sub = liveQuery(query).subscribe({ next: (v) => value.set(v), error: (e) => console.error(e) });
  inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  return value.asReadonly();
}

export function touch(surveyId: string) {
  return db.surveys.update(surveyId, { updatedAt: Date.now() });
}

export async function createSurvey(
  fields: Pick<Survey, 'reportNo' | 'client' | 'location' | 'dates' | 'vessel' | 'surveyor'>,
): Promise<string> {
  const now = Date.now();
  const id = uid();
  await db.surveys.add({ id, schemaVersion: 1, type: 'prepurchase', seaTrial: { rows: [] }, createdAt: now, updatedAt: now, ...fields });
  return id;
}

export function deleteSurvey(id: string) {
  return db.transaction('rw', db.surveys, db.notes, db.photos, async () => {
    await db.notes.where({ surveyId: id }).delete();
    await db.photos.where({ surveyId: id }).delete();
    await db.surveys.delete(id);
  });
}

export async function addPhoto(
  surveyId: string,
  image: ProcessedImage,
  link: { vesselKind?: VesselKind } = {},
): Promise<string> {
  const id = uid();
  await db.photos.add({ id, surveyId, ...image, ...link });
  await touch(surveyId);
  return id;
}

export async function deletePhoto(id: string) {
  const photo = await db.photos.get(id);
  if (!photo) return;
  await db.transaction('rw', db.notes, db.photos, async () => {
    if (photo.noteId) {
      await db.notes
        .where({ id: photo.noteId })
        .modify((n: Note) => void (n.photoIds = n.photoIds.filter((p) => p !== id)));
    }
    await db.photos.delete(id);
  });
  await touch(photo.surveyId);
}

/** Notu kaydeder; photoIds listesindeki fotoğrafları nota bağlar, listeden çıkanları siler. */
export async function saveNote(note: Note) {
  await db.transaction('rw', db.notes, db.photos, async () => {
    const before = await db.notes.get(note.id);
    for (const old of before?.photoIds ?? []) {
      if (!note.photoIds.includes(old)) await db.photos.delete(old);
    }
    for (const id of note.photoIds) await db.photos.update(id, { noteId: note.id });
    await db.notes.put(note);
  });
  await touch(note.surveyId);
}

/** Not silinir, fotoğrafları kaybolmasın diye atanmamışa döner. */
export async function deleteNote(note: Note) {
  await db.transaction('rw', db.notes, db.photos, async () => {
    for (const id of note.photoIds) await db.photos.where({ id }).modify((p: Photo) => void delete p.noteId);
    await db.notes.delete(note.id);
  });
  await touch(note.surveyId);
}

export async function assignPhoto(photoId: string, noteId: string) {
  await db.transaction('rw', db.notes, db.photos, async () => {
    await db.photos.update(photoId, { noteId });
    await db.notes.where({ id: noteId }).modify((n: Note) => void n.photoIds.push(photoId));
  });
}

const photoUrls = new Map<string, string>();

function cachedUrl(key: string, blob: Blob): string {
  let url = photoUrls.get(key);
  if (!url) {
    url = URL.createObjectURL(blob);
    photoUrls.set(key, url);
  }
  return url;
}

export const thumbUrl = (p: Photo) => cachedUrl(`t:${p.id}`, p.thumb);
export const fullUrl = (p: Photo) => cachedUrl(`f:${p.id}`, p.blob);

/** Alan bazlı kayıt: "vessel.hin" gibi bir yolla sadece o alan yazılır */
export function setSurveyField(surveyId: string, path: string, value: unknown) {
  return db.surveys.update(surveyId, { [path]: value, updatedAt: Date.now() } as object);
}
