import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { addPhoto, assignPhoto, db, deletePhoto, live, thumbUrl } from '../core/db';
import { processImage } from '../core/image';
import { Note, Photo } from '../core/models';
import { NoteEditor } from '../core/note-editor';
import { Icon } from '../shared/icon';

/** Çekim saati bu kadar yakın olan not önerilir */
const MATCH_WINDOW_MS = 30 * 60 * 1000;

@Component({
  selector: 'app-unassigned',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unassigned.html',
})
export class Unassigned {
  private readonly editor = inject(NoteEditor);
  private readonly surveyId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  protected readonly location = inject(Location);

  protected readonly thumbUrl = thumbUrl;
  protected readonly importing = signal<{ done: number; total: number } | null>(null);
  protected readonly message = signal('');

  private readonly photos = live<Photo[]>(() => db.photos.where({ surveyId: this.surveyId }).sortBy('takenAt'), []);
  protected readonly notes = live<Note[]>(() => db.notes.where({ surveyId: this.surveyId }).sortBy('createdAt'), []);

  protected readonly items = computed(() =>
    this.photos()
      .filter((p) => !p.noteId && !p.vesselKind)
      .map((photo) => ({ photo, match: this.nearestNote(photo) })),
  );
  protected readonly matchedCount = computed(() => this.items().filter((i) => i.match).length);

  private nearestNote(photo: Photo): Note | undefined {
    let best: Note | undefined;
    let bestGap = MATCH_WINDOW_MS;
    for (const note of this.notes()) {
      const gap = Math.abs(note.createdAt - photo.takenAt);
      if (gap <= bestGap) {
        best = note;
        bestGap = gap;
      }
    }
    return best;
  }

  protected async onFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    const known = new Set(this.photos().map((p) => p.sourceKey));
    let skipped = 0;
    let failed = 0;
    this.message.set('');
    this.importing.set({ done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      try {
        const image = await processImage(file);
        if (known.has(image.sourceKey)) skipped++;
        else {
          known.add(image.sourceKey);
          await addPhoto(this.surveyId, image);
        }
      } catch {
        failed++;
      }
      this.importing.set({ done: i + 1, total: files.length });
    }
    this.importing.set(null);
    const parts = [];
    if (skipped) parts.push(`${skipped} fotoğraf zaten vardı`);
    if (failed) parts.push(`${failed} fotoğraf işlenemedi`);
    this.message.set(parts.join(', '));
  }

  protected assign(photo: Photo, noteId: string) {
    return assignPhoto(photo.id, noteId);
  }

  protected onPick(photo: Photo, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (value) void this.assign(photo, value);
  }

  protected async assignAll() {
    for (const { photo, match } of this.items()) {
      if (match) await assignPhoto(photo.id, match.id);
    }
  }

  protected newNote(photo: Photo) {
    this.editor.open({ surveyId: this.surveyId, photoIds: [photo.id] });
  }

  protected remove(photo: Photo) {
    if (confirm('Fotoğraf silinsin mi?')) void deletePhoto(photo.id);
  }

  protected label(note: Note) {
    return note.text.length > 40 ? `${note.text.slice(0, 40)}…` : note.text || 'Metinsiz not';
  }
}
