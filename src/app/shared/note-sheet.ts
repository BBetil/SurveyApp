import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { addPhoto, db, deletePhoto, live, saveNote, thumbUrl } from '../core/db';
import { processImage } from '../core/image';
import { partCompletions } from '../core/lists';
import { Grade, GRADES, normalizeTr, Note, NoteStatus, Part, Photo, SECTIONS, STATUS_LABELS, uid } from '../core/models';
import { NoteEditor } from '../core/note-editor';
import { suggestSection } from '../core/section-suggest';
import { Icon } from './icon';

/** Cümle içinde küçük harfle yazar; VHF gibi kısaltmalara dokunmaz. */
function inSentence(word: string): string {
  const second = word.charAt(1);
  if (second && second === second.toLocaleUpperCase('tr') && second !== second.toLocaleLowerCase('tr')) return word;
  return word.charAt(0).toLocaleLowerCase('tr') + word.slice(1);
}

@Component({
  selector: 'app-note-sheet',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './note-sheet.html',
})
export class NoteSheet implements OnInit {
  private readonly editor = inject(NoteEditor);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('noteText');
  private readonly request = this.editor.request()!;

  protected readonly sections = SECTIONS;
  protected readonly grades = GRADES;
  private readonly parts = live<Part[]>(() => db.parts.toArray(), []);
  protected readonly statuses = Object.entries(STATUS_LABELS) as [NoteStatus, string][];
  protected readonly thumbUrl = thumbUrl;
  protected readonly isEdit = !!this.request.noteId;

  protected readonly text = signal('');
  protected readonly section = signal<number | undefined>(undefined);
  protected readonly status = signal<NoteStatus | undefined>(undefined);
  protected readonly grade = signal<Grade | undefined>(undefined);
  protected readonly photos = signal<Photo[]>([]);
  protected readonly processing = signal(0);
  protected readonly error = signal('');
  protected readonly savedCount = signal(0);
  private readonly caret = signal(0);
  private readonly partTerms = computed(() => this.parts().map((p) => ({ key: normalizeTr(p.name), section: p.section })));
  protected readonly suggested = computed(() => suggestSection(this.text(), this.partTerms()));
  protected readonly completions = computed(() => partCompletions(this.text(), this.caret(), this.parts()));

  private noteId = uid();
  private createdAt = Date.now();
  /** Bu oturumda çekilen fotoğraflar: iptalde silinir */
  private added = new Set<string>();

  async ngOnInit() {
    const { noteId, files, photoIds } = this.request;
    if (noteId) {
      const note = await db.notes.get(noteId);
      if (note) {
        this.noteId = note.id;
        this.createdAt = note.createdAt;
        this.text.set(note.text);
        this.section.set(note.section);
        this.status.set(note.status);
        this.grade.set(note.grade);
        await this.loadPhotos(note.photoIds);
      }
    }
    if (photoIds) await this.loadPhotos(photoIds);
    if (files) await this.addFiles(files);
    if (!noteId && !files?.length) this.textarea().nativeElement.focus();
  }

  private async loadPhotos(ids: string[]) {
    const rows = await db.photos.bulkGet(ids);
    this.photos.update((list) => [...list, ...rows.filter((p): p is Photo => !!p)]);
  }

  private async addFiles(files: File[]) {
    this.processing.update((n) => n + files.length);
    for (const file of files) {
      try {
        const id = await addPhoto(this.request.surveyId, await processImage(file));
        this.added.add(id);
        await this.loadPhotos([id]);
      } catch {
        this.error.set('Bir fotoğraf işlenemedi.');
      }
      this.processing.update((n) => n - 1);
    }
  }

  protected onFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) void this.addFiles(files);
  }

  protected async removePhoto(photo: Photo) {
    this.photos.update((list) => list.filter((p) => p.id !== photo.id));
    if (this.added.delete(photo.id)) await deletePhoto(photo.id);
  }

  protected onText(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    this.text.set(el.value);
    this.caret.set(el.selectionStart ?? el.value.length);
    this.error.set('');
  }

  protected onCaret(event: Event) {
    this.caret.set((event.target as HTMLTextAreaElement).selectionStart ?? 0);
  }

  /** Yazılmakta olan kelimeleri parça adıyla değiştirir */
  protected insertPart(part: Part) {
    const found = this.completions();
    if (!found) return;
    const el = this.textarea().nativeElement;
    const before = el.value.slice(0, found.start);
    const insert = `${before ? inSentence(part.name) : part.name} `;
    el.value = before + insert + el.value.slice(el.selectionEnd ?? el.value.length);
    this.text.set(el.value);
    const caret = before.length + insert.length;
    this.caret.set(caret);
    el.focus();
    el.setSelectionRange(caret, caret);
  }

  protected toggle<T>(target: { (): T | undefined; set(v: T | undefined): void }, value: T) {
    target.set(target() === value ? undefined : value);
  }

  protected async save(andNew: boolean) {
    const text = this.text().trim();
    if (!text && !this.photos().length) {
      this.error.set('Not yaz ya da fotoğraf ekle.');
      return;
    }
    if (this.processing()) {
      this.error.set('Fotoğraflar işleniyor, biraz bekle.');
      return;
    }
    const note: Note = {
      id: this.noteId,
      surveyId: this.request.surveyId,
      createdAt: this.createdAt,
      text,
      section: this.section(),
      sectionSuggested: this.suggested(),
      status: this.status(),
      grade: this.grade(),
      photoIds: this.photos().map((p) => p.id),
    };
    await saveNote(note);
    this.added.clear();
    if (!andNew) {
      this.editor.close();
      return;
    }
    this.noteId = uid();
    this.createdAt = Date.now();
    this.text.set('');
    this.section.set(undefined);
    this.status.set(undefined);
    this.grade.set(undefined);
    this.photos.set([]);
    this.error.set('');
    this.savedCount.update((n) => n + 1);
    const el = this.textarea().nativeElement;
    el.value = '';
    el.focus();
  }

  protected async cancel() {
    const dirty = this.isEdit ? false : !!this.text().trim() || this.added.size > 0;
    if (dirty && !confirm('Bu not kaydedilmedi. Çıkılsın mı?')) return;
    for (const id of this.added) await deletePhoto(id);
    this.editor.close();
  }
}
