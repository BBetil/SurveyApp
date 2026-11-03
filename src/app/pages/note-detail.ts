import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { db, deleteNote, fullUrl, live } from '../core/db';
import { effectiveSection, Note, Photo, SECTIONS, STATUS_LABELS } from '../core/models';
import { NoteEditor } from '../core/note-editor';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-note-detail',
  imports: [DatePipe, Icon],
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
            <img [src]="fullUrl(photo)" alt="" />
          }
        </div>
        <button type="button" class="btn danger wide" (click)="remove(n)"><app-icon name="trash" [size]="20" /> Notu sil</button>
      }
    </main>
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

  protected edit(note: Note) {
    this.editor.open({ surveyId: this.surveyId, noteId: note.id });
  }

  protected async remove(note: Note) {
    if (!confirm('Not silinsin mi? Fotoğrafları atanmamış olarak kalır.')) return;
    await deleteNote(note);
    this.location.back();
  }
}
