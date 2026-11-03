import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { db, deleteNote, live, thumbUrl } from '../core/db';
import { buildSurveyZip, canShareFile, downloadFile, markExported, SurveyZip } from '../core/export';
import { effectiveSection, normalizeTr, Note, Photo, SECTIONS, STATUS_LABELS, Survey, surveyTitle } from '../core/models';
import { NoteEditor } from '../core/note-editor';
import { Icon } from '../shared/icon';

type Filter = 'all' | 'none' | number;

@Component({
  selector: 'app-findings',
  imports: [DatePipe, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './findings.html',
})
export class Findings {
  private readonly editor = inject(NoteEditor);
  protected readonly surveyId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly survey = live<Survey | undefined>(() => db.surveys.get(this.surveyId), undefined);
  protected readonly notes = live<Note[]>(
    async () => (await db.notes.where({ surveyId: this.surveyId }).sortBy('createdAt')).reverse(),
    [],
  );
  private readonly photos = live<Photo[]>(() => db.photos.where({ surveyId: this.surveyId }).toArray(), []);

  protected readonly title = surveyTitle;
  protected readonly thumbUrl = thumbUrl;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');
  protected readonly zip = signal<SurveyZip | null>(null);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal('');

  private readonly photoById = computed(() => new Map(this.photos().map((p) => [p.id, p])));
  protected readonly unassignedCount = computed(() => this.photos().filter((p) => !p.noteId && !p.vesselKind).length);

  protected readonly filters = computed(() => {
    const notes = this.notes();
    const count = (no?: number) => notes.filter((n) => effectiveSection(n) === no).length;
    return [
      { key: 'all' as Filter, label: 'Tümü', count: notes.length },
      ...SECTIONS.map((s) => ({ key: s.no as Filter, label: s.short, count: count(s.no) })).filter((f) => f.count),
      { key: 'none' as Filter, label: 'Etiketsiz', count: count(undefined) },
    ].filter((f) => f.key === 'all' || f.count);
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    const q = normalizeTr(this.query().trim());
    return this.notes().filter((n) => {
      const section = effectiveSection(n);
      if (filter === 'none' ? section !== undefined : filter !== 'all' && section !== filter) return false;
      return !q || normalizeTr(`${n.text} ${this.sectionLabel(n)}`).includes(q);
    });
  });

  protected sectionLabel(note: Note): string {
    return SECTIONS.find((s) => s.no === effectiveSection(note))?.short ?? 'Etiketsiz';
  }

  protected firstPhoto(note: Note): Photo | undefined {
    return this.photoById().get(note.photoIds[0]);
  }

  protected removeNote(note: Note) {
    const photos = note.photoIds.length ? ' Fotoğrafları atanmamış olarak kalır.' : '';
    if (confirm(`Not silinsin mi?${photos}`)) void deleteNote(note);
  }

  protected onQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected addNote() {
    this.editor.open({ surveyId: this.surveyId });
  }

  protected onCamera(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) this.editor.open({ surveyId: this.surveyId, files });
  }

  protected async startExport() {
    this.exporting.set(true);
    this.exportError.set('');
    this.zip.set(null);
    try {
      this.zip.set(await buildSurveyZip(this.surveyId));
    } catch (e) {
      console.error(e);
      this.exportError.set('Zip oluşturulamadı. Tekrar dene.');
    }
  }

  protected canShare(zip: SurveyZip) {
    return canShareFile(zip.file);
  }

  protected sizeMb(zip: SurveyZip) {
    return (zip.file.size / 1048576).toFixed(1);
  }

  protected async share(zip: SurveyZip) {
    try {
      await navigator.share({ files: [zip.file], title: zip.file.name });
      await markExported(this.surveyId);
      this.exporting.set(false);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') this.exportError.set('Paylaşılamadı. "Dosyayı indir" ile dene.');
    }
  }

  protected async download(zip: SurveyZip) {
    downloadFile(zip.file);
    await markExported(this.surveyId);
    this.exporting.set(false);
  }
}
