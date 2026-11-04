import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { addPhoto, assignPhoto, db, deleteNote, deletePhoto, fullUrl, live } from '../core/db';
import { processImage } from '../core/image';
import { effectiveSection, Note, Photo, SECTIONS, STATUS_LABELS } from '../core/models';
import { NoteEditor } from '../core/note-editor';
import { Icon } from '../shared/icon';
import { PhotoViewer } from '../shared/photo-viewer';

@Component({
  selector: 'app-note-detail',
  imports: [DatePipe, Icon, PhotoViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="nav-row">
        <button type="button" class="link" (click)="location.back()"><app-icon name="arrow-left" [size]="20" /> Bulgular</button>
        @if (note(); as n) {
          <button type="button" class="link" (click)="edit(n)"><app-icon name="pencil" [size]="20" /> Düzenle</button>
        }
      </header>
      @if (note(); as n) {
        <p class="detail-text">{{ n.text || 'Metinsiz not' }}</p>
        <p class="row-sub">
          {{ n.createdAt | date: 'dd.MM.yyyy HH:mm' }} · {{ sectionLabel() }}
          @if (n.status) {
            <span class="tag warn">{{ statusLabels[n.status] }}</span>
          }
          @if (n.grade) {
            <span [class]="'tag g-' + n.grade">{{ n.grade }}</span>
          }
        </p>
        <div class="detail-photos">
          @for (photo of orderedPhotos(); track photo.id) {
            <button type="button" class="detail-photo" aria-label="Fotoğrafı aç" (click)="viewing.set(photo)">
              <img [src]="fullUrl(photo)" alt="" />
            </button>
          }
        </div>
        <div class="row-gap detail-add">
          <label class="btn grow">
            <app-icon name="camera-plus" [size]="20" /> Fotoğraf çek
            <input type="file" accept="image/*" capture="environment" hidden (change)="onFiles($event)" />
          </label>
          <label class="btn grow">
            <app-icon name="library-photo" [size]="20" /> Galeriden
            <input type="file" accept="image/*" multiple hidden (change)="onFiles($event)" />
          </label>
        </div>
        @if (adding()) {
          <p class="subtitle">Fotoğraflar ekleniyor: {{ adding() }}</p>
        }
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button type="button" class="btn danger wide" (click)="remove(n)"><app-icon name="trash" [size]="20" /> Notu sil</button>
      }
    </main>
    @if (viewing(); as photo) {
      <app-photo-viewer [photo]="photo" (closed)="viewing.set(null)" (removed)="removePhoto(photo)" />
    }
  `,
})
export class NoteDetail {
  private readonly editor = inject(NoteEditor);
  private readonly params = inject(ActivatedRoute).snapshot.paramMap;
  private readonly noteId = this.params.get('noteId')!;
  private readonly surveyId = this.params.get('id')!;
  protected readonly location = inject(Location);

  protected readonly fullUrl = fullUrl;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly viewing = signal<Photo | null>(null);
  protected readonly adding = signal(0);
  protected readonly error = signal('');
  protected readonly note = live<Note | undefined>(() => db.notes.get(this.noteId), undefined);
  private readonly photos = live<Photo[]>(() => db.photos.where({ noteId: this.noteId }).toArray(), []);

  protected readonly orderedPhotos = computed(() => {
    const ids = this.note()?.photoIds ?? [];
    return [...this.photos()].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  });

  protected readonly sectionLabel = computed(() => {
    const note = this.note();
    return (note && SECTIONS.find((s) => s.no === effectiveSection(note))?.label) ?? 'Etiketsiz';
  });

  protected async onFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.error.set('');
    this.adding.set(files.length);
    for (const file of files) {
      try {
        const id = await addPhoto(this.surveyId, await processImage(file));
        await assignPhoto(id, this.noteId);
      } catch {
        this.error.set('Bir fotoğraf eklenemedi.');
      }
      this.adding.update((n) => n - 1);
    }
  }

  protected async removePhoto(photo: Photo) {
    if (!confirm('Fotoğraf kalıcı olarak silinsin mi?')) return;
    this.viewing.set(null);
    await deletePhoto(photo.id);
  }

  protected edit(note: Note) {
    this.editor.open({ surveyId: this.surveyId, noteId: note.id });
  }

  protected async remove(note: Note) {
    if (!confirm('Not silinsin mi? Fotoğrafları atanmamış olarak kalır.')) return;
    await deleteNote(note);
    this.location.back();
  }
}
