import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { db } from '../core/db';
import { normalizeTr, SECTIONS } from '../core/models';
import { addImportedNotes, classifyLines, ImportLine, readNoteLines } from '../core/notes-import';
import { Icon } from '../shared/icon';

interface Row extends ImportLine {
  selected: boolean;
}

@Component({
  selector: 'app-note-import',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page has-tabbar">
      <h1 class="large-title">İçe aktar</h1>
      <p class="subtitle">Word ya da metin dosyasındaki her satır bir not olur. Eklemeden önce satırları seçebilirsin.</p>

      <label
        class="drop-zone"
        [class.over]="dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        <app-icon name="upload" />
        <strong>Dosyayı buraya bırak ya da seç</strong>
        <span>.docx veya .txt</span>
        <input type="file" accept=".docx,.txt" multiple hidden (change)="onPick($event)" />
      </label>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      @if (rows().length) {
        <div class="import-head">
          <button type="button" class="link" (click)="toggleAll()">{{ allSelected() ? 'Hiçbirini seçme' : 'Tümünü seç' }}</button>
          <button type="button" class="btn primary" [disabled]="!selectedCount() || saving()" (click)="add()">
            {{ selectedCount() }} notu ekle
          </button>
        </div>
        <ul class="list">
          @for (row of rows(); track $index) {
            <li>
              <label class="import-row">
                <input type="checkbox" [checked]="row.selected" (change)="toggle($index)" />
                <span class="grow">
                  <span class="note-text">{{ row.text }}</span>
                  <span class="row-sub">
                    {{ sectionName(row.section) }}
                    @if (row.skipReason) {
                      <span class="tag warn">{{ row.skipReason }}</span>
                    }
                  </span>
                </span>
              </label>
            </li>
          }
        </ul>
      }
    </main>
  `,
})
export class NoteImport {
  private readonly router = inject(Router);
  private readonly surveyId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly rows = signal<Row[]>([]);
  protected readonly dragging = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly selectedCount = computed(() => this.rows().filter((r) => r.selected).length);
  protected readonly allSelected = computed(() => this.selectedCount() === this.rows().length);

  protected sectionName(no: number | undefined): string {
    return SECTIONS.find((s) => s.no === no)?.short ?? 'Etiketsiz';
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    void this.load(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onPick(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.load(files);
  }

  private async load(files: File[]) {
    if (!files.length) return;
    this.error.set('');
    try {
      const raw: string[] = [];
      for (const file of files) raw.push(...(await readNoteLines(file)));
      const existing = (await db.notes.where({ surveyId: this.surveyId }).toArray()).map((n) => n.text);
      const parts = (await db.parts.toArray()).map((p) => ({ key: normalizeTr(p.name), section: p.section }));
      const lines = classifyLines(raw, existing, parts);
      this.rows.set(lines.map((line) => ({ ...line, selected: !line.skipReason })));
      if (!lines.length) this.error.set('Dosyada metin bulunamadı.');
    } catch (e) {
      console.error(e);
      this.rows.set([]);
      this.error.set((e as Error).message.startsWith('Sadece') ? (e as Error).message : 'Dosya okunamadı.');
    }
  }

  protected toggle(index: number) {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  }

  protected toggleAll() {
    const selected = !this.allSelected();
    this.rows.update((rows) => rows.map((r) => ({ ...r, selected })));
  }

  protected async add() {
    this.saving.set(true);
    await addImportedNotes(this.surveyId, this.rows().filter((r) => r.selected));
    void this.router.navigate(['/s', this.surveyId, 'bulgular']);
  }
}
